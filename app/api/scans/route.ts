import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { getLatestCommitSha } from "@/lib/github"
import logger from "@/lib/logger"

interface ScanSummary {
  total: number
  critical: number
  warning: number
  info: number
  filesScanned: number
  topCategories: { name: string; count: number }[]
}

/**
 * POST — Creates a scan record in "queued" status.
 * Workers pick up queued scans via /api/queue/next.
 * @param {NextRequest} req - Request body: { repoFullName, branch? }
 * @returns {NextResponse} The scan ID
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
      status: "queued" as const,
      startedAt: new Date().toISOString(),
      completedAt: null as string | null,
      fileTree: [] as Array<{ path: string; type: string; size?: number; findingCount: number }>,
      findings: [] as Array<Record<string, unknown>>,
      summary: null as ScanSummary | null,
      progress: { stage: "Queued", percent: 2, updatedAt: new Date().toISOString() },
      aiExplanations: {} as Record<string, string>,
      chatHistory: [] as Array<{ role: string; content: string; timestamp: string }>,
    }

    const insertResult = await db.collection("scans").insertOne(scanDoc)
    const scanId = insertResult.insertedId

    logger.info("Scan queued", { scanId: scanId.toString(), repo: repoFullName })

    return NextResponse.json(
      {
        success: true,
        scanId: scanId.toString(),
        status: "queued",
      },
      { status: 202 }
    )
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
        progress: 1,
        error: 1,
        batchErrors: 1,
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
