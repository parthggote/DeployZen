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

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const models = loadModels()
  const model = models.find(m => m.id === id)
  if (!model) return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 })
  if (model.status !== "Running") return NextResponse.json({ success: false, error: `Model status is ${model.status}` }, { status: 400 })

  let baseUrl = ""
  const samplePaths: string[] = []

  switch (model.mode) {
    case "ollama":
      baseUrl = `http://localhost:11434`
      samplePaths.push(`/api/tags`, `/api/generate (POST; body: { model: "${model.modelName}", prompt: "..." })`)
      break
    case "llama.cpp":
      baseUrl = `http://localhost:${model.port}`
      samplePaths.push(`/health`)
      break
    case "onnx":
      baseUrl = `http://localhost:${model.port}`
      samplePaths.push(`/v1/metadata`)
      break
    case "torch":
      baseUrl = `http://localhost:${model.port}`
      samplePaths.push(`/models/${encodeURIComponent(model.modelName)}`)
      break
    default:
      return NextResponse.json({ success: false, error: `Unsupported mode ${model.mode}` }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    id: model.id,
    mode: model.mode,
    modelName: model.modelName,
    baseUrl,
    samplePaths,
  })
}
