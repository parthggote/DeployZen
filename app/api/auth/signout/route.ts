import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"

/**
 * Signs out the current user from Supabase
 * @returns {NextResponse} JSON response
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      logger.error("Sign out failed", { error: error.message })
      return NextResponse.json(
        { success: false, error: "Failed to sign out" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    logger.error("Sign out error", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { success: false, error: "Failed to sign out" },
      { status: 500 }
    )
  }
}
