import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data')
const MODELS_FILE = path.join(DATA_DIR, "models.json")
const MODELS_DIR = path.join(DATA_DIR, "models")
const ACTIVITY_LOG = path.join(DATA_DIR, "activity-log.md")
const KEYS_FILE = path.join(DATA_DIR, "api-keys.json")

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true })
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
}

function loadModels(): ModelData[] {
  try { if (fs.existsSync(MODELS_FILE)) return JSON.parse(fs.readFileSync(MODELS_FILE, 'utf8')) } catch {}
  return []
}
function saveModels(models: ModelData[]) { try { ensure(); fs.writeFileSync(MODELS_FILE, JSON.stringify(models, null, 2)) } catch {} }
function logActivity(message: string) { const ts = new Date().toISOString(); try { fs.appendFileSync(ACTIVITY_LOG, `## ${ts}\n${message}\n\n`) } catch {} }

export async function GET(_req: NextRequest, { params }: { params: { rest?: string[] } }) {
  const rest = params.rest || []
  // /api/models -> list
  if (rest.length === 0) {
    const models = loadModels()
    return NextResponse.json({ success: true, models })
  }
  // /api/models/logs
  if (rest[0] === 'logs') {
    try {
      ensure()
      let logs = ''
      if (fs.existsSync(ACTIVITY_LOG)) {
        logs = fs.readFileSync(ACTIVITY_LOG, 'utf8')
      } else {
        logs = `# Activity Log\n\n## ${new Date().toISOString()}\n📝 Activity log initialized\n\n`
        fs.writeFileSync(ACTIVITY_LOG, logs)
      }
      return NextResponse.json({ success: true, logs })
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Failed to read logs', logs: '# Activity Log\n\n❌ Error loading activity logs.' }, { status: 500 })
    }
  }
  // /api/models/:id/test (health)
  if (rest[0] && rest[1] === 'test') {
    const id = rest[0]
    const models = loadModels()
    const model = models.find(m => m.id === id)
    if (!model) return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 })
    if (model.status !== 'Running') return NextResponse.json({ success: false, error: `Model status is ${model.status}` }, { status: 400 })
    return NextResponse.json({ success: true, status: 'running' })
  }
  // /api/models/:id/endpoint
  if (rest[0] && rest[1] === 'endpoint') {
    const id = rest[0]
    const models = loadModels()
    const model = models.find(m => m.id === id)
    if (!model) return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 })
    if (model.status !== 'Running') return NextResponse.json({ success: false, error: `Model status is ${model.status}` }, { status: 400 })
    let baseUrl = ''
    const samplePaths: string[] = []
    switch (model.mode) {
      case 'ollama': baseUrl = `http://localhost:11434`; samplePaths.push(`/api/tags`, `/api/generate (POST; body: { model: "${model.modelName}", prompt: "..." })`); break
      case 'llama.cpp': baseUrl = `http://localhost:${model.port}`; samplePaths.push(`/health`); break
      case 'onnx': baseUrl = `http://localhost:${model.port}`; samplePaths.push(`/v1/metadata`); break
      case 'torch': baseUrl = `http://localhost:${model.port}`; samplePaths.push(`/models/${encodeURIComponent(model.modelName)}`); break
    }
    return NextResponse.json({ success: true, id: model.id, mode: model.mode, modelName: model.modelName, baseUrl, samplePaths })
  }
  // /api/models/:id/keys (GET)
  if (rest[0] && rest[1] === 'keys') {
    const modelId = rest[0]
    const models = loadModels()
    const model = models.find(m => m.id === modelId)
    if (!model) return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 })
    if (!fs.existsSync(KEYS_FILE)) fs.writeFileSync(KEYS_FILE, JSON.stringify([]))
    const keys: any[] = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'))
    const list = keys.filter(k => k.modelId === modelId).map(k => ({ keyId: k.keyId, prefix: k.prefix, createdAt: k.createdAt, revokedAt: k.revokedAt || null, masked: `${k.prefix}****************` }))
    return NextResponse.json({ success: true, keys: list })
  }
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
}

export async function POST(req: NextRequest, { params }: { params: { rest?: string[] } }) {
  const rest = params.rest || []
  // Dispatch subroutes
  if (rest[0] === 'deploy') return deploy(req)
  if (rest[0] === 'test') return testModel(req)
  if (rest[0] && rest[1] === 'keys') return createKey(rest[0])

  // Upload/deploy entry: /api/models/deploy (form-data)
  return NextResponse.json({ success: false, error: 'Use /api/models/deploy' }, { status: 400 })
}

export async function DELETE(_req: NextRequest, { params }: { params: { rest?: string[] } }) {
  const rest = params.rest || []
  const id = rest[0]
  if (!id) return NextResponse.json({ success: false, error: 'Model ID required' }, { status: 400 })
  const models = loadModels()
  const idx = models.findIndex(m => m.id === id)
  if (idx === -1) return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 })
  const model = models[idx]
  if (model.filePath && !model.filePath.startsWith('http') && fs.existsSync(model.filePath)) {
    try { fs.unlinkSync(model.filePath); logActivity(`🗑️ Deleted model file: ${model.filePath}`) } catch {}
  }
  models.splice(idx, 1)
  saveModels(models)
  logActivity(`❌ Model deleted: "${model.modelName}" (${model.mode} mode)`) 
  return NextResponse.json({ success: true, message: 'Model deleted successfully' })
}

async function deploy(req: NextRequest) {
  try {
    const form = await req.formData()
    const modelName = String(form.get('modelName') || '')
    const mode = String(form.get('mode') || 'ollama') as ModelData['mode']
    const tokens = Number(form.get('tokens') || 2048)
    const batchSize = Number(form.get('batchSize') || 32)
    const threads = Number(form.get('threads') || 4)
    const nPredict = Number(form.get('nPredict') || 128)
    const streamMode = String(form.get('streamMode') || 'true') === 'true'
    const modelFile = form.get('modelFile') as File | null
    const huggingFaceUrl = String(form.get('huggingFaceUrl') || '')

    if (!modelName) return NextResponse.json({ success: false, error: 'Model name is required' }, { status: 400 })

    ensure()
    const id = `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    let filePath = ''
    if (modelFile) {
      const fileName = `${id}_${modelFile.name}`
      filePath = path.join(MODELS_DIR, fileName)
      const buffer = Buffer.from(await modelFile.arrayBuffer())
      fs.writeFileSync(filePath, buffer)
      logActivity(`📁 Model file uploaded: ${modelFile.name} (${(modelFile.size / 1024 / 1024).toFixed(1)} MB)`)
    } else if (huggingFaceUrl) {
      if (mode === 'onnx' || mode === 'torch') {
        return NextResponse.json({ success: false, error: `${mode.toUpperCase()} requires a local model file upload (.onnx or .pth/.pt)` }, { status: 400 })
      }
      filePath = huggingFaceUrl
      logActivity(`🔗 HuggingFace model URL registered: ${huggingFaceUrl}`)
    } else {
      return NextResponse.json({ success: false, error: 'Either model file or HuggingFace URL is required' }, { status: 400 })
    }

    const models = loadModels()
    const record: ModelData = { id, modelName, filePath, mode, tokens, batchSize, status: 'Pending', createdAt: new Date().toISOString() }
    models.push(record)
    saveModels(models)
    logActivity(`🚀 Model deployment initiated: "${modelName}" (${mode} mode)`)
    return NextResponse.json({ success: true, modelId: id, message: 'Model deployment initiated' })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Deployment failed' }, { status: 500 })
  }
}

async function testModel(req: NextRequest) {
  try {
    const { modelId, prompt } = await req.json()
    if (!modelId || !prompt) return NextResponse.json({ success: false, error: 'Model ID and prompt are required' }, { status: 400 })
    const models = loadModels()
    const model = models.find(m => m.id === modelId)
    if (!model) return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 })
    if (model.status !== 'Running') return NextResponse.json({ success: false, error: 'Model is not running' }, { status: 400 })
    // Simulated response (to keep function lightweight for Hobby)
    const responses = [
      `Hello! I'm ${model.modelName}. Ready to help!`,
      `Hi! ${model.modelName} responding to: "${String(prompt).slice(0, 30)}..."`,
      `${model.modelName} here — systems nominal.`,
    ]
    const response = responses[Math.floor(Math.random() * responses.length)]
    logActivity(`🧪 Model test completed: "${model.modelName}"`)
    model.lastActivity = new Date().toISOString()
    saveModels(models)
    return NextResponse.json({ success: true, response })
  } catch (e) {
    logActivity(`❌ Model test error: ${e}`)
    return NextResponse.json({ success: false, error: 'Test failed' }, { status: 500 })
  }
}

async function createKey(modelId: string) {
  const models = loadModels()
  const model = models.find(m => m.id === modelId)
  if (!model) return NextResponse.json({ success: false, error: 'Model not found' }, { status: 404 })
  if (!fs.existsSync(KEYS_FILE)) fs.writeFileSync(KEYS_FILE, JSON.stringify([]))
  const raw = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('hex')
  const keyId = Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString('hex')
  const prefix = raw.slice(0, 8)
  const keyHash = require('crypto').createHash('sha256').update(raw).digest('hex')
  const rec = { keyId, modelId, keyHash, prefix, createdAt: new Date().toISOString() }
  const keys: any[] = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'))
  keys.push(rec)
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2))
  logActivity(`Created API key (prefix ${prefix}) for model "${model.modelName}"`)
  return NextResponse.json({ success: true, apiKey: raw, keyId, prefix, createdAt: rec.createdAt })
}


