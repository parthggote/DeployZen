import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

async function logActivity(message: string) {
  try {
    const client = await clientPromise;
    const db = client.db("DeployZen");
    await db.collection("activity_log").insertOne({
      timestamp: new Date(),
      feature: "Kanban",
      summary: message,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")

    const itemsFromDb = await db.collection("kanban").find({}).toArray()
    const modelsFromDb = await db.collection("models").find({}).toArray()

    const items = itemsFromDb.map(item => ({ ...item, id: item._id.toString() }));
    const models = modelsFromDb.map(model => ({ ...model, id: model._id.toString() }));

    const enrichedItems = items.map((item: any) => {
      if (item.type === "model") {
        const modelDetails = models.find(m => m.modelName.startsWith(item.title));
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
    return NextResponse.json({ success: false, error: e.message || "Failed to fetch kanban data" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")
    const body = await req.json()

    const newItem = { ...body, lastUpdated: new Date().toISOString() }
    const result = await db.collection("kanban").insertOne(newItem)

    const insertedDoc = { ...newItem, id: result.insertedId.toString() };

    await logActivity(`Created kanban item '${insertedDoc.title || insertedDoc.id}' in column '${insertedDoc.status}'`)

    return NextResponse.json({ success: true, item: insertedDoc })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Failed to add kanban item" }, { status: 500 })
  }
}