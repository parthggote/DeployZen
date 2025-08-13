import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const MODELS_FILE = path.join(DATA_DIR, "models.json")

function loadModels() {
  if (!fs.existsSync(MODELS_FILE)) return []
  return JSON.parse(fs.readFileSync(MODELS_FILE, "utf8"))
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const models = loadModels()
  const model = models.find((m: any) => m.id === params.id)
  if (!model || !model.filePath || model.filePath.startsWith("http")) {
    return new NextResponse("Model file not found or not downloadable", { status: 404 })
  }
  if (!fs.existsSync(model.filePath)) {
    return new NextResponse("Model file not found on disk", { status: 404 })
  }
  const fileStream = fs.createReadStream(model.filePath)
  const fileName = path.basename(model.filePath)
  return new NextResponse(fileStream as any, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename=\"${fileName}\"`,
    },
  })
}