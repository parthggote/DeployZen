const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 4000;
const SCAN_TIMEOUT_MS = 300_000;
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "__pycache__", ".venv", "dist", "build", "vendor"]);

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
    message: r.extra?.message || "No description",
    filePath: path.relative(basePath, r.path).replace(/\\/g, "/"),
    startLine: r.start?.line || 0,
    endLine: r.end?.line || 0,
    snippet: r.extra?.lines || "",
    category: extractCategory(r.check_id || ""),
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
 * @param {string} ruleId - Full Semgrep rule ID (e.g. "python.django.security.injection.sql")
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
 * Runs Semgrep on a single directory and returns parsed findings
 * @param {string} targetPath - Absolute path to scan
 * @param {string} basePath - Base path for relative file paths
 * @returns {Array} Parsed findings for this directory
 */
function scanDirectory(targetPath, basePath) {
  try {
    const output = execSync(
      `semgrep --config auto --json "${targetPath}"`,
      { timeout: SCAN_TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" }
    ).toString();
    return parseSemgrepOutput(JSON.parse(output), basePath);
  } catch (err) {
    if (err.stdout) {
      try {
        return parseSemgrepOutput(JSON.parse(err.stdout.toString()), basePath);
      } catch {
        return [];
      }
    }
    return [];
  }
}

/**
 * Sends partial findings to the callback URL
 * @param {string} callbackUrl - The Next.js API callback URL
 * @param {object} payload - Partial findings data
 */
async function sendPartialResults(callbackUrl, payload) {
  try {
    await fetch(callbackUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`[callback] Failed to send partial results: ${err.message}`);
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
  for (const f of findings) {
    findingCountByPath[f.filePath] = (findingCountByPath[f.filePath] || 0) + 1;
    const dir = path.dirname(f.filePath);
    if (dir !== ".") {
      findingCountByPath[dir] = (findingCountByPath[dir] || 0) + 1;
    }
  }
  return fileTree.map((entry) => ({
    ...entry,
    findingCount: findingCountByPath[entry.path] || 0,
  }));
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /scan — Clones a repo, runs Semgrep directory-by-directory,
 * sends incremental findings via callback, returns final results
 */
app.post("/scan", async (req, res) => {
  const { repoFullName, accessToken, commitSha, callbackUrl, scanId } = req.body;

  if (!repoFullName || !accessToken || !commitSha) {
    return res.status(400).json({ error: "Missing required fields: repoFullName, accessToken, commitSha" });
  }

  const localScanId = scanId || uuidv4();
  const tmpDir = path.join("/tmp", `scan-${localScanId}`);

  console.log(`[scan:${localScanId}] Starting scan for ${repoFullName}`);

  try {
    const cloneUrl = `https://x-access-token:${accessToken}@github.com/${repoFullName}.git`;

    console.log(`[scan:${localScanId}] Cloning repo...`);
    execSync(
      `git clone --depth 1 "${cloneUrl}" "${tmpDir}"`,
      { timeout: 120_000, stdio: "pipe" }
    );
    console.log(`[scan:${localScanId}] Clone complete`);

    const fullFileTree = walkDir(tmpDir, tmpDir);

    const topLevelItems = fs.readdirSync(tmpDir, { withFileTypes: true });
    const scanTargets = [];

    const topLevelFiles = [];
    for (const item of topLevelItems) {
      if (SKIP_DIRS.has(item.name)) continue;
      if (item.isDirectory()) {
        scanTargets.push({ name: item.name, path: path.join(tmpDir, item.name) });
      } else {
        topLevelFiles.push(path.join(tmpDir, item.name));
      }
    }

    if (topLevelFiles.length > 0) {
      scanTargets.unshift({ name: "(root files)", path: tmpDir, rootOnly: true });
    }

    const totalTargets = scanTargets.length;
    const allFindings = [];
    const scannedDirs = [];

    for (let i = 0; i < scanTargets.length; i++) {
      const target = scanTargets[i];
      const targetPath = target.rootOnly ? tmpDir : target.path;

      console.log(`[scan:${localScanId}] Scanning ${target.name} (${i + 1}/${totalTargets})...`);

      let dirFindings;
      if (target.rootOnly) {
        dirFindings = scanDirectory(tmpDir, tmpDir).filter(
          (f) => !f.filePath.includes("/")
        );
      } else {
        dirFindings = scanDirectory(targetPath, tmpDir);
      }

      allFindings.push(...dirFindings);
      scannedDirs.push(target.name);

      if (callbackUrl) {
        const dirTree = target.rootOnly
          ? fullFileTree.filter((e) => !e.path.includes("/"))
          : fullFileTree.filter((e) => e.path === target.name || e.path.startsWith(target.name + "/"));

        const enrichedDirTree = enrichFileTree(dirTree, allFindings);

        await sendPartialResults(callbackUrl, {
          directory: target.name,
          findings: dirFindings,
          fileTree: enrichedDirTree,
          scannedDirs,
          totalDirs: totalTargets,
          currentDir: scanTargets[i + 1]?.name || null,
          stats: {
            total: allFindings.length,
            critical: allFindings.filter((f) => f.severity === "ERROR").length,
            warning: allFindings.filter((f) => f.severity === "WARNING").length,
            info: allFindings.filter((f) => f.severity === "INFO").length,
            filesScanned: fullFileTree.filter((e) => e.type === "file").length,
          },
        });
      }

      console.log(`[scan:${localScanId}] ${target.name}: ${dirFindings.length} findings`);
    }

    const enrichedFullTree = enrichFileTree(fullFileTree, allFindings);

    const result = {
      success: true,
      commitSha,
      findings: allFindings,
      fileTree: enrichedFullTree,
      stats: {
        total: allFindings.length,
        critical: allFindings.filter((f) => f.severity === "ERROR").length,
        warning: allFindings.filter((f) => f.severity === "WARNING").length,
        info: allFindings.filter((f) => f.severity === "INFO").length,
        filesScanned: fullFileTree.filter((e) => e.type === "file").length,
      },
    };

    res.json(result);
    console.log(`[scan:${localScanId}] Done — ${allFindings.length} findings, ${enrichedFullTree.length} tree entries`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[scan:${localScanId}] Failed: ${message}`);
    res.status(500).json({ error: `Scan failed: ${message}` });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* cleanup best-effort */
    }
  }
});

app.listen(PORT, () => {
  console.log(`Semgrep worker listening on port ${PORT}`);
});
