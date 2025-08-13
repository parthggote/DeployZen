import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const MODELS_FILE = path.join(DATA_DIR, "models.json")
const ACTIVITY_LOG = path.join(DATA_DIR, "activity-log.md")

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
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(MODELS_FILE, JSON.stringify(models, null, 2))
  } catch (error) {
    console.error("Error saving models:", error)
  }
}

function logActivity(message: string) {
  const timestamp = new Date().toISOString()
  const logEntry = `## ${timestamp}\n${message}\n\n`

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.appendFileSync(ACTIVITY_LOG, logEntry)
  } catch (error) {
    console.error("Error writing to activity log:", error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const modelId = params.id
    const models = loadModels()
    const modelIndex = models.findIndex((m) => m.id === modelId)

    if (modelIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Model not found",
        },
        { status: 404 },
      )
    }

    const model = models[modelIndex]

    // Simulate stopping the process
    if (model.processId) {
      logActivity(`🛑 Stopped process for model "${model.modelName}" (PID: ${model.processId})`)
    }

    // Remove model file if it exists locally and is not a URL
    if (model.filePath && !model.filePath.startsWith("http") && fs.existsSync(model.filePath)) {
      try {
        fs.unlinkSync(model.filePath)
        logActivity(`🗑️ Deleted model file: ${model.filePath}`)
      } catch (error) {
        console.error("Error deleting model file:", error)
      }
    }

    // Remove from models list
    models.splice(modelIndex, 1)
    saveModels(models)

    logActivity(`❌ Model deleted: "${model.modelName}" (${model.mode} mode)`)

    return NextResponse.json({
      success: true,
      message: "Model deleted successfully",
    })
  } catch (error) {
    console.error("Delete error:", error)
    logActivity(`❌ Model deletion error: ${error}`)
    return NextResponse.json(
      {
        success: false,
        error: "Delete failed",
      },
      { status: 500 },
    )
  }
}
