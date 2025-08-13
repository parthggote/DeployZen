import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const MODELS_FILE = path.join(DATA_DIR, "models.json")

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
}

function loadModels(): ModelData[] {
  if (!fs.existsSync(MODELS_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(MODELS_FILE, "utf8"))
  } catch {
    return []
  }
}

async function checkOllama(): Promise<void> {
  const res = await fetch("http://localhost:11434/api/tags")
  if (!res.ok) throw new Error(`Ollama health failed: ${res.status}`)
}

async function checkLlamaCpp(port?: number): Promise<void> {
  if (!port) throw new Error("llama.cpp port missing")
  const res = await fetch(`http://localhost:${port}/health`)
  if (!res.ok) throw new Error(`llama.cpp health failed: ${res.status}`)
}

async function checkOnnx(port?: number): Promise<void> {
  if (!port) throw new Error("ONNX port missing")
  const res = await fetch(`http://localhost:${port}/v1/metadata`)
  if (!res.ok) throw new Error(`ONNX health failed: ${res.status}`)
}

async function checkTorch(port?: number, modelName?: string): Promise<void> {
  if (!port) throw new Error("TorchServe port missing")
  if (!modelName) throw new Error("TorchServe model name missing")
  const res = await fetch(`http://localhost:${port}/models/${encodeURIComponent(modelName)}`)
  if (!res.ok) throw new Error(`TorchServe health failed: ${res.status}`)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const models = loadModels()
    const model = models.find(m => m.id === params.id)
    if (!model) {
      return NextResponse.json({ status: "failed", error: "Model not found" }, { status: 404 })
    }

    // Short-circuit if not marked running
    if (model.status !== "Running") {
      return NextResponse.json({ status: "failed", error: `Model status is ${model.status}` }, { status: 400 })
    }

    switch (model.mode) {
      case "ollama":
        await checkOllama()
        break
      case "llama.cpp":
        await checkLlamaCpp(model.port)
        break
      case "onnx":
        await checkOnnx(model.port)
        break
      case "torch":
        await checkTorch(model.port, model.modelName)
        break
      default:
        return NextResponse.json({ status: "failed", error: `Unsupported mode ${model.mode}` }, { status: 400 })
    }

    return NextResponse.json({ status: "running" })
  } catch (e: any) {
    return NextResponse.json({ status: "failed", error: e?.message || "Health check failed" }, { status: 500 })
  }
}
