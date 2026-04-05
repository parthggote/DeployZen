const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 4000;
const SCAN_TIMEOUT_MS = 300_000;

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
    if (item.name === ".git" || item.name === "node_modules") continue;

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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /scan — Clones a repo, runs Semgrep, returns findings + file tree
 */
app.post("/scan", async (req, res) => {
  const { repoFullName, accessToken, commitSha } = req.body;

  if (!repoFullName || !accessToken || !commitSha) {
    return res.status(400).json({ error: "Missing required fields: repoFullName, accessToken, commitSha" });
  }

  const scanId = uuidv4();
  const tmpDir = path.join("/tmp", `scan-${scanId}`);

  try {
    const cloneUrl = `https://x-access-token:${accessToken}@github.com/${repoFullName}.git`;

    execSync(
      `git clone --depth 1 "${cloneUrl}" "${tmpDir}"`,
      { timeout: 60_000, stdio: "pipe" }
    );

    execSync(
      `cd "${tmpDir}" && git checkout ${commitSha}`,
      { timeout: 30_000, stdio: "pipe" }
    ).toString();

    let semgrepRaw;
    try {
      const output = execSync(
        `semgrep --config auto --json "${tmpDir}"`,
        { timeout: SCAN_TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" }
      ).toString();
      semgrepRaw = JSON.parse(output);
    } catch (semgrepErr) {
      if (semgrepErr.stdout) {
        try {
          semgrepRaw = JSON.parse(semgrepErr.stdout.toString());
        } catch {
          throw new Error("Semgrep produced invalid JSON output");
        }
      } else {
        throw semgrepErr;
      }
    }

    const findings = parseSemgrepOutput(semgrepRaw, tmpDir);
    const fileTree = walkDir(tmpDir, tmpDir);

    const findingCountByDir = {};
    for (const f of findings) {
      const dir = path.dirname(f.filePath);
      findingCountByDir[f.filePath] = (findingCountByDir[f.filePath] || 0) + 1;
      if (dir !== ".") {
        findingCountByDir[dir] = (findingCountByDir[dir] || 0) + 1;
      }
    }

    const enrichedTree = fileTree.map((entry) => ({
      ...entry,
      findingCount: findingCountByDir[entry.path] || 0,
    }));

    res.json({
      success: true,
      commitSha,
      findings,
      fileTree: enrichedTree,
      stats: {
        total: findings.length,
        critical: findings.filter((f) => f.severity === "ERROR").length,
        warning: findings.filter((f) => f.severity === "WARNING").length,
        info: findings.filter((f) => f.severity === "INFO").length,
        filesScanned: fileTree.filter((e) => e.type === "file").length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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
  // eslint-disable-next-line no-console
  console.log(`Semgrep worker listening on port ${PORT}`);
});
