import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import logger from "@/lib/logger"

/**
 * Exchanges an HF OAuth code for an access token
 * @param {string} code - Authorization code from HF redirect
 * @returns {Promise<{access_token: string}>} Token data
 */
async function exchangeHFCode(code: string): Promise<{ access_token: string }> {
  const clientId = process.env.HF_CLIENT_ID
  const clientSecret = process.env.HF_CLIENT_SECRET
  const redirectUri = process.env.HF_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("HF OAuth credentials not configured")
  }

  const res = await fetch("https://huggingface.co/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HF token exchange failed: ${res.status} ${text}`)
  }

  return res.json()
}

/**
 * Fetches the authenticated HF user profile
 * @param {string} token - HF access token
 * @returns {Promise<{name: string, fullname: string}>} User profile
 */
async function getHFUser(token: string): Promise<{ name: string; fullname: string }> {
  const res = await fetch("https://huggingface.co/api/whoami-v2", {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`HF whoami failed: ${res.status}`)
  }

  return res.json()
}

/**
 * Handles the HF OAuth callback, exchanges code for token, upserts user record
 * @param {NextRequest} req - Incoming request with ?code= query param
 * @returns {NextResponse} Redirect to upload-model page
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")

  if (!code) {
    logger.warn("HF OAuth callback missing code parameter")
    return NextResponse.redirect(new URL("/dashboard/upload-model?hf_error=missing_code", req.url))
  }

  try {
    const tokenData = await exchangeHFCode(code)
    const user = await getHFUser(tokenData.access_token)

    const client = await clientPromise
    const db = client.db("DeployZen")

    await db.collection("users").updateOne(
      { githubId: { $exists: true } },
      {
        $set: {
          hfUsername: user.name,
          hfAccessToken: tokenData.access_token,
          hfConnectedAt: new Date().toISOString(),
        },
      },
      { upsert: false }
    )

    logger.info("HF OAuth successful", { username: user.name })
    return NextResponse.redirect(new URL("/dashboard/upload-model?hf_connected=true", req.url))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("HF OAuth callback failed", { error: message })
    return NextResponse.redirect(new URL("/dashboard/upload-model?hf_error=oauth_failed", req.url))
  }
}
