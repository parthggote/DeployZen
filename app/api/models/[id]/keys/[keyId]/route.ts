import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const KEYS_FILE = path.join(DATA_DIR, "api-keys.json")
const MODELS_FILE = path.join(DATA_DIR, "models.json")
const ACTIVITY_LOG = path.join(DATA_DIR, "activity-log.md")

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(KEYS_FILE)) fs.writeFileSync(KEYS_FILE, JSON.stringify([]))
}

function loadKeys() { ensure(); try { return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8")) } catch { return [] } }
function saveKeys(keys: any[]) { ensure(); fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2)) }
function loadModels() { if (!fs.existsSync(MODELS_FILE)) return []; try { return JSON.parse(fs.readFileSync(MODELS_FILE, "utf8")) } catch { return [] } }
function logActivity(message: string) { const ts = new Date().toISOString(); const entry = `## ${ts}\n- Feature: API Keys\n- Summary: ${message}\n\n`; try { fs.appendFileSync(ACTIVITY_LOG, entry) } catch {} }

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string, keyId: string }> }) {
  const { id: modelId, keyId } = await context.params
  const models = loadModels()
  const model = models.find((m: any) => m.id === modelId)
  if (!model) return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 })

  const keys = loadKeys()
  const idx = keys.findIndex((k: any) => k.keyId === keyId && k.modelId === modelId)
  if (idx === -1) return NextResponse.json({ success: false, error: "Key not found" }, { status: 404 })

  if (!keys[idx].revokedAt) {
    keys[idx].revokedAt = new Date().toISOString()
    saveKeys(keys)
    logActivity(`Revoked API key (prefix ${keys[idx].prefix}) for model "${model.modelName}"`)
  }

  return NextResponse.json({ success: true })
}
