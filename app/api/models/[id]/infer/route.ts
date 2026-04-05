import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { runHuggingFaceInference } from "@/lib/huggingface"
import logger from "@/lib/logger"

/**
 * Proxies an inference request to the HF Serverless Inference API for a
 * registered model. Logs latency and error metrics.
 * @param {NextRequest} request - JSON body with { inputs, parameters }
 * @param {object} context - Route params with model ID
 * @returns {NextResponse} Inference result or error
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const start = Date.now()

  try {
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid model ID" }, { status: 400 })
    }

    const body = await request.json()
    const { inputs, parameters = {} } = body as {
      inputs: unknown
      parameters?: Record<string, unknown>
    }

    if (!inputs) {
      return NextResponse.json({ success: false, error: "inputs field is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const model = await db.collection("models").findOne({ _id: new ObjectId(id) })
    if (!model) {
      return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 })
    }

    if (!model.huggingFaceModelId) {
      return NextResponse.json({ success: false, error: "No HF model ID associated" }, { status: 400 })
    }

    const user = await db.collection("users").findOne({ hfAccessToken: { $exists: true } })
    if (!user?.hfAccessToken) {
      return NextResponse.json({ success: false, error: "Hugging Face not connected" }, { status: 401 })
    }

    const mergedParams = {
      max_new_tokens: model.config?.maxTokens || 256,
      temperature: model.config?.temperature || 0.7,
      top_p: model.config?.topP || 0.9,
      ...parameters,
    }

    const result = await runHuggingFaceInference(
      model.huggingFaceModelId,
      inputs,
      mergedParams,
      user.hfAccessToken,
      model.inferenceProvider || undefined,
      model.inferenceProviderId || undefined,
      model.task || "text-generation"
    )

    await db.collection("inference_metrics").insertOne({
      modelId: model._id,
      modelName: model.modelName,
      huggingFaceModelId: model.huggingFaceModelId,
      task: model.task,
      latencyMs: result.latencyMs,
      success: result.success,
      error: result.error || null,
      timestamp: new Date(),
    })

    if (result.success) {
      await db.collection("models").updateOne(
        { _id: model._id },
        {
          $set: { status: "Running", lastActivity: new Date().toISOString() },
          $inc: { "metrics.totalRequests": 1 },
        }
      )
    }

    if (result.isLoading) {
      return NextResponse.json({
        success: false,
        error: result.error,
        isLoading: true,
        estimatedTime: result.estimatedTime,
      }, { status: 503 })
    }

    return NextResponse.json({
      success: result.success,
      output: result.output,
      latencyMs: result.latencyMs,
      error: result.error,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Inference failed"
    logger.error("Inference proxy error", { id, error: message, latencyMs: Date.now() - start })
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
