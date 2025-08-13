import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const MODELS_FILE = path.join(DATA_DIR, "models.json")
const MODELS_DIR = path.join(DATA_DIR, "models")

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
  mode: "ollama" | "llama.cpp"
  tokens: number
  batchSize: number
  status: "Pending" | "Running" | "Failed" | "Stopped"
  port?: number
  createdAt: string
  lastActivity?: string
  processId?: number
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

export async function GET() {
  try {
    const models = loadModels()
    return NextResponse.json({
      success: true,
      models,
    })
  } catch (error) {
    console.error("Error in GET /api/models:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load models",
        models: [],
      },
      { status: 500 },
    )
  }
}
