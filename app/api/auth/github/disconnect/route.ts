import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import logger from "@/lib/logger"

/**
 * POST — Disconnects the GitHub account by removing the stored access token
 * @returns {NextResponse} Success or error
 */
export async function POST() {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")

    const user = await db.collection("users").findOne(
      {},
      { sort: { connectedAt: -1 } }
    )

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No GitHub account connected" },
        { status: 404 }
      )
    }

    await db.collection("users").deleteOne({ _id: user._id })

    logger.info("GitHub account disconnected", { username: user.githubUsername })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to disconnect GitHub", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
