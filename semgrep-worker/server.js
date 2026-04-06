const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 4000;
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const WORKER_ID = process.env.WORKER_ID || `worker-${uuidv4().slice(0, 8)}`;
const WORKER_SECRET = process.env.WORKER_SECRET || "";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_SCANS || 1);

const SCAN_TIMEOUT_MS = 300_000;
const MAX_FILE_BYTES = Number(process.env.SEMGREP_MAX_FILE_BYTES || 1024 * 1024);
const MAX_BATCH_FILES = Number(process.env.SEMGREP_MAX_BATCH_FILES || 20);
const SEMGREP_TIMEOUT_SECONDS = Number(process.env.SEMGREP_TIMEOUT_SECONDS || 5);
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "__pycache__", ".venv", "dist", "build", "vendor"]);
const SCANNABLE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json",
  ".py", ".java", ".go", ".rb", ".php", ".rs", ".kt", ".kts",
  ".cs", ".scala", ".swift", ".tf", ".yaml", ".yml",
  ".sh", ".bash", ".sql", ".html", ".xml", ".dockerfile",
]);
const SCANNABLE_FILENAMES = new Set(["dockerfile"]);

let activeJobs = 0;

/**
 * Recursively walks a directory and returns a flat list of file entries
 * @param {string} dir - Directory to walk
 * @param {string} base - Base path to strip from results
 * @returns {Array<{path: string, type: string, size: number}>} File entries
 */
function walkDir(dir, base) {
  const entries = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (SKIP_DIRS.has(item.name)) continue;

    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(base, fullPath).replace(/\\/g, "/");

    if (item.isDirectory()) {
      entries.push({ path: relativePath, type: "dir", size: 0 });
      entries.push(...walkDir(fullPath, base));
    } else {
      const stats = fs.statSync(fullPath);
      entries.push({ path: relativePath, type: "file", size: stats.size });
    }
  }

  return entries;
}

/**
 * Determines if a file is likely useful for Semgrep analysis
 * @param {string} filePath - Absolute file path
 * @returns {boolean} Whether the file should be scanned
 */
function isScannableFile(filePath) {
  const fileName = path.basename(filePath).toLowerCase();
  const extension = path.extname(filePath).toLowerCase();
  return SCANNABLE_FILENAMES.has(fileName) || SCANNABLE_EXTENSIONS.has(extension);
}

/**
 * Recursively collects scannable files below a directory while skipping oversized files
 * @param {string} dir - Directory to walk
 * @returns {string[]} Absolute file paths
 */
function collectScannableFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (SKIP_DIRS.has(item.name)) continue;

    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...collectScannableFiles(fullPath));
      continue;
    }

    const stats = fs.statSync(fullPath);
    if (stats.size > MAX_FILE_BYTES || !isScannableFile(fullPath)) continue;
    files.push(fullPath);
  }

  return files;
}

/**
 * Splits a list of targets into fixed-size batches
 * @param {string[]} items - Paths to split
 * @param {number} batchSize - Max items per batch
 * @returns {string[][]} Batches of file paths
 */
function chunkItems(items, batchSize) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Runs a child process without blocking the Node event loop
 * @param {string} command - Executable name
 * @param {string[]} args - Process args
 * @param {{ cwd?: string, timeoutMs?: number }} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string, code: number | null, signal: NodeJS.Signals | null}>}
 */
function runProcess(command, args, options = {}) {
  const { cwd, timeoutMs } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);

      if (timedOut) {
        const error = new Error(`${command} timed out after ${timeoutMs}ms`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        error.signal = signal;
        reject(error);
        return;
      }

      resolve({ stdout, stderr, code, signal });
    });
  });
}

/**
 * Strips Semgrep registry noise from a finding message (login prompts,
 * "requires login" text, raw URLs to semgrep.dev, etc.)
 * @param {string} raw - Raw message from Semgrep
 * @returns {string} Cleaned message
 */
function cleanFindingMessage(raw) {
  if (!raw) return "No description";
  return raw
    .replace(/\s*requires?\s+login\.?/gi, "")
    .replace(/https?:\/\/semgrep\.dev\S*/g, "")
    .replace(/\s*See\s+more\s+at\s*:?\s*$/i, "")
    .replace(/\s*More\s+info\s*:?\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim() || "No description";
}

/**
 * Extracts a useful reference URL from Semgrep metadata, preferring
 * OWASP/CWE/open references over gated semgrep.dev links
 * @param {object} metadata - Semgrep rule metadata
 * @param {string} checkId - Rule check ID
 * @returns {string|null} Best available reference URL
 */
function extractReferenceUrl(metadata, checkId) {
  if (!metadata) return null;

  const refs = metadata.references || [];
  const openRef = refs.find((r) =>
    r.includes("owasp.org") || r.includes("cwe.mitre.org") || r.includes("cheatsheetseries")
  );
  if (openRef) return openRef;

  if (refs.length > 0) {
    const nonSemgrep = refs.find((r) => !r.includes("semgrep.dev"));
    if (nonSemgrep) return nonSemgrep;
  }

  const cwe = metadata.cwe || [];
  if (cwe.length > 0) {
    const match = String(cwe[0]).match(/CWE-(\d+)/i);
    if (match) return `https://cwe.mitre.org/data/definitions/${match[1]}.html`;
  }

  return null;
}

/**
 * Parses raw Semgrep JSON output into structured findings
 * @param {object} raw - Raw Semgrep JSON output
 * @param {string} basePath - Base path to strip from file paths
 * @returns {Array} Structured findings
 */
function parseSemgrepOutput(raw, basePath) {
  if (!raw || !raw.results) return [];

  return raw.results.map((r) => ({
    ruleId: r.check_id || "unknown",
    severity: mapSeverity(r.extra?.severity || "WARNING"),
    message: cleanFindingMessage(r.extra?.message),
    filePath: path.relative(basePath, r.path).replace(/\\/g, "/"),
    startLine: r.start?.line || 0,
    endLine: r.end?.line || 0,
    snippet: r.extra?.lines || "",
    category: extractCategory(r.check_id || ""),
    referenceUrl: extractReferenceUrl(r.extra?.metadata, r.check_id),
  }));
}

/**
 * Maps Semgrep severity strings to standardised levels
 * @param {string} severity - Raw severity from Semgrep
 * @returns {string} Normalised severity
 */
function mapSeverity(severity) {
  const upper = String(severity).toUpperCase();
  if (upper === "ERROR") return "ERROR";
  if (upper === "WARNING") return "WARNING";
  return "INFO";
}

/**
 * Extracts a human-readable category from a Semgrep rule ID
 * @param {string} ruleId - Full Semgrep rule ID
 * @returns {string} Category name
 */
function extractCategory(ruleId) {
  const parts = ruleId.split(".");
  if (parts.includes("security")) return "security";
  if (parts.includes("correctness")) return "correctness";
  if (parts.includes("performance")) return "performance";
  if (parts.includes("best-practice")) return "best-practice";
  return "general";
}

/**
 * Runs Semgrep on a set of files and returns findings plus any error
 * @param {string[]} targets - Absolute paths to scan
 * @param {string} basePath - Base path for relative file paths
 * @returns {Promise<{findings: Array, error: string|null}>} Findings and optional error
 */
async function runSemgrep(targets, basePath) {
  if (!targets.length) return { findings: [], error: null };

  try {
    const result = await runProcess(
      "semgrep",
      [
        "--config", "p/default",
        "--config", "p/security-audit",
        "--json",
        "--jobs", "1",
        "--timeout", String(SEMGREP_TIMEOUT_SECONDS),
        "--metrics", "off",
        ...targets,
      ],
      { timeoutMs: SCAN_TIMEOUT_MS }
    );

    if (result.stderr) {
      console.warn(`[semgrep] stderr: ${result.stderr.slice(0, 300)}`);
    }

    const output = result.stdout || "";
    if (!output.trim()) {
      if (result.code !== 0 && result.code !== 1) {
        return {
          findings: [],
          error: `Semgrep exited with code ${result.code}: ${(result.stderr || "").slice(0, 200)}`,
        };
      }
      return { findings: [], error: null };
    }

    const findings = parseSemgrepOutput(JSON.parse(output), basePath);

    if (result.code !== 0 && result.code !== 1) {
      const errMsg = `Semgrep exited with code ${result.code}${result.signal ? ` (${result.signal})` : ""}: ${(result.stderr || "").slice(0, 200)}`;
      console.warn(`[semgrep] ${errMsg}`);
      return { findings, error: errMsg };
    }

    return { findings, error: null };
  } catch (error) {
    if (error.stdout) {
      try {
        const findings = parseSemgrepOutput(JSON.parse(String(error.stdout)), basePath);
        return { findings, error: `Semgrep error (partial results): ${error.message}` };
      } catch {
        console.error(`[semgrep] Failed to parse stdout: ${String(error.stdout).slice(0, 400)}`);
      }
    }

    if (error.stderr) {
      console.error(`[semgrep] stderr: ${String(error.stderr).slice(0, 400)}`);
    }

    console.error(`[semgrep] Failed: ${error.message}`);
    return { findings: [], error: error.message };
  }
}

/**
 * Sends a progress-only or partial findings update to the callback URL
 * @param {string} callbackUrl - The Next.js API callback URL
 * @param {object} payload - Partial findings / progress data
 */
async function sendPartialResults(callbackUrl, payload) {
  try {
    await fetch(callbackUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error(`[callback] Failed to send partial results: ${error.message}`);
  }
}

/**
 * Sends the final scan status to the callback URL
 * @param {string} callbackUrl - The Next.js API callback URL
 * @param {object} payload - Final status payload
 */
async function finalizeScan(callbackUrl, payload) {
  try {
    await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error(`[callback] Failed to send final scan state: ${error.message}`);
  }
}

/**
 * Enriches file tree entries with finding counts
 * @param {Array} fileTree - Raw file tree entries
 * @param {Array} findings - All findings collected so far
 * @returns {Array} Enriched file tree
 */
function enrichFileTree(fileTree, findings) {
  const findingCountByPath = {};
  for (const finding of findings) {
    findingCountByPath[finding.filePath] = (findingCountByPath[finding.filePath] || 0) + 1;
    const dir = path.dirname(finding.filePath);
    if (dir !== ".") {
      findingCountByPath[dir] = (findingCountByPath[dir] || 0) + 1;
    }
  }

  return fileTree.map((entry) => ({
    ...entry,
    findingCount: findingCountByPath[entry.path] || 0,
  }));
}

/**
 * Sends a lightweight progress-only PATCH (no findings/file tree changes)
 * @param {string} callbackUrl - API callback URL
 * @param {string} stageLabel - Human-readable stage
 * @param {number} percent - Progress percentage
 */
async function sendProgressUpdate(callbackUrl, stageLabel, percent) {
  await sendPartialResults(callbackUrl, {
    directory: "(progress)",
    findings: [],
    fileTree: [],
    scannedDirs: [],
    totalDirs: 0,
    currentDir: null,
    stageLabel,
    progressPercent: percent,
    stats: { total: 0, critical: 0, warning: 0, info: 0, filesScanned: 0 },
  });
}

/* ── Health endpoint ── */

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    workerId: WORKER_ID,
    activeJobs,
    maxConcurrent: MAX_CONCURRENT,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Runs the scan pipeline for a single job. When `resumeFrom` is provided the
 * worker skips directories that were already scanned in a previous attempt,
 * effectively resuming from where the scan left off.
 * @param {object} job - Scan job claimed from the queue
 */
async function runScanJob({ repoFullName, accessToken, commitSha, branch, callbackUrl, scanId, resumeFrom }) {
  const localScanId = scanId || uuidv4();
  const tmpDir = path.join("/tmp", `scan-${localScanId}`);

  console.log(`[scan:${localScanId}] Starting scan for ${repoFullName} @ ${commitSha?.slice(0, 7) || "HEAD"}`);

  try {
    const cloneUrl = `https://x-access-token:${accessToken}@github.com/${repoFullName}.git`;

    if (callbackUrl) {
      await sendProgressUpdate(callbackUrl, "Cloning repository...", 10);
    }

    console.log(`[scan:${localScanId}] Fetching commit ${commitSha?.slice(0, 7) || "HEAD"}...`);

    fs.mkdirSync(tmpDir, { recursive: true });

    const initResult = await runProcess("git", ["init", tmpDir], { timeoutMs: 10_000 });
    if (initResult.code !== 0) {
      throw new Error(initResult.stderr || `git init failed with code ${initResult.code}`);
    }

    const fetchResult = await runProcess(
      "git",
      ["-C", tmpDir, "fetch", "--depth", "1", cloneUrl, commitSha || (branch || "HEAD")],
      { timeoutMs: 120_000 }
    );
    if (fetchResult.code !== 0) {
      throw new Error(fetchResult.stderr || `git fetch failed with code ${fetchResult.code}`);
    }

    const checkoutResult = await runProcess(
      "git",
      ["-C", tmpDir, "checkout", "FETCH_HEAD"],
      { timeoutMs: 30_000 }
    );
    if (checkoutResult.code !== 0) {
      throw new Error(checkoutResult.stderr || `git checkout failed with code ${checkoutResult.code}`);
    }

    console.log(`[scan:${localScanId}] Clone complete`);

    if (callbackUrl) {
      await sendProgressUpdate(callbackUrl, "Analyzing repository structure...", 15);
    }

    const fullFileTree = walkDir(tmpDir, tmpDir);
    const topLevelItems = fs.readdirSync(tmpDir, { withFileTypes: true });
    const topLevelTargets = [];
    const topLevelFiles = [];

    for (const item of topLevelItems) {
      if (SKIP_DIRS.has(item.name)) continue;

      const fullPath = path.join(tmpDir, item.name);
      if (item.isDirectory()) {
        topLevelTargets.push({ name: item.name, path: fullPath });
      } else if (isScannableFile(fullPath)) {
        const stats = fs.statSync(fullPath);
        if (stats.size <= MAX_FILE_BYTES) {
          topLevelFiles.push(fullPath);
        }
      }
    }

    if (topLevelFiles.length > 0) {
      topLevelTargets.unshift({ name: "(root files)", path: tmpDir, rootOnly: true });
    }

    const scanTargets = topLevelTargets.map((target) => {
      const files = target.rootOnly ? topLevelFiles : collectScannableFiles(target.path);
      const batches = chunkItems(files, MAX_BATCH_FILES);

      return {
        ...target,
        files,
        batches: batches.length > 0 ? batches : [[]],
      };
    });

    const totalTargets = scanTargets.length;
    const totalBatches = Math.max(
      1,
      scanTargets.reduce((sum, target) => sum + target.batches.length, 0)
    );

    const allFindings = [];
    const batchErrors = [];
    const scannedDirs = [];
    let scannedFileCount = 0;
    let completedBatches = 0;

    const alreadyScanned = new Set(resumeFrom?.scannedDirs || []);
    if (alreadyScanned.size > 0) {
      console.log(`[scan:${localScanId}] Resuming — skipping ${alreadyScanned.size} already-scanned dir(s): ${[...alreadyScanned].join(", ")}`);
    }

    for (let targetIndex = 0; targetIndex < scanTargets.length; targetIndex++) {
      const target = scanTargets[targetIndex];

      if (alreadyScanned.has(target.name)) {
        completedBatches += target.batches.length;
        scannedDirs.push(target.name);
        console.log(`[scan:${localScanId}] Skipping already-scanned: ${target.name} (${targetIndex + 1}/${totalTargets})`);
        continue;
      }

      let targetFindingCount = 0;

      console.log(`[scan:${localScanId}] Scanning ${target.name} (${targetIndex + 1}/${totalTargets})...`);

      for (let batchIndex = 0; batchIndex < target.batches.length; batchIndex++) {
        const batch = target.batches[batchIndex];
        const { findings: batchFindings, error: batchError } =
          batch.length > 0 ? await runSemgrep(batch, tmpDir) : { findings: [], error: null };

        if (batchError) {
          const errorEntry = {
            directory: target.name,
            batch: batchIndex + 1,
            filesInBatch: batch.length,
            error: batchError,
          };
          batchErrors.push(errorEntry);
          console.warn(`[scan:${localScanId}] Batch error in ${target.name}: ${batchError}`);
        }

        allFindings.push(...batchFindings);
        scannedFileCount += batch.length;
        targetFindingCount += batchFindings.length;
        completedBatches += 1;

        if (callbackUrl) {
          const dirTree = target.rootOnly
            ? fullFileTree.filter((entry) => !entry.path.includes("/"))
            : fullFileTree.filter((entry) => entry.path === target.name || entry.path.startsWith(`${target.name}/`));

          const enrichedDirTree = enrichFileTree(dirTree, allFindings);
          const progressPercent = Math.min(90, Math.round((completedBatches / totalBatches) * 70) + 20);
          const stageLabel = `Scanning: ${target.name}${target.batches.length > 1 ? ` (${batchIndex + 1}/${target.batches.length})` : ""}`;

          await sendPartialResults(callbackUrl, {
            directory: target.name,
            findings: batchFindings,
            fileTree: enrichedDirTree,
            scannedDirs,
            totalDirs: totalTargets,
            currentDir: target.name,
            progressPercent,
            stageLabel,
            batchErrors: batchErrors.length,
            stats: {
              total: allFindings.length,
              critical: allFindings.filter((f) => f.severity === "ERROR").length,
              warning: allFindings.filter((f) => f.severity === "WARNING").length,
              info: allFindings.filter((f) => f.severity === "INFO").length,
              filesScanned: scannedFileCount,
            },
          });
        }
      }

      scannedDirs.push(target.name);
      console.log(`[scan:${localScanId}] ${target.name}: ${targetFindingCount} findings`);
    }

    const enrichedFullTree = enrichFileTree(fullFileTree, allFindings);
    const stats = {
      total: allFindings.length,
      critical: allFindings.filter((f) => f.severity === "ERROR").length,
      warning: allFindings.filter((f) => f.severity === "WARNING").length,
      info: allFindings.filter((f) => f.severity === "INFO").length,
      filesScanned: scannedFileCount,
    };

    const hasErrors = batchErrors.length > 0;
    const status = hasErrors && allFindings.length === 0 ? "failed" : "completed";

    if (callbackUrl) {
      await finalizeScan(callbackUrl, {
        status,
        findings: allFindings,
        fileTree: enrichedFullTree,
        stats,
        batchErrors: hasErrors ? batchErrors : undefined,
        error: hasErrors
          ? `${batchErrors.length} batch(es) failed during scan. Results may be incomplete.`
          : undefined,
      });
    }

    console.log(
      `[scan:${localScanId}] Done - ${allFindings.length} findings, ${enrichedFullTree.length} tree entries` +
      (hasErrors ? `, ${batchErrors.length} batch errors` : "")
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[scan:${localScanId}] Failed: ${message}`);

    if (callbackUrl) {
      await finalizeScan(callbackUrl, {
        status: "failed",
        error: `Scan failed: ${message}`,
      });
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* cleanup best-effort */
    }
  }
}

/* ── Job queue polling ── */

/**
 * Polls the API queue for available scan jobs and runs them
 */
async function pollForJobs() {
  if (activeJobs >= MAX_CONCURRENT) return;

  try {
    const headers = { "Content-Type": "application/json" };
    if (WORKER_SECRET) {
      headers["Authorization"] = `Bearer ${WORKER_SECRET}`;
    }

    const res = await fetch(`${API_URL}/api/queue/next`, {
      method: "POST",
      headers,
      body: JSON.stringify({ workerId: WORKER_ID }),
    });

    if (!res.ok) return;

    const data = await res.json();
    if (!data.job) return;

    activeJobs++;
    console.log(`[worker:${WORKER_ID}] Claimed job ${data.job.scanId} for ${data.job.repoFullName}`);

    runScanJob(data.job)
      .catch((err) => {
        console.error(`[worker:${WORKER_ID}] Job ${data.job.scanId} crashed: ${err.message || err}`);
      })
      .finally(() => {
        activeJobs--;
      });
  } catch {
    /* poll failure is non-critical, will retry */
  }
}

/* ── Legacy POST /scan endpoint (backward compatibility) ── */

app.post("/scan", async (req, res) => {
  const { repoFullName, accessToken, commitSha } = req.body;

  if (!repoFullName || !accessToken || !commitSha) {
    return res.status(400).json({ error: "Missing required fields: repoFullName, accessToken, commitSha" });
  }

  if (activeJobs >= MAX_CONCURRENT) {
    return res.status(429).json({
      error: "Worker is busy",
      activeJobs,
      maxConcurrent: MAX_CONCURRENT,
      retryAfter: 30,
    });
  }

  const scanId = req.body.scanId || uuidv4();
  activeJobs++;

  runScanJob({
    ...req.body,
    scanId,
  })
    .catch((error) => {
      console.error(`[scan:${scanId}] Background job crashed: ${error instanceof Error ? error.message : String(error)}`);
    })
    .finally(() => {
      activeJobs--;
    });

  return res.status(202).json({
    success: true,
    accepted: true,
    scanId,
  });
});

/* ── Start server + polling loop ── */

app.listen(PORT, () => {
  console.log(`Semgrep worker ${WORKER_ID} listening on port ${PORT}`);
  console.log(`Polling ${API_URL}/api/queue/next every ${POLL_INTERVAL_MS}ms (max ${MAX_CONCURRENT} concurrent)`);

  pollForJobs();
  setInterval(pollForJobs, POLL_INTERVAL_MS);
});
