import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import clientPromise from "@/lib/mongodb"
import logger from "@/lib/logger"

/**
 * Disconnects the Hugging Face account by removing the stored access token
 * @returns {NextResponse} Success or error
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      )
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const result = await db.collection("users").updateOne(
      { supabaseId: user.id },
      { $unset: { hfUsername: "", hfAccessToken: "", hfConnectedAt: "" } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: "No Hugging Face account connected" },
        { status: 404 }
      )
    }

    logger.info("Hugging Face account disconnected", { userId: user.id })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to disconnect HF", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
