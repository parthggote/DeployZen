import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const KANBAN_FILE = path.join(DATA_DIR, "kanban.json")
const ACTIVITY_LOG = path.join(process.cwd(), "data", "activity-log.md")

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(KANBAN_FILE)) fs.writeFileSync(KANBAN_FILE, JSON.stringify([]))
}

function readKanban() {
  ensureDataFile()
  return JSON.parse(fs.readFileSync(KANBAN_FILE, "utf8"))
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
    return NextResponse.json({ success: true, items })
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to read kanban data" }, { status: 500 })
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
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to add kanban item" }, { status: 500 })
  }
}