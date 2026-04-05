import { NextResponse } from "next/server"
import logger from "@/lib/logger"

/**
 * Initiates the GitHub OAuth flow by redirecting to GitHub's authorization page
 * @returns {NextResponse} Redirect to GitHub OAuth
 */
export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID
  const redirectUri = process.env.GITHUB_REDIRECT_URI

  if (!clientId || !redirectUri) {
    logger.error("GitHub OAuth not configured", { clientId: !!clientId, redirectUri: !!redirectUri })
    return NextResponse.json(
      { success: false, error: "GitHub OAuth not configured" },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo read:user",
    state: crypto.randomUUID(),
  })

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`)
}
