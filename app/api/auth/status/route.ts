import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import logger from "@/lib/logger"

/**
 * Returns the current user's auth status including GitHub and HF connections
 * @returns {NextResponse} JSON with user connection info
 */
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")

    const user = await db.collection("users").findOne(
      { githubId: { $exists: true } },
      {
        projection: {
          githubUsername: 1,
          hfUsername: 1,
          hfConnectedAt: 1,
          _id: 0,
        },
      }
    )

    if (!user) {
      return NextResponse.json({ success: true, user: null })
    }

    return NextResponse.json({ success: true, user })
  } catch (error: unknown) {
    logger.error("Auth status check failed", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ success: false, error: "Failed to check auth status" }, { status: 500 })
  }
}
