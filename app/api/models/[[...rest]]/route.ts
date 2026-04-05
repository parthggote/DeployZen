import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { checkHuggingFaceModelStatus } from "@/lib/huggingface"
import logger from "@/lib/logger"

/**
 * Logs a model-related activity event to the activity_log collection
 * @param {string} message - Activity summary
 */
async function logActivity(message: string) {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")
    await db.collection("activity_log").insertOne({
      timestamp: new Date(),
      feature: "Models",
      summary: message,
    })
  } catch (error: unknown) {
    logger.error("Error logging activity", { error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * GET handler for model listing, logs, and individual model data
 * @param {NextRequest} req - The incoming request
 * @param {object} context - Route params containing optional rest segments
 * @returns {NextResponse} JSON with models, logs, or model details
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest: restParam } = await params
  const rest = restParam || []
  const client = await clientPromise
  const db = client.db("DeployZen")

  try {
    if (rest.length === 0) {
      const models = await db.collection("models").find({}).toArray()
      const user = await db.collection("users").findOne({ hfAccessToken: { $exists: true } })
      const hfToken = user?.hfAccessToken

      const modelUpdates = models.map(async (model) => {
        if (!model.huggingFaceModelId || !hfToken) return model
        if (model.status === "Running" || model.status === "Failed") return model

        try {
          const hfStatus = await checkHuggingFaceModelStatus(model.huggingFaceModelId, hfToken)

          let newStatus: string
          if (hfStatus.unsupported) {
            newStatus = "Failed"
          } else if (hfStatus.loaded) {
            newStatus = "Running"
          } else {
            newStatus = "Loading"
          }

          if (newStatus !== model.status) {
            const updates: Record<string, unknown> = { status: newStatus, lastActivity: new Date().toISOString() }
            if (hfStatus.unsupported && hfStatus.reason) {
              updates.statusError = hfStatus.reason
            }
            if (hfStatus.provider) {
              updates.inferenceProvider = hfStatus.provider
            }
            await db.collection("models").updateOne({ _id: model._id }, { $set: updates })
            return { ...model, ...updates }
          }
        } catch (error: unknown) {
          logger.warn("Failed to refresh HF model status", {
            model: model.modelName,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        return model
      })

      const updatedModels = await Promise.all(modelUpdates)
      const modelsWithId = updatedModels.map((m) => ({ ...m, id: m._id.toString() }))
      return NextResponse.json({ success: true, models: modelsWithId })
    }

    if (rest[0] === "logs") {
      const logs = await db
        .collection("activity_log")
        .find({ feature: "Models" })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray()

      const logsMarkdown = logs
        .map((log) => `## ${log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp}\n- Summary: ${log.summary}\n\n`)
        .join("")

      return NextResponse.json({ success: true, logs: logsMarkdown || "# Activity Log\n\nNo model activities yet." })
    }

    const modelId = rest[0]
    if (!ObjectId.isValid(modelId)) {
      return NextResponse.json({ success: false, error: "Invalid Model ID" }, { status: 400 })
    }

    const model = await db.collection("models").findOne({ _id: new ObjectId(modelId) })
    if (!model) {
      return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, model: { ...model, id: model._id.toString() } })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to process request"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE handler — removes a model record from MongoDB
 * @param {NextRequest} _req - Incoming request (unused)
 * @param {object} context - Route params with model ID
 * @returns {NextResponse} Success or error JSON
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest: restParam } = await params
  const rest = restParam || []
  const id = rest[0]

  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: "Model ID required" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db("DeployZen")

    const model = await db.collection("models").findOne({ _id: new ObjectId(id) })
    if (!model) {
      return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 })
    }

    await db.collection("models").deleteOne({ _id: new ObjectId(id) })
    await db.collection("inference_metrics").deleteMany({ modelId: new ObjectId(id) })
    await logActivity(`Model deleted: "${model.modelName}"`)

    return NextResponse.json({ success: true, message: "Model deleted successfully" })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to delete model"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * OPTIONS handler for CORS preflight
 * @returns {NextResponse} Empty 204 with CORS headers
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}
