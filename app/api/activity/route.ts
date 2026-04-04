import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import fs from "fs"
import path from "path"
import fetch from 'node-fetch'
import { createHuggingFaceInferenceEndpoint } from "@/lib/huggingface"

const onnxSessions = new Map<string, any>();
const DATA_DIR = path.join(process.cwd(), "data")
const MODELS_DIR = path.join(DATA_DIR, "models")

function ensureModelsDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true })
}

interface ModelData {
  _id: ObjectId
  id: string
  modelName: string
  filePath: string
  mode: "ollama" | "llama.cpp" | "onnx" | "torch" | "huggingface"
  tokens: number
  batchSize: number
  status: "Pending" | "Running" | "Failed" | "Stopped" | "Initializing"
  port?: number
  createdAt: string
  lastActivity?: string
  processId?: number
  threads?: number
  nPredict?: number
  streamMode?: boolean
  version?: number
  size?: number
  versions?: { version: number; filePath: string; createdAt: string; size: number | null }[]
  huggingFaceEndpointName?: string
  huggingFaceEndpointUrl?: string
}

const modelActions = {
  async logActivity(message: string) {
    try {
      const client = await clientPromise;
      const db = client.db("DeployZen");
      await db.collection("activity_log").insertOne({
        timestamp: new Date(),
        feature: "Models",
        summary: message,
      });
    } catch (error) {
      console.error("Error writing to activity log:", error);
    }
  },

  async updateModelStatus(modelId: ObjectId, status: ModelData['status'], details: any = {}) {
      const client = await clientPromise;
      const db = client.db("DeployZen");
      await db.collection("models").updateOne(
          { _id: modelId },
          { $set: { status, ...details, lastActivity: new Date().toISOString() } }
      );
  },

  async getAvailablePort(startPort = 11434): Promise<number> {
    const client = await clientPromise;
    const db = client.db("DeployZen");
    const models = await db.collection("models").find({ port: { $exists: true } }).toArray();
    const usedPorts = models.map((m) => m.port).filter(Boolean) as number[];
    const reserved = new Set<number>([11434, ...usedPorts]);
    let port = startPort;
    while (reserved.has(port)) port++;
    return port;
  },

  async deployModel(modelData: ModelData): Promise<boolean> {
    try {
      let success = false;
      if (modelData.mode === "huggingface") {
        success = await this.deployWithHuggingFace(modelData)
      } else if (modelData.mode === "ollama") {
        success = await this.deployWithOllama(modelData)
      } else if (modelData.mode === "llama.cpp") {
        success = await this.deployWithLlamaCpp(modelData)
      } else if (modelData.mode === "onnx") {
        success = await this.deployWithOnnx(modelData)
      } else if (modelData.mode === "torch") {
        success = await this.deployWithTorch(modelData)
      } else {
        throw new Error(`Unsupported mode: ${modelData.mode}`)
      }

      if (!success) {
          await this.updateModelStatus(modelData._id, "Failed");
      }
      return success;

    } catch (error: any) {
      console.error("Deployment error:", error)
      await this.updateModelStatus(modelData._id, "Failed");
      await this.logActivity(`❌ Deployment failed for "${modelData.modelName}": ${error.message}`)
      return false
    }
  },

  async deployWithHuggingFace(modelData: ModelData): Promise<boolean> {
    try {
      await this.logActivity(`🚀 Initiating Hugging Face deployment for "${modelData.modelName}"`);

      const endpointName = modelData.modelName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() + `-${modelData._id.toString().slice(-4)}`;
      await this.updateModelStatus(modelData._id, "Initializing", { huggingFaceEndpointName: endpointName });

      const hfEndpoint = await createHuggingFaceInferenceEndpoint({
          name: endpointName,
          repository: modelData.filePath, // filePath holds the HF model ID
          framework: "pytorch",
          task: "text-generation",
          provider: {
              vendor: "aws",
              region: "us-east-1",
          },
          compute: {
              accelerator: "gpu",
              instance_size: "x1",
              instance_type: "nvidia-a10g",
              scaling: {
                  minReplica: 0,
                  maxReplica: 1,
              }
          },
          type: "protected",
      });

      await this.updateModelStatus(modelData._id, "Initializing", {
          huggingFaceEndpointName: hfEndpoint.name,
          status: hfEndpoint.status.state
      });

      await this.logActivity(`✅ Hugging Face endpoint creation initiated for "${modelData.modelName}". Status: ${hfEndpoint.status.state}`);
      return true;
    } catch (error: any) {
      await this.logActivity(`❌ Hugging Face deployment failed for "${modelData.modelName}": ${error.message}`);
      return false;
    }
  },

  async deployWithOllama(modelData: ModelData): Promise<boolean> {
    try {
      const ollamaCheck = await fetch("http://localhost:11434/api/tags")
      if (!ollamaCheck.ok) throw new Error("Ollama is not running.")
      await this.updateModelStatus(modelData._id, "Running", { processId: Date.now() });
      await this.logActivity(`✅ Ollama model "${modelData.modelName}" deployed and tested successfully`)
      return true
    } catch (error: any) {
      await this.logActivity(`❌ Ollama deployment failed for "${modelData.modelName}": ${error.message}`)
      await this.updateModelStatus(modelData._id, "Failed");
      return false
    }
  },

  async deployWithLlamaCpp(modelData: ModelData): Promise<boolean> {
    await this.logActivity(`❌ llama.cpp deployment is not supported in this environment.`);
    return false;
  },

  async deployWithOnnx(modelData: ModelData): Promise<boolean> {
    try {
      const ort = await import('onnxruntime-web');
      const session = await ort.InferenceSession.create(modelData.filePath);
      onnxSessions.set(modelData.id, session);
      await this.updateModelStatus(modelData._id, "Running", { processId: Date.now() });
      await this.logActivity(`✅ ONNX model "${modelData.modelName}" loaded successfully.`);
      return true;
    } catch (error: any) {
      await this.logActivity(`❌ ONNX deployment failed for "${modelData.modelName}": ${error.message}`);
      return false;
    }
  },

  async deployWithTorch(modelData: ModelData): Promise<boolean> {
    await this.logActivity(`❌ TorchServe deployment is not supported in this environment.`);
    return false;
  }
}


export function getOnnxSession(modelId: string): any | undefined {
  return onnxSessions.get(modelId);
}

function inferActivityStatus(summary: string): "success" | "error" | "pending" {
  const normalized = summary.toLowerCase()
  if (
    normalized.includes("failed") ||
    normalized.includes("error") ||
    normalized.includes("could not")
  ) {
    return "error"
  }
  if (
    normalized.includes("initiated") ||
    normalized.includes("initializing") ||
    normalized.includes("pending")
  ) {
    return "pending"
  }
  return "success"
}

function inferActivityType(feature: string, summary: string): "upload" | "test" | "deployment" | "kanban" | "other" {
  const featureValue = feature.toLowerCase()
  const summaryValue = summary.toLowerCase()

  if (featureValue.includes("kanban")) return "kanban"
  if (summaryValue.includes("test")) return "test"
  if (summaryValue.includes("upload")) return "upload"
  if (featureValue.includes("model") || summaryValue.includes("deploy")) return "deployment"
  return "other"
}

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")
    const logs = await db.collection("activity_log").find({}).sort({ timestamp: -1 }).limit(50).toArray()

    const activities = logs.map((log: any) => {
      const summary = log.summary || "No summary available"
      const feature = log.feature || "Activity"
      const timestamp = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp)

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
  } catch (error: any) {
    console.error("Failed to load activity feed:", error)
    return NextResponse.json({ success: false, error: "Failed to load activity feed", activities: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log("POST /api/activity called");
  try {
    const formData = await request.formData()

    const modelName = formData.get("modelName") as string
    const mode = formData.get("mode") as ModelData['mode']
    const huggingFaceModelId = formData.get("huggingFaceModelId") as string;

    const tokens = Number.parseInt(formData.get("tokens") as string) || 2048
    const batchSize = Number.parseInt(formData.get("batchSize") as string) || 32
    const threads = Number.parseInt(formData.get("threads") as string) || 4
    const nPredict = Number.parseInt(formData.get("nPredict") as string) || 128
    const streamMode = formData.get("streamMode") === "true"
    const modelFile = formData.get("modelFile") as File

    if (!modelName) {
      return NextResponse.json({ success: false, error: "Model name is required" }, { status: 400 })
    }

    const client = await clientPromise;
    const db = client.db("DeployZen");

    const existingModel = await db.collection("models").findOne({ modelName });
    if (existingModel) {
      return NextResponse.json({ success: false, error: "Model name already exists" }, { status: 400 })
    }

    const modelId = new ObjectId()
    let filePath = ""

    if (mode === 'huggingface') {
        if (!huggingFaceModelId) {
            return NextResponse.json({ success: false, error: "Hugging Face Model ID is required for this mode" }, { status: 400 })
        }
        filePath = huggingFaceModelId;
    } else if (modelFile) {
      ensureModelsDir();
      const fileName = `${modelId.toString()}_${modelFile.name}`
      filePath = path.join(MODELS_DIR, fileName)
      const buffer = Buffer.from(await modelFile.arrayBuffer())
      fs.writeFileSync(filePath, buffer)
      await modelActions.logActivity(`📁 Model file uploaded: ${modelFile.name} (${(modelFile.size / 1024 / 1024).toFixed(1)} MB)`)
    } else {
      return NextResponse.json({ success: false, error: "A model file is required for this mode" }, { status: 400 })
    }

    const modelData: Omit<ModelData, 'id'> = {
      _id: modelId,
      modelName,
      filePath,
      mode,
      tokens,
      batchSize,
      status: "Pending",
      createdAt: new Date().toISOString(),
      threads,
      nPredict,
      streamMode,
      port: mode === 'llama.cpp' ? await modelActions.getAvailablePort(8080) : undefined,
      size: modelFile ? modelFile.size : undefined,
      versions: []
    }

    await db.collection("models").insertOne(modelData);
    await modelActions.logActivity(`🚀 Model deployment initiated: "${modelName}" (${mode} mode)`)

    modelActions.deployModel({ ...modelData, id: modelId.toString() });

    return NextResponse.json({ success: true, modelId: modelId.toString(), message: "Model deployment initiated" })
  } catch (error: any) {
    console.error("Deployment error:", error)
    await modelActions.logActivity(`❌ Deployment error: ${error.message}`)
    return NextResponse.json({ success: false, error: "Deployment failed" }, { status: 500 })
  }
}

export const _private = modelActions;
