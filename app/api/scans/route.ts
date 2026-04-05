import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { getLatestCommitSha } from "@/lib/github"
import logger from "@/lib/logger"

const SEMGREP_WORKER_URL = process.env.SEMGREP_WORKER_URL || "http://localhost:4000"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
const WORKER_RETRY_ATTEMPTS = 5
const WORKER_RETRY_BASE_MS = 15_000

interface ScanSummary {
  total: number
  critical: number
  warning: number
  info: number
  filesScanned: number
  topCategories: { name: string; count: number }[]
}

/**
 * Updates scan progress stage in MongoDB
 * @param {ObjectId} scanId - Scan document ID
 * @param {string} stage - Current progress stage label
 * @param {number} percent - Estimated progress percentage
 */
async function updateProgress(scanId: ObjectId, stage: string, percent: number) {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")
    await db.collection("scans").updateOne(
      { _id: scanId },
      { $set: { progress: { stage, percent, updatedAt: new Date().toISOString() } } }
    )
  } catch {
    /* best-effort progress update */
  }
}

/**
 * Runs the full scan pipeline in the background after the response is sent
 * @param {ObjectId} scanId - Scan document ID
 * @param {string} repoFullName - GitHub repo (owner/name)
 * @param {string} accessToken - GitHub OAuth token
 * @param {string} commitSha - Pinned commit SHA
 */
async function processScanInBackground(
  scanId: ObjectId,
  repoFullName: string,
  accessToken: string,
  commitSha: string,
  branch: string
) {
  const callbackUrl = `${APP_URL}/api/scans/${scanId.toString()}/findings`
  const payload = JSON.stringify({
    repoFullName,
    accessToken,
    commitSha,
    branch,
    callbackUrl,
    scanId: scanId.toString(),
  })

  try {
    await updateProgress(scanId, "Connecting to worker...", 10)

    let accepted = false

    for (let attempt = 0; attempt < WORKER_RETRY_ATTEMPTS; attempt++) {
      const workerRes = await fetch(`${SEMGREP_WORKER_URL}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      })

      if (workerRes.ok) {
        await workerRes.json()
        accepted = true
        break
      }

      if (workerRes.status === 429 && attempt < WORKER_RETRY_ATTEMPTS - 1) {
        const waitMs = WORKER_RETRY_BASE_MS * (attempt + 1)
        logger.info("Worker busy, retrying", {
          scanId: scanId.toString(),
          attempt: attempt + 1,
          waitMs,
        })
        await updateProgress(scanId, `Worker busy, retrying in ${Math.round(waitMs / 1000)}s...`, 8)
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }

      const errText = await workerRes.text()
      throw new Error(`Worker returned ${workerRes.status}: ${errText}`)
    }

    if (!accepted) {
      throw new Error("Worker did not accept scan after retries")
    }

    logger.info("Scan accepted by worker", { scanId: scanId.toString() })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Background scan failed", { scanId: scanId.toString(), error: message })

    const client = await clientPromise
    const db = client.db("DeployZen")

    await db.collection("scans").updateOne(
      { _id: scanId },
      {
        $set: {
          status: "failed",
          completedAt: new Date().toISOString(),
          error: message,
          progress: { stage: "Failed", percent: 0, updatedAt: new Date().toISOString() },
        },
      }
    )
  }
}

/**
 * POST — Creates a scan record and kicks off background processing
 * @param {NextRequest} req - Request body: { repoFullName, branch? }
 * @returns {NextResponse} The scan ID immediately (processing continues in background)
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
      progress: { stage: "Initializing...", percent: 5, updatedAt: new Date().toISOString() },
      aiExplanations: {} as Record<string, string>,
      chatHistory: [] as Array<{ role: string; content: string; timestamp: string }>,
    }

    const insertResult = await db.collection("scans").insertOne(scanDoc)
    const scanId = insertResult.insertedId

    after(() => processScanInBackground(scanId, repoFullName, user.githubAccessToken, commitSha, targetBranch))

    return NextResponse.json(
      {
        success: true,
        scanId: scanId.toString(),
        status: "running",
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
