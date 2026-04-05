import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { getHuggingFaceModelInfo, checkHuggingFaceModelStatus } from "@/lib/huggingface"
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
    logger.error("Error writing to activity log", { error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * Infers a display status from an activity summary string
 * @param {string} summary - Activity summary text
 * @returns {"success" | "error" | "pending"} Inferred status
 */
function inferActivityStatus(summary: string): "success" | "error" | "pending" {
  const normalized = summary.toLowerCase()
  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("could not")) {
    return "error"
  }
  if (normalized.includes("initiated") || normalized.includes("initializing") || normalized.includes("pending")) {
    return "pending"
  }
  return "success"
}

/**
 * Infers an activity type from feature name and summary text
 * @param {string} feature - Feature category
 * @param {string} summary - Activity summary
 * @returns {"upload" | "test" | "deployment" | "kanban" | "other"} Activity type
 */
function inferActivityType(feature: string, summary: string): "upload" | "test" | "deployment" | "kanban" | "other" {
  const featureValue = feature.toLowerCase()
  const summaryValue = summary.toLowerCase()
  if (featureValue.includes("kanban")) return "kanban"
  if (summaryValue.includes("test")) return "test"
  if (summaryValue.includes("upload")) return "upload"
  if (featureValue.includes("model") || summaryValue.includes("deploy")) return "deployment"
  return "other"
}

/**
 * Returns recent activity log entries
 * @returns {NextResponse} JSON with activities array
 */
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")
    const logs = await db.collection("activity_log").find({}).sort({ timestamp: -1 }).limit(50).toArray()

    const activities = logs.map((log: Record<string, unknown>) => {
      const summary = (log.summary as string) || "No summary available"
      const feature = (log.feature as string) || "Activity"
      const timestamp = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp as string)

      return {
        id: log._id?.toString?.() || `${feature}-${timestamp.toISOString()}`,
        title: feature,
        description: summary,
        time: timestamp.toLocaleString(),
        status: inferActivityStatus(summary),
        type: inferActivityType(feature, summary),
      }
    })

    return NextResponse.json({ success: true, activities })
  } catch (error: unknown) {
    logger.error("Failed to load activity feed", { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ success: false, error: "Failed to load activity feed", activities: [] }, { status: 500 })
  }
}

/**
 * Registers a new HF model deployment. Accepts JSON with modelName,
 * huggingFaceModelId, and task. Validates the model on HF Hub and
 * stores a record in the models collection.
 * @param {NextRequest} request - Incoming POST request
 * @returns {NextResponse} JSON with modelId or error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { modelName, huggingFaceModelId, task } = body as {
      modelName?: string
      huggingFaceModelId?: string
      task?: string
    }

    if (!modelName?.trim()) {
      return NextResponse.json({ success: false, error: "Model name is required" }, { status: 400 })
    }

    if (!huggingFaceModelId?.trim()) {
      return NextResponse.json({ success: false, error: "Hugging Face model ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const existingModel = await db.collection("models").findOne({ modelName })
    if (existingModel) {
      return NextResponse.json({ success: false, error: "Model name already exists" }, { status: 400 })
    }

    const user = await db.collection("users").findOne({ hfAccessToken: { $exists: true } })
    if (!user?.hfAccessToken) {
      return NextResponse.json({ success: false, error: "Connect your Hugging Face account first" }, { status: 401 })
    }

    let modelInfo
    try {
      modelInfo = await getHuggingFaceModelInfo(huggingFaceModelId, user.hfAccessToken)
    } catch {
      return NextResponse.json({ success: false, error: `Model not found on HF Hub: ${huggingFaceModelId}` }, { status: 404 })
    }

    const resolvedTask = task || modelInfo.pipeline_tag || "text-generation"

    const modelId = new ObjectId()
    const modelDoc = {
      _id: modelId,
      userId: user._id,
      modelName,
      huggingFaceModelId,
      task: resolvedTask,
      status: "Pending" as const,
      config: { maxTokens: 256, temperature: 0.7, topP: 0.9 },
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      metrics: { totalRequests: 0, avgLatencyMs: 0, lastError: null },
    }

    await db.collection("models").insertOne(modelDoc)
    await logActivity(`Model registered: "${modelName}" (${huggingFaceModelId}, task: ${resolvedTask})`)

    const status = await checkHuggingFaceModelStatus(huggingFaceModelId, user.hfAccessToken)
    const newStatus = status.loaded ? "Running" : "Loading"
    await db.collection("models").updateOne(
      { _id: modelId },
      { $set: { status: newStatus } }
    )

    return NextResponse.json({
      success: true,
      modelId: modelId.toString(),
      status: newStatus,
      message: status.loaded
        ? "Model is ready for inference"
        : `Model is loading (est. ${status.estimatedTime || 30}s). It will be ready when first inference is called.`,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Deployment error", { error: message })
    await logActivity(`Deployment error: ${message}`)
    return NextResponse.json({ success: false, error: "Deployment failed" }, { status: 500 })
  }
}
