import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid ID format" }, { status: 400 })
    }
    const client = await clientPromise
    const db = client.db("DeployZen")
    const body = await req.json()

    delete body.id
    delete body._id

    const result = await db.collection("kanban").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: body },
      { returnDocument: "after" }
    )

    if (!result) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
    }

    const updatedDoc = { ...result, id: result._id.toString() };

    await logActivity(`Updated kanban item '${updatedDoc.title || id}' (column: '${updatedDoc.status}')`)

    return NextResponse.json({ success: true, item: updatedDoc })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Failed to update kanban item" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
     if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid ID format" }, { status: 400 })
    }
    const client = await clientPromise
    const db = client.db("DeployZen")

    const itemToDelete = await db.collection("kanban").findOne({ _id: new ObjectId(id) });
    if (!itemToDelete) {
        return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
    }

    const result = await db.collection("kanban").deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: "Item not found during delete" }, { status: 404 })
    }

    await logActivity(`Deleted kanban item '${itemToDelete.title || id}'`)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Failed to delete kanban item" }, { status: 500 })
  }
}