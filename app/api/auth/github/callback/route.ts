import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import clientPromise from "@/lib/mongodb"
import logger from "@/lib/logger"

/**
 * Handles the GitHub OAuth callback via Supabase
 * @param {NextRequest} req - Incoming request with auth code
 * @returns {NextResponse} Redirect to repo-scan page on success
 */
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      logger.error("GitHub OAuth callback failed", { error: error.message })
      return NextResponse.redirect(new URL("/dashboard/repo-scan?error=oauth_failed", requestUrl.origin))
    }

    if (data.user) {
      try {
        // Store GitHub connection in MongoDB
        const client = await clientPromise
        const db = client.db("DeployZen")

        const githubUsername = data.user.user_metadata?.user_name || data.user.user_metadata?.preferred_username
        const avatarUrl = data.user.user_metadata?.avatar_url

        await db.collection("users").updateOne(
          { supabaseId: data.user.id },
          {
            $set: {
              supabaseId: data.user.id,
              email: data.user.email,
              githubUsername,
              githubId: data.user.user_metadata?.provider_id,
              avatarUrl,
              connectedAt: new Date().toISOString(),
            },
          },
          { upsert: true }
        )

        logger.info("GitHub OAuth successful", { username: githubUsername })
      } catch (dbError) {
        logger.error("Failed to store user in MongoDB", { error: dbError })
      }
    }

    return NextResponse.redirect(new URL("/dashboard/repo-scan?connected=true", requestUrl.origin))
  }

  return NextResponse.redirect(new URL("/dashboard/repo-scan?error=missing_code", requestUrl.origin))
}
