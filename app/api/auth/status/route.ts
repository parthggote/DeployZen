import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import clientPromise from "@/lib/mongodb"
import logger from "@/lib/logger"

/**
 * Returns the current user's auth status including GitHub and HF connections
 * @returns {NextResponse} JSON with user connection info
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ success: true, user: null })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const user = await db.collection("users").findOne(
      { supabaseId: authUser.id },
      {
        projection: {
          githubUsername: 1,
          hfUsername: 1,
          hfConnectedAt: 1,
          email: 1,
          _id: 0,
        },
      }
    )

    return NextResponse.json({ 
      success: true, 
      user: user || { 
        email: authUser.email,
        supabaseId: authUser.id 
      } 
    })
  } catch (error: unknown) {
    logger.error("Auth status check failed", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ success: false, error: "Failed to check auth status" }, { status: 500 })
  }
}
