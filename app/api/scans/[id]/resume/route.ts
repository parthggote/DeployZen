import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import logger from "@/lib/logger"

/**
 * POST — Re-queues a failed scan so the worker resumes from where it left off.
 * Preserves existing findings, file tree, and tracks which directories were
 * already scanned so the worker can skip them.
 * @param {NextRequest} _req - Incoming request (body unused)
 * @param {object} context - Route params containing scan ID
 * @returns {NextResponse} Success with scanId or error
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid scan ID" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const scan = await db.collection("scans").findOne({ _id: new ObjectId(id) })

    if (!scan) {
      return NextResponse.json(
        { success: false, error: "Scan not found" },
        { status: 404 }
      )
    }

    if (scan.status !== "failed") {
      return NextResponse.json(
        { success: false, error: "Only failed scans can be resumed" },
        { status: 400 }
      )
    }

    const currentUser = await db.collection("users").findOne(
      { githubAccessToken: { $exists: true, $ne: null } },
      { sort: { connectedAt: -1 } }
    )

    if (!currentUser?.githubAccessToken) {
      return NextResponse.json(
        { success: false, error: "GitHub not connected" },
        { status: 401 }
      )
    }

    const scannedDirs: string[] = scan.progress?.scannedDirs || []
    const previousPercent = typeof scan.progress?.percent === "number" ? scan.progress.percent : 0

    const updateFields: Record<string, unknown> = {
      status: "queued",
      error: null,
      resumeFrom: { scannedDirs },
      progress: {
        stage: "Resuming — waiting for worker…",
        percent: Math.max(previousPercent, 2),
        updatedAt: new Date().toISOString(),
        scannedDirs,
      },
    }

    if (!scan.userId || !await db.collection("users").findOne({ _id: scan.userId })) {
      updateFields.userId = currentUser._id
    }

    await db.collection("scans").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    )

    logger.info("Scan resumed", {
      scanId: id,
      repo: scan.repoFullName,
      scannedDirsBefore: scannedDirs.length,
    })

    return NextResponse.json({
      success: true,
      scanId: id,
      resumedFrom: scannedDirs.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to resume scan", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
