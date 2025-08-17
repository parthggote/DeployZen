import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import fs from "fs"
import path from "path"
import { getHuggingFaceInferenceEndpoint } from "@/lib/huggingface"

const DATA_DIR = path.join(process.cwd(), "data")
const MODELS_DIR = path.join(DATA_DIR, "models")

function ensureModelsDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true })
}

async function logActivity(message: string) {
  try {
    const client = await clientPromise;
    const db = client.db("DeployZen");
    await db.collection("activity_log").insertOne({
      timestamp: new Date(),
      feature: "Models",
      summary: message,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

export async function GET(req: NextRequest, { params }: { params: { rest?: string[] } }) {
  const rest = params.rest || []
  const client = await clientPromise
  const db = client.db("DeployZen")

  try {
    if (rest.length === 0) {
      const models = await db.collection("models").find({}).toArray()

      const modelUpdates = models.map(async (model) => {
        if (model.mode === 'huggingface' && model.huggingFaceEndpointName && model.status !== 'Running' && model.status !== 'Failed') {
          try {
            const hfEndpoint = await getHuggingFaceInferenceEndpoint(model.huggingFaceEndpointName);
            if (hfEndpoint && hfEndpoint.status !== model.status) {
              await db.collection("models").updateOne({ _id: model._id }, { $set: { status: hfEndpoint.status, huggingFaceEndpointUrl: hfEndpoint.url } });
              return { ...model, status: hfEndpoint.status, huggingFaceEndpointUrl: hfEndpoint.url };
            }
          } catch (error) {
            console.error(`Failed to update status for HF model ${model.modelName}:`, error);
          }
        }
        return model;
      });
      const updatedModels = await Promise.all(modelUpdates);

      const modelsWithId = updatedModels.map(m => ({ ...m, id: m._id.toString() }))
      return NextResponse.json({ success: true, models: modelsWithId })
    }

    if (rest[0] === 'logs') {
      const logs = await db.collection("activity_log").find({ feature: "Models" }).sort({ timestamp: -1 }).limit(100).toArray()
      const logsMarkdown = logs.map(log => `## ${log.timestamp.toISOString()}\n- Feature: ${log.feature}\n- Summary: ${log.summary}\n\n`).join('')
      return NextResponse.json({ success: true, logs: logsMarkdown || "# Activity Log\n\n📝 No model activities yet." })
    }

    const modelId = rest[0]
    if (!ObjectId.isValid(modelId)) {
      return NextResponse.json({ success: false, error: 'Invalid Model ID' }, { status: 400 })
    }
    const model = await db.collection("models").findOne({ _id: new ObjectId(modelId) })
    if (!model) return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 })

    if (rest[1] === 'test') {
      if (model.status !== 'Running') return NextResponse.json({ success: false, error: `Model status is ${model.status}` }, { status: 400 })
      return NextResponse.json({ success: true, status: 'running' })
    }

    if (rest[1] === 'keys') {
      const keys = await db.collection("api_keys").find({ modelId: new ObjectId(modelId) }).toArray()
      const list = keys.map(k => ({ keyId: k._id.toString(), prefix: k.prefix, createdAt: k.createdAt, revokedAt: k.revokedAt || null, masked: `${k.prefix}****************` }))
      return NextResponse.json({ success: true, keys: list })
    }
  } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message || "Failed to process request" }, { status: 500 })
  }

  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
}

export async function POST(req: NextRequest, { params }: { params: { rest?: string[] } }) {
    return NextResponse.json({ success: false, error: "This endpoint is deprecated. Use /api/activity for model deployment." }, { status: 400 })
}

export async function DELETE(_req: NextRequest, { params }: { params: { rest?: string[] } }) {
  const rest = params.rest || []
  const id = rest[0]
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Model ID required' }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db("DeployZen")

    const model = await db.collection("models").findOne({ _id: new ObjectId(id) })
    if (!model) {
      return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 })
    }

    if (model.filePath && !model.filePath.startsWith('http') && fs.existsSync(model.filePath)) {
      try {
        fs.unlinkSync(model.filePath)
        await logActivity(`🗑️ Deleted model file: ${model.filePath}`)
      } catch(e) {
        await logActivity(`⚠️ Could not delete model file: ${model.filePath}`)
      }
    }

    await db.collection("models").deleteOne({ _id: new ObjectId(id) })
    await logActivity(`❌ Model deleted: "${model.modelName}" (${model.mode} mode)`)

    return NextResponse.json({ success: true, message: 'Model deleted successfully' })
  } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message || "Failed to delete model" }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
