import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import crypto from "crypto"

const DATA_DIR = path.join(process.cwd(), "data")
const MODELS_FILE = path.join(DATA_DIR, "models.json")
const KEYS_FILE = path.join(DATA_DIR, "api-keys.json")
const ACTIVITY_LOG = path.join(DATA_DIR, "activity-log.md")

interface ModelData { id: string; modelName: string }
interface StoredKey { keyId: string; modelId: string; keyHash: string; prefix: string; createdAt: string; revokedAt?: string }

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(KEYS_FILE)) fs.writeFileSync(KEYS_FILE, JSON.stringify([]))
}

function loadModels(): ModelData[] {
  if (!fs.existsSync(MODELS_FILE)) return []
  try { return JSON.parse(fs.readFileSync(MODELS_FILE, "utf8")) } catch { return [] }
}

function loadKeys(): StoredKey[] {
  ensureFiles()
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8")) } catch { return [] }
}

function saveKeys(keys: StoredKey[]) {
  ensureFiles()
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2))
}

function logActivity(message: string) {
  const ts = new Date().toISOString()
  const entry = `## ${ts}\n- Feature: API Keys\n- Summary: ${message}\n\n`
  try { fs.appendFileSync(ACTIVITY_LOG, entry) } catch {}
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: modelId } = await context.params
  const model = loadModels().find(m => m.id === modelId)
  if (!model) return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 })
  const keys = loadKeys().filter(k => k.modelId === modelId).map(k => ({
    keyId: k.keyId,
    prefix: k.prefix,
    createdAt: k.createdAt,
    revokedAt: k.revokedAt || null,
    masked: `${k.prefix}****************`,
  }))
  return NextResponse.json({ success: true, keys })
}

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: modelId } = await context.params
  const model = loadModels().find(m => m.id === modelId)
  if (!model) return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 })

  const raw = crypto.randomBytes(24).toString("hex") // 48 chars
  const keyId = crypto.randomBytes(8).toString("hex")
  const prefix = raw.slice(0, 8)
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex")
  const record: StoredKey = { keyId, modelId, keyHash, prefix, createdAt: new Date().toISOString() }

  const keys = loadKeys()
  keys.push(record)
  saveKeys(keys)
  logActivity(`Created API key (prefix ${prefix}) for model "${model.modelName}"`)

  return NextResponse.json({ success: true, apiKey: raw, keyId, prefix, createdAt: record.createdAt })
}
