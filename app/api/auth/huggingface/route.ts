import { NextResponse } from "next/server"
import logger from "@/lib/logger"

/**
 * Initiates the Hugging Face OAuth flow by redirecting to HF's authorization page
 * @returns {NextResponse} Redirect to HF OAuth
 */
export async function GET() {
  const clientId = process.env.HF_CLIENT_ID
  const redirectUri = process.env.HF_REDIRECT_URI

  if (!clientId || !redirectUri) {
    logger.error("Hugging Face OAuth not configured", { clientId: !!clientId, redirectUri: !!redirectUri })
    return NextResponse.json(
      { success: false, error: "Hugging Face OAuth not configured" },
      { status: 500 }
    )
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile inference-api",
    response_type: "code",
    state: crypto.randomUUID(),
  })

  return NextResponse.redirect(`https://huggingface.co/oauth/authorize?${params.toString()}`)
}
