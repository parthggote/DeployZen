import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import logger from "@/lib/logger"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
const WORKER_SECRET = process.env.WORKER_SECRET || ""

/**
 * POST — Atomically claims the oldest queued scan job for a worker.
 * Workers poll this endpoint to pick up work.
 * @param {NextRequest} req - Request body: { workerId }
 * @returns {NextResponse} Job details or { job: null } when queue is empty
 */
export async function POST(req: NextRequest) {
  try {
    if (WORKER_SECRET) {
      const auth = req.headers.get("authorization") || ""
      if (auth !== `Bearer ${WORKER_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const { workerId } = await req.json()

    if (!workerId) {
      return NextResponse.json({ error: "workerId is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const scan = await db.collection("scans").findOneAndUpdate(
      { status: "queued" },
      {
        $set: {
          status: "running",
          workerId,
          claimedAt: new Date().toISOString(),
          progress: {
            stage: "Connecting to worker...",
            percent: 8,
            updatedAt: new Date().toISOString(),
          },
        },
      },
      {
        sort: { startedAt: 1 },
        returnDocument: "after",
      }
    )

    if (!scan) {
      return NextResponse.json({ job: null })
    }

    const user = await db.collection("users").findOne({ _id: scan.userId })

    if (!user?.githubAccessToken) {
      await db.collection("scans").updateOne(
        { _id: scan._id },
        {
          $set: {
            status: "failed",
            error: "GitHub access token not found for this user",
            completedAt: new Date().toISOString(),
            progress: { stage: "Failed", percent: 0, updatedAt: new Date().toISOString() },
          },
        }
      )

      logger.error("Queue claim failed — no GitHub token", { scanId: scan._id.toString() })
      return NextResponse.json({ job: null })
    }

    const callbackUrl = `${APP_URL}/api/scans/${scan._id.toString()}/findings`

    logger.info("Job claimed by worker", {
      scanId: scan._id.toString(),
      workerId,
      repo: scan.repoFullName,
    })

    return NextResponse.json({
      job: {
        scanId: scan._id.toString(),
        repoFullName: scan.repoFullName,
        commitSha: scan.commitSha,
        branch: scan.branch,
        accessToken: user.githubAccessToken,
        callbackUrl,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Queue claim error", { error: message })
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
