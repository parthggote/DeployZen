import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getLatestCommitSha } from "@/lib/github"
import logger from "@/lib/logger"

const SEMGREP_WORKER_URL = process.env.SEMGREP_WORKER_URL || "http://localhost:4000"

interface ScanSummary {
  total: number
  critical: number
  warning: number
  info: number
  filesScanned: number
  topCategories: { name: string; count: number }[]
}

/**
 * Computes a summary from raw findings
 * @param {Array} findings - Semgrep findings array
 * @param {number} filesScanned - Total file count
 * @returns {ScanSummary} Aggregated summary
 */
function computeSummary(findings: Array<{ severity: string; category: string }>, filesScanned: number): ScanSummary {
  const categoryMap: Record<string, number> = {}

  for (const f of findings) {
    categoryMap[f.category] = (categoryMap[f.category] || 0) + 1
  }

  const topCategories = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    total: findings.length,
    critical: findings.filter((f) => f.severity === "ERROR").length,
    warning: findings.filter((f) => f.severity === "WARNING").length,
    info: findings.filter((f) => f.severity === "INFO").length,
    filesScanned,
    topCategories,
  }
}

/**
 * POST — Starts a new scan for a GitHub repository
 * @param {NextRequest} req - Request body: { repoFullName, branch? }
 * @returns {NextResponse} The created scan document
 */
export async function POST(req: NextRequest) {
  try {
    const { repoFullName, branch } = await req.json()

    if (!repoFullName) {
      return NextResponse.json(
        { success: false, error: "repoFullName is required" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const user = await db.collection("users").findOne(
      {},
      { sort: { connectedAt: -1 } }
    )

    if (!user?.githubAccessToken) {
      return NextResponse.json(
        { success: false, error: "GitHub not connected" },
        { status: 401 }
      )
    }

    const [owner, repo] = repoFullName.split("/")
    const targetBranch = branch || "main"

    let commitSha: string
    try {
      commitSha = await getLatestCommitSha(user.githubAccessToken, owner, repo, targetBranch)
    } catch {
      commitSha = await getLatestCommitSha(user.githubAccessToken, owner, repo, "master")
    }

    const scanDoc = {
      userId: user._id,
      repoFullName,
      branch: targetBranch,
      commitSha,
      status: "running" as const,
      startedAt: new Date().toISOString(),
      completedAt: null as string | null,
      fileTree: [] as Array<{ path: string; type: string; size?: number; findingCount: number }>,
      findings: [] as Array<Record<string, unknown>>,
      summary: null as ScanSummary | null,
      aiExplanations: {} as Record<string, string>,
      chatHistory: [] as Array<{ role: string; content: string; timestamp: string }>,
    }

    const insertResult = await db.collection("scans").insertOne(scanDoc)
    const scanId = insertResult.insertedId

    try {
      const workerRes = await fetch(`${SEMGREP_WORKER_URL}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName,
          accessToken: user.githubAccessToken,
          commitSha,
        }),
      })

      if (!workerRes.ok) {
        const errText = await workerRes.text()
        throw new Error(`Worker returned ${workerRes.status}: ${errText}`)
      }

      const result = await workerRes.json()

      const summary = computeSummary(
        result.findings || [],
        result.stats?.filesScanned || 0
      )

      await db.collection("scans").updateOne(
        { _id: scanId },
        {
          $set: {
            status: "completed",
            completedAt: new Date().toISOString(),
            fileTree: result.fileTree || [],
            findings: result.findings || [],
            summary,
          },
        }
      )

      const updatedScan = await db.collection("scans").findOne({ _id: scanId })
      return NextResponse.json({ success: true, scan: updatedScan }, { status: 201 })
    } catch (workerError: unknown) {
      const message = workerError instanceof Error ? workerError.message : "Unknown error"
      logger.error("Semgrep worker scan failed", { scanId: scanId.toString(), error: message })

      await db.collection("scans").updateOne(
        { _id: scanId },
        {
          $set: {
            status: "failed",
            completedAt: new Date().toISOString(),
            error: message,
          },
        }
      )

      return NextResponse.json(
        { success: false, error: `Scan failed: ${message}`, scanId: scanId.toString() },
        { status: 502 }
      )
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Scan creation failed", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET — Lists all scans, ordered by most recent first
 * @returns {NextResponse} Array of scan documents
 */
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")

    const scans = await db
      .collection("scans")
      .find({})
      .project({
        repoFullName: 1,
        branch: 1,
        commitSha: 1,
        status: 1,
        startedAt: 1,
        completedAt: 1,
        summary: 1,
      })
      .sort({ startedAt: -1 })
      .limit(50)
      .toArray()

    return NextResponse.json({ success: true, scans })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to list scans", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
