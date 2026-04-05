import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { checkHuggingFaceModelStatus } from "@/lib/huggingface"
import logger from "@/lib/logger"

/**
 * Performs a health check on a registered HF model by testing if it's
 * loaded on the Serverless Inference API
 * @param {NextRequest} _req - Incoming request (unused)
 * @param {object} context - Route params with model ID
 * @returns {NextResponse} JSON with status, estimatedTime, or error
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ status: "failed", error: "Invalid model ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const model = await db.collection("models").findOne({ _id: new ObjectId(id) })
    if (!model) {
      return NextResponse.json({ status: "failed", error: "Model not found" }, { status: 404 })
    }

    if (!model.huggingFaceModelId) {
      return NextResponse.json({ status: "failed", error: "No HF model ID associated" }, { status: 400 })
    }

    const user = await db.collection("users").findOne({ hfAccessToken: { $exists: true } })
    if (!user?.hfAccessToken) {
      return NextResponse.json({ status: "failed", error: "Hugging Face not connected" }, { status: 401 })
    }

    const hfStatus = await checkHuggingFaceModelStatus(model.huggingFaceModelId, user.hfAccessToken)

    if (hfStatus.unsupported) {
      await db.collection("models").updateOne(
        { _id: model._id },
        { $set: { status: "Failed", statusError: hfStatus.reason, lastActivity: new Date().toISOString() } }
      )
      return NextResponse.json({
        status: "failed",
        error: hfStatus.reason || "No inference provider available for this model",
      })
    }

    const newStatus = hfStatus.loaded ? "Running" : "Loading"
    if (newStatus !== model.status) {
      await db.collection("models").updateOne(
        { _id: model._id },
        { $set: { status: newStatus, lastActivity: new Date().toISOString() } }
      )
    }

    if (hfStatus.loaded) {
      return NextResponse.json({ status: "running", provider: hfStatus.provider })
    }

    return NextResponse.json({
      status: "loading",
      estimatedTime: hfStatus.estimatedTime || 30,
      provider: hfStatus.provider,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Health check failed"
    logger.error("Model health check failed", { id, error: message })
    return NextResponse.json({ status: "failed", error: message }, { status: 500 })
  }
}
