import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { searchHuggingFaceModels } from "@/lib/huggingface"
import logger from "@/lib/logger"

/**
 * Proxies a model search request to the HF Hub API using the
 * authenticated user's token
 * @param {NextRequest} req - GET request with ?q=query&task=pipeline_tag
 * @returns {NextResponse} JSON with models array
 */
export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q") || ""
    const task = req.nextUrl.searchParams.get("task") || null

    if (!query.trim()) {
      return NextResponse.json({ success: false, error: "Search query is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const user = await db.collection("users").findOne({ hfAccessToken: { $exists: true } })
    if (!user?.hfAccessToken) {
      return NextResponse.json({ success: false, error: "Hugging Face not connected" }, { status: 401 })
    }

    const models = await searchHuggingFaceModels(query, task, user.hfAccessToken)
    return NextResponse.json({ success: true, models })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Search failed"
    logger.error("HF model search failed", { error: message })
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
