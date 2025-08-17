import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import fs from "fs"
import path from "path"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!params.id || !ObjectId.isValid(params.id)) {
      return new NextResponse("Invalid model ID", { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")
    const model = await db.collection("models").findOne({ _id: new ObjectId(params.id) })

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
  } catch (error: any) {
    console.error("Download error:", error);
    return new NextResponse("Failed to download model", { status: 500 })
  }
}