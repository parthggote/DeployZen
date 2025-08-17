import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const KANBAN_FILE = path.join(DATA_DIR, "kanban.json")
const MODELS_FILE = path.join(DATA_DIR, "models.json")
const ACTIVITY_LOG = path.join(process.cwd(), "data", "activity-log.md")

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(KANBAN_FILE)) fs.writeFileSync(KANBAN_FILE, JSON.stringify([]))
  if (!fs.existsSync(MODELS_FILE)) fs.writeFileSync(MODELS_FILE, JSON.stringify([]))
}

function readKanban() {
  ensureDataFile()
  try {
    return JSON.parse(fs.readFileSync(KANBAN_FILE, "utf8"))
  } catch (e) {
    return []
  }
}

function readModels() {
  ensureDataFile()
  try {
    return JSON.parse(fs.readFileSync(MODELS_FILE, "utf8"))
  } catch (e) {
    return []
  }
}

function writeKanban(data: any) {
  ensureDataFile()
  fs.writeFileSync(KANBAN_FILE, JSON.stringify(data, null, 2))
}

function logActivity(message: string) {
  const timestamp = new Date().toISOString()
  const logEntry = `## ${timestamp}\n- Feature: Kanban\n- Summary: ${message}\n\n`
  fs.appendFileSync(ACTIVITY_LOG, logEntry)
}

export async function GET() {
  try {
    const items = readKanban()
    const models = readModels()
    const modelMap = new Map(models.map((m: any) => [m.modelName, m]))

    const enrichedItems = items.map((item: any) => {
      if (item.type === "model") {
        // Attempt to find a matching model by title.
        // In a real-world scenario, you'd likely use a more robust ID linking models and kanban items.
        const modelDetails = modelMap.get(item.title)
        if (modelDetails) {
          return {
            ...item,
            modelDetails: {
              name: modelDetails.modelName,
              status: modelDetails.status ? modelDetails.status.toLowerCase() : "unknown",
              latency: modelDetails.latency || Math.floor(Math.random() * 150) + 50,
              tokensPerSec: modelDetails.tokensPerSec || Math.floor(Math.random() * 150) + 50,
              requestsPerSec: modelDetails.requestsPerSec || Math.floor(Math.random() * 20) + 1,
              gpu: modelDetails.gpu || "N/A",
              memory: modelDetails.size ? `${(modelDetails.size / 1024 / 1024).toFixed(2)} MB` : "N/A",
            },
          }
        }
      }
      return item
    })
    return NextResponse.json({ success: true, items: enrichedItems })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Failed to read kanban data" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const items = readKanban()
    const newItem = { ...body, id: Date.now().toString() }
    items.push(newItem)
    writeKanban(items)
    logActivity(`Created kanban item '${newItem.title || newItem.id}' in column '${newItem.status}'`)
    return NextResponse.json({ success: true, item: newItem })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Failed to add kanban item" }, { status: 500 })
  }
}