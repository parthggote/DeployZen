import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

async function logActivity(message: string) {
  try {
    const client = await clientPromise;
    const db = client.db("DeployZen");
    await db.collection("activity_log").insertOne({
      timestamp: new Date(),
      feature: "API Keys",
      summary: message,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string, keyId: string } }) {
  try {
    const { id: modelId, keyId } = params;

    if (!ObjectId.isValid(modelId) || !ObjectId.isValid(keyId)) {
        return NextResponse.json({ success: false, error: "Invalid ID format" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("DeployZen");

    const model = await db.collection("models").findOne({ _id: new ObjectId(modelId) });
    if (!model) {
        return NextResponse.json({ success: false, error: "Model not found" }, { status: 404 });
    }

    const result = await db.collection("api_keys").findOneAndUpdate(
        { _id: new ObjectId(keyId), modelId: new ObjectId(modelId) },
        { $set: { revokedAt: new Date().toISOString() } }
    );

    if (!result) {
        return NextResponse.json({ success: false, error: "Key not found" }, { status: 404 });
    }

    await logActivity(`Revoked API key (prefix ${result.prefix}) for model "${model.modelName}"`);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Error revoking key:", e);
    return NextResponse.json({ success: false, error: "Failed to revoke key" }, { status: 500 });
  }
}
