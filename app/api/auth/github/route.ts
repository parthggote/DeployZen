import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import logger from "@/lib/logger"

/**
 * Initiates the GitHub OAuth flow via Supabase
 * @returns {NextResponse} Redirect to GitHub OAuth
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: redirectUrl,
        scopes: 'repo read:user',
      },
    })

    if (error) {
      logger.error("GitHub OAuth initiation failed", { error: error.message })
      return NextResponse.json(
        { success: false, error: "Failed to initiate GitHub OAuth" },
        { status: 500 }
      )
    }

    return NextResponse.redirect(data.url)
  } catch (error: unknown) {
    logger.error("GitHub OAuth error", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { success: false, error: "GitHub OAuth not configured" },
      { status: 500 }
    )
  }
}
