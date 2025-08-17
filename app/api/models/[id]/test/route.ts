import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

async function checkOllama(): Promise<void> {
  const res = await fetch("http://localhost:11434/api/tags")
  if (!res.ok) throw new Error(`Ollama health failed: ${res.status}`)
}

async function checkLlamaCpp(port?: number): Promise<void> {
  if (!port) throw new Error("llama.cpp port missing")
  const res = await fetch(`http://localhost:${port}/health`)
  if (!res.ok) throw new Error(`llama.cpp health failed: ${res.status}`)
}

async function checkOnnx(port?: number): Promise<void> {
  if (!port) throw new Error("ONNX port missing")
  const res = await fetch(`http://localhost:${port}/v1/metadata`)
  if (!res.ok) throw new Error(`ONNX health failed: ${res.status}`)
}

async function checkTorch(port?: number, modelName?: string): Promise<void> {
  if (!port) throw new Error("TorchServe port missing")
  if (!modelName) throw new Error("TorchServe model name missing")
  const res = await fetch(`http://localhost:${port}/models/${encodeURIComponent(modelName)}`)
  if (!res.ok) throw new Error(`TorchServe health failed: ${res.status}`)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!params.id || !ObjectId.isValid(params.id)) {
        return NextResponse.json({ status: "failed", error: "Invalid model ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")
    const model = await db.collection("models").findOne({ _id: new ObjectId(params.id) })

    if (!model) {
      return NextResponse.json({ status: "failed", error: "Model not found" }, { status: 404 })
    }

    if (model.status !== "Running") {
      return NextResponse.json({ status: "failed", error: `Model status is ${model.status}` }, { status: 400 })
    }

    switch (model.mode) {
      case "ollama":
        await checkOllama()
        break
      case "llama.cpp":
        await checkLlamaCpp(model.port)
        break
      case "onnx":
        await checkOnnx(model.port)
        break
      case "torch":
        await checkTorch(model.port, model.modelName)
        break
      default:
        return NextResponse.json({ status: "failed", error: `Unsupported mode ${model.mode}` }, { status: 400 })
    }

    return NextResponse.json({ status: "running" })
  } catch (e: any) {
    return NextResponse.json({ status: "failed", error: e?.message || "Health check failed" }, { status: 500 })
  }
}
