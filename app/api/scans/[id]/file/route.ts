import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { getFileContent } from "@/lib/github"
import logger from "@/lib/logger"

/**
 * GET — Fetches file content from GitHub at the scan's pinned commit SHA
 * @param {NextRequest} req - Request with ?path= query param
 * @param {object} context - Route params containing scan ID
 * @returns {NextResponse} File content as text
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const filePath = req.nextUrl.searchParams.get("path")

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid scan ID" },
        { status: 400 }
      )
    }

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "path query parameter is required" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const scan = await db.collection("scans").findOne(
      { _id: new ObjectId(id) },
      { projection: { repoFullName: 1, commitSha: 1, userId: 1 } }
    )

    if (!scan) {
      return NextResponse.json(
        { success: false, error: "Scan not found" },
        { status: 404 }
      )
    }

    const user = await db.collection("users").findOne({ _id: scan.userId })

    if (!user?.githubAccessToken) {
      return NextResponse.json(
        { success: false, error: "GitHub not connected" },
        { status: 401 }
      )
    }

    const [owner, repo] = scan.repoFullName.split("/")
    const content = await getFileContent(
      user.githubAccessToken,
      owner,
      repo,
      filePath,
      scan.commitSha
    )

    return NextResponse.json({ success: true, content, path: filePath })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to fetch file content", { error: message })
    return NextResponse.json(
      { success: false, error: "Failed to fetch file content" },
      { status: 500 }
    )
  }
}
