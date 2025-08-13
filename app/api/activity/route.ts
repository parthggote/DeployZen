import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import fetch from 'node-fetch'
import * as ort from 'onnxruntime-web';

// Global map to store ONNX inference sessions
const onnxSessions = new Map<string, ort.InferenceSession>();

const DATA_DIR = path.join(process.cwd(), "data")
const MODELS_FILE = path.join(DATA_DIR, "models.json")
const MODELS_DIR = path.join(DATA_DIR, "models")
const ACTIVITY_LOG = path.join(DATA_DIR, "activity-log.md")

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true })
  }
}

interface ModelData {
  id: string
  modelName: string
  filePath: string
  mode: "ollama" | "llama.cpp" | "onnx" | "torch"
  tokens: number
  batchSize: number
  status: "Pending" | "Running" | "Failed" | "Stopped"
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
}

function loadModels(): ModelData[] {
  try {
    ensureDirectories()

    if (fs.existsSync(MODELS_FILE)) {
      const data = fs.readFileSync(MODELS_FILE, "utf8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("Error loading models:", error)
  }
  return []
}

function saveModels(models: ModelData[]) {
  try {
    ensureDirectories()
    fs.writeFileSync(MODELS_FILE, JSON.stringify(models, null, 2))
  } catch (error) {
    console.error("Error saving models:", error)
  }
}

function logActivity(message: string) {
  const timestamp = new Date().toISOString()
  const logEntry = `## ${timestamp}\n${message}\n\n`

  try {
    ensureDirectories()
    fs.appendFileSync(ACTIVITY_LOG, logEntry)
  } catch (error) {
    console.error("Error writing to activity log:", error)
  }
}

function getAvailablePort(startPort = 11434): number {
  // Avoid Ollama default 11434 conflicts by allowing custom bases per mode
  const models = loadModels()
  const usedPorts = models.map((m) => m.port).filter(Boolean) as number[]
  // Always consider Ollama default as reserved
  const reserved = new Set<number>([11434, ...usedPorts])
  let port = startPort
  while (reserved.has(port)) port++
  return port
}

// Function to retrieve ONNX session by model ID
export function getOnnxSession(modelId: string): ort.InferenceSession | undefined {
  return onnxSessions.get(modelId);
}

// Real model deployment using Ollama or llama.cpp
async function deployModel(modelData: ModelData): Promise<boolean> {
  try {
    if (modelData.mode === "ollama") {
      return await deployWithOllama(modelData)
    } else if (modelData.mode === "llama.cpp") {
      return await deployWithLlamaCpp(modelData)
    } else if (modelData.mode === "onnx") {
      return await deployWithOnnx(modelData)
    } else if (modelData.mode === "torch") {
      return await deployWithTorch(modelData)
    } else {
      throw new Error(`Unsupported mode: ${modelData.mode}`)
    }
  } catch (error) {
    console.error("Deployment error:", error)
    modelData.status = "Failed"
    logActivity(`❌ Deployment failed for "${modelData.modelName}": ${error}`)
    return false
  }
}

// Deploy model using Ollama
async function deployWithOllama(modelData: ModelData): Promise<boolean> {
  try {
    // Check if Ollama is running
    const ollamaCheck = await fetch("http://localhost:11434/api/tags")
    if (!ollamaCheck.ok) {
      throw new Error("Ollama is not running. Please start Ollama first.")
    }

    // If it's a HuggingFace URL, we need to pull the model
    if (modelData.filePath.startsWith("http")) {
      const pullResponse = await fetch("http://localhost:11434/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: modelData.modelName,
          path: modelData.filePath
        })
      })

      if (!pullResponse.ok) {
        throw new Error(`Failed to pull model: ${pullResponse.statusText}`)
      }

      logActivity(`📥 Pulled model "${modelData.modelName}" from HuggingFace`)
    } else {
      // For local files, we need to create a Modelfile
      const modelfileContent = `FROM ${modelData.filePath}
PARAMETER num_ctx ${modelData.tokens}
PARAMETER num_batch ${modelData.batchSize}
PARAMETER num_thread ${modelData.threads || 4}
PARAMETER num_predict ${modelData.nPredict || 128}
PARAMETER stream ${modelData.streamMode ? "true" : "false"}`

      // Create Modelfile
      const modelfilePath = path.join(path.dirname(modelData.filePath), "Modelfile")
      fs.writeFileSync(modelfilePath, modelfileContent)

      // Create model using Modelfile
      const createResponse = await fetch("http://localhost:11434/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: modelData.modelName,
          path: path.dirname(modelData.filePath)
        })
      })

      if (!createResponse.ok) {
        throw new Error(`Failed to create model: ${createResponse.statusText}`)
      }

      logActivity(`🔧 Created Ollama model "${modelData.modelName}" from local file`)
    }

    // Test the model
    const testResponse = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelData.modelName,
        prompt: "Hello, are you working?",
        stream: false
      })
    })

    if (!testResponse.ok) {
      throw new Error("Model test failed")
    }

    modelData.status = "Running"
    modelData.processId = Date.now() // Use timestamp as process ID for Ollama

    logActivity(`✅ Ollama model "${modelData.modelName}" deployed and tested successfully`)
    return true

  } catch (error) {
    console.error("Ollama deployment error:", error)
    modelData.status = "Failed"
    logActivity(`❌ Ollama deployment failed for "${modelData.modelName}": ${error}`)
    return false
  }
}

// Deploy model using llama.cpp
async function deployWithLlamaCpp(modelData: ModelData): Promise<boolean> {
  try {
    const { spawn } = require("child_process")
    
    // Construct llama.cpp command
    const args = [
      "-m", modelData.filePath,
      "-c", modelData.tokens.toString(),
      "-b", modelData.batchSize.toString(),
      "-t", (modelData.threads || 4).toString(),
      "-n", (modelData.nPredict || 128).toString(),
      "--port", modelData.port?.toString() || "8080"
    ]

    if (modelData.streamMode) {
      args.push("--stream")
    }

    // Start llama.cpp process
    const llamaProcess = spawn("./main", args, {
      cwd: process.env.LLAMA_CPP_PATH || "./llama.cpp",
      detached: true
    })

    // Wait for process to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("llama.cpp startup timeout"))
      }, 10000)

      llamaProcess.stdout.on("data", (data: Buffer) => {
        const output = data.toString()
        if (output.includes("server listening")) {
          clearTimeout(timeout)
          resolve(true)
        }
      })

      llamaProcess.stderr.on("data", (data: Buffer) => {
        console.error("llama.cpp stderr:", data.toString())
      })

      llamaProcess.on("error", (error: Error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    modelData.status = "Running"
    modelData.processId = llamaProcess.pid

    logActivity(`✅ llama.cpp model "${modelData.modelName}" deployed successfully (PID: ${modelData.processId})`)
    return true

  } catch (error) {
    console.error("llama.cpp deployment error:", error)
    modelData.status = "Failed"
    logActivity(`❌ llama.cpp deployment failed for "${modelData.modelName}": ${error}`)
    return false
  }
}

// Deploy model using ONNX Runtime
async function deployWithOnnx(modelData: ModelData): Promise<boolean> {
  try {
    // Load the ONNX model
    const session = await ort.InferenceSession.create(modelData.filePath);
    onnxSessions.set(modelData.id, session);

    modelData.status = "Running";
    // Assign a fake process ID for now, as onnxruntime-node doesn't spawn a separate server process
    modelData.processId = Date.now(); 
    logActivity(`✅ ONNX model "${modelData.modelName}" loaded successfully using onnxruntime-node.`);
    return true;
  } catch (error) {
    console.error("ONNX deployment error:", error);
    modelData.status = "Failed";
    logActivity(`❌ ONNX deployment failed for "${modelData.modelName}": ${error}`);
    return false;
  }
}

// Deploy model using TorchServe (basic simulated deployment if runtime not available)
async function deployWithTorch(modelData: ModelData): Promise<boolean> {
  try {
    const { spawn } = require("child_process")
    const port = modelData.port || getAvailablePort(8082)
    modelData.port = port

    let started = false
    try {
      const proc = spawn(process.platform === "win32" ? "torchserve.bat" : "torchserve", [
        "--start",
        "--ncs",
      ], { stdio: "ignore", detached: true })
      modelData.processId = proc.pid
      started = true
      logActivity(`🔥 TorchServe starting (model "${modelData.modelName}") (PID: ${proc.pid})`)
    } catch (e) {
      logActivity(`ℹ️ TorchServe not found. Unable to start server for "${modelData.modelName}"`)
    }

    if (started) {
      modelData.status = "Running"
      return true
    } else {
      modelData.status = "Failed"
      logActivity(`❌ TorchServe failed to start for "${modelData.modelName}"`)
      return false
    }
  } catch (error) {
    console.error("Torch deployment error:", error)
    modelData.status = "Failed"
    logActivity(`❌ Torch deployment failed for "${modelData.modelName}": ${error}`)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const modelName = formData.get("modelName") as string
    const mode = formData.get("mode") as "ollama" | "llama.cpp" | "onnx" | "torch"
    const tokens = Number.parseInt(formData.get("tokens") as string)
    const batchSize = Number.parseInt(formData.get("batchSize") as string)
    const threads = Number.parseInt(formData.get("threads") as string) || 4
    const nPredict = Number.parseInt(formData.get("nPredict") as string) || 128
    const streamMode = formData.get("streamMode") === "true"

    const modelFile = formData.get("modelFile") as File
    const huggingFaceUrl = formData.get("huggingFaceUrl") as string

    if (!modelName) {
      return NextResponse.json({ success: false, error: "Model name is required" }, { status: 400 })
    }

    // Check if model name already exists
    const existingModels = loadModels()
    if (existingModels.some((m) => m.modelName === modelName)) {
      return NextResponse.json({ success: false, error: "Model name already exists" }, { status: 400 })
    }

    const modelId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    let filePath = ""

    // Handle file upload or URL
    if (modelFile) {
      const fileName = `${modelId}_${modelFile.name}`
      filePath = path.join(MODELS_DIR, fileName)
      const buffer = Buffer.from(await modelFile.arrayBuffer())
      fs.writeFileSync(filePath, buffer)
      logActivity(`📁 Model file uploaded: ${modelFile.name} (${(modelFile.size / 1024 / 1024).toFixed(1)} MB)`)
    } else if (huggingFaceUrl) {
      // For ONNX/Torch, we require a local file path (server cannot read remote URL directly)
      if (mode === "onnx" || mode === "torch") {
        return NextResponse.json({ success: false, error: `${mode.toUpperCase()} requires a local model file upload (.onnx or .pth/.pt)` }, { status: 400 })
      }
      filePath = huggingFaceUrl
      logActivity(`🔗 HuggingFace model URL registered: ${huggingFaceUrl}`)
    } else {
      return NextResponse.json({ success: false, error: "Either model file or HuggingFace URL is required" }, { status: 400 })
    }

    // Assign ports per mode
    let port: number | undefined
    if (mode === "llama.cpp") port = getAvailablePort(8080)
    if (mode === "onnx") port = getAvailablePort(8001)
    if (mode === "torch") port = getAvailablePort(8082)

    const modelData: any = {
      id: modelId,
      modelName,
      filePath,
      mode,
      tokens,
      batchSize,
      status: "Pending",
      port,
      createdAt: new Date().toISOString(),
      threads,
      nPredict,
      streamMode,
    }

    // Versioning
    let version = 1
    let previousVersions = []
    const existingModel = existingModels.find((m) => m.modelName === modelName)
    if (existingModel) {
      version = (existingModel as any).version ? (existingModel as any).version + 1 : 2
      previousVersions = (existingModel as any).versions || [
        { version: 1, filePath: (existingModel as any).filePath, createdAt: existingModel.createdAt, size: (existingModel as any).size || null }
      ]
    }
    modelData.version = version
    if (modelFile) modelData.size = (modelFile as any).size
    modelData.versions = previousVersions

    // Deploy per mode
    const deploymentSuccess = await deployModel(modelData)

    // Save model data
    const models = loadModels()
    models.push(modelData)
    saveModels(models)

    logActivity(`🚀 Model deployment initiated: "${modelName}" (${mode} mode)`)

    return NextResponse.json({ success: true, modelId, message: deploymentSuccess ? "Model deployed successfully" : "Model deployment failed" })
  } catch (error) {
    console.error("Deployment error:", error)
    logActivity(`❌ Deployment error: ${error}`)
    return NextResponse.json({ success: false, error: "Deployment failed" }, { status: 500 })
  }
}
