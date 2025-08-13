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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const body = await req.json()
    const items = readKanban()
    const idx = items.findIndex((item: any) => item.id === id)
    if (idx === -1) return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
    items[idx] = { ...items[idx], ...body }
    writeKanban(items)
    logActivity(`Updated kanban item '${items[idx].title || id}' (column: '${items[idx].status}')`)
    return NextResponse.json({ success: true, item: items[idx] })
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to update kanban item" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const items = readKanban()
    const filtered = items.filter((item: any) => item.id !== id)
    writeKanban(filtered)
    logActivity(`Deleted kanban item '${id}'`)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to delete kanban item" }, { status: 500 })
  }
}