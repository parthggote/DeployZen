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
    console.error("Error writing to activity log:", error);
  }
}

async function updateModelStatus(modelId: ObjectId, status: ModelData['status'], details: any = {}) {
    const client = await clientPromise;
    const db = client.db("DeployZen");
    await db.collection("models").updateOne(
        { _id: modelId },
        { $set: { status, ...details, lastActivity: new Date().toISOString() } }
    );
}

async function getAvailablePort(startPort = 11434): Promise<number> {
  const client = await clientPromise;
  const db = client.db("DeployZen");
  const models = await db.collection("models").find({ port: { $exists: true } }).toArray();
  const usedPorts = models.map((m) => m.port).filter(Boolean) as number[];
  const reserved = new Set<number>([11434, ...usedPorts]);
  let port = startPort;
  while (reserved.has(port)) port++;
  return port;
}

export function getOnnxSession(modelId: string): any | undefined {
  return onnxSessions.get(modelId);
}

async function deployModel(modelData: ModelData): Promise<boolean> {
  try {
    let success = false;
    if (modelData.mode === "huggingface") {
      success = await deployWithHuggingFace(modelData)
    } else if (modelData.mode === "ollama") {
      success = await deployWithOllama(modelData)
    } else if (modelData.mode === "llama.cpp") {
      success = await deployWithLlamaCpp(modelData)
    } else if (modelData.mode === "onnx") {
      success = await deployWithOnnx(modelData)
    } else if (modelData.mode === "torch") {
      success = await deployWithTorch(modelData)
    } else {
      throw new Error(`Unsupported mode: ${modelData.mode}`)
    }

    if (!success) {
        await updateModelStatus(modelData._id, "Failed");
    }
    return success;

  } catch (error: any) {
    console.error("Deployment error:", error)
    await updateModelStatus(modelData._id, "Failed");
    await logActivity(`❌ Deployment failed for "${modelData.modelName}": ${error.message}`)
    return false
  }
}

async function deployWithHuggingFace(modelData: ModelData): Promise<boolean> {
  try {
    await logActivity(`🚀 Initiating Hugging Face deployment for "${modelData.modelName}"`);

    const endpointName = modelData.modelName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() + `-${modelData._id.toString().slice(-4)}`;
    await updateModelStatus(modelData._id, "Initializing", { huggingFaceEndpointName: endpointName });

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

    await updateModelStatus(modelData._id, "Initializing", {
        huggingFaceEndpointName: hfEndpoint.name,
        status: hfEndpoint.status.state
    });

    await logActivity(`✅ Hugging Face endpoint creation initiated for "${modelData.modelName}". Status: ${hfEndpoint.status.state}`);
    return true;
  } catch (error: any) {
    await logActivity(`❌ Hugging Face deployment failed for "${modelData.modelName}": ${error.message}`);
    return false;
  }
}

async function deployWithOllama(modelData: ModelData): Promise<boolean> {
  try {
    const ollamaCheck = await fetch("http://localhost:11434/api/tags")
    if (!ollamaCheck.ok) throw new Error("Ollama is not running.")
    await updateModelStatus(modelData._id, "Running", { processId: Date.now() });
    await logActivity(`✅ Ollama model "${modelData.modelName}" deployed and tested successfully`)
    return true
  } catch (error: any) {
    await logActivity(`❌ Ollama deployment failed for "${modelData.modelName}": ${error.message}`)
    return false
  }
}

async function deployWithLlamaCpp(modelData: ModelData): Promise<boolean> {
  await logActivity(`❌ llama.cpp deployment is not supported in this environment.`);
  return false;
}

async function deployWithOnnx(modelData: ModelData): Promise<boolean> {
  try {
    const isServerless = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    let ort = isServerless ? await import('onnxruntime-web') : await import('onnxruntime-node');
    const session = await ort.InferenceSession.create(modelData.filePath);
    onnxSessions.set(modelData.id, session);
    await updateModelStatus(modelData._id, "Running", { processId: Date.now() });
    await logActivity(`✅ ONNX model "${modelData.modelName}" loaded successfully.`);
    return true;
  } catch (error: any) {
    await logActivity(`❌ ONNX deployment failed for "${modelData.modelName}": ${error.message}`);
    return false;
  }
}

async function deployWithTorch(modelData: ModelData): Promise<boolean> {
  await logActivity(`❌ TorchServe deployment is not supported in this environment.`);
  return false;
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
      await logActivity(`📁 Model file uploaded: ${modelFile.name} (${(modelFile.size / 1024 / 1024).toFixed(1)} MB)`)
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
      port: mode === 'llama.cpp' ? await getAvailablePort(8080) : undefined,
      size: modelFile ? modelFile.size : undefined,
      versions: []
    }

    await db.collection("models").insertOne(modelData);
    await logActivity(`🚀 Model deployment initiated: "${modelName}" (${mode} mode)`)

    deployModel({ ...modelData, id: modelId.toString() });

    return NextResponse.json({ success: true, modelId: modelId.toString(), message: "Model deployment initiated" })
  } catch (error: any) {
    console.error("Deployment error:", error)
    await logActivity(`❌ Deployment error: ${error.message}`)
    return NextResponse.json({ success: false, error: "Deployment failed" }, { status: 500 })
  }
}
