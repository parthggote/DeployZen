import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { exchangeCodeForToken, getAuthenticatedUser } from "@/lib/github"
import logger from "@/lib/logger"

/**
 * Handles the GitHub OAuth callback, exchanges the code for a token,
 * and upserts the user record in MongoDB
 * @param {NextRequest} req - Incoming request with ?code= query param
 * @returns {NextResponse} Redirect to repo-scan page on success
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")

  if (!code) {
    logger.warn("OAuth callback missing code parameter")
    return NextResponse.redirect(new URL("/dashboard/repo-scan?error=missing_code", req.url))
  }

  try {
    const tokenData = await exchangeCodeForToken(code)
    const user = await getAuthenticatedUser(tokenData.access_token)

    const client = await clientPromise
    const db = client.db("DeployZen")

    await db.collection("users").updateOne(
      { githubId: user.id },
      {
        $set: {
          githubUsername: user.login,
          githubAccessToken: tokenData.access_token,
          avatarUrl: user.avatar_url,
          connectedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    )

    logger.info("GitHub OAuth successful", { username: user.login })

    return NextResponse.redirect(new URL("/dashboard/repo-scan?connected=true", req.url))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("GitHub OAuth callback failed", { error: message })
    return NextResponse.redirect(new URL("/dashboard/repo-scan?error=oauth_failed", req.url))
  }
}
