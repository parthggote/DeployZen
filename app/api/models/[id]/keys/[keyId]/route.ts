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

    const keyToRevoke = await db.collection("api_keys").findOne({ _id: new ObjectId(keyId), modelId: new ObjectId(modelId) });
    if (!keyToRevoke) {
        return NextResponse.json({ success: false, error: "Key not found" }, { status: 404 });
    }

    const result = await db.collection("api_keys").updateOne(
        { _id: new ObjectId(keyId) },
        { $set: { revokedAt: new Date().toISOString() } }
    );

    if (result.modifiedCount === 0 && !keyToRevoke.revokedAt) {
      // If no document was modified and it wasn't already revoked, something went wrong.
      return NextResponse.json({ success: false, error: "Failed to revoke key" }, { status: 500 });
    }

    await logActivity(`Revoked API key (prefix ${keyToRevoke.prefix}) for model "${model.modelName}"`);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Error revoking key:", e);
    return NextResponse.json({ success: false, error: "Failed to revoke key" }, { status: 500 });
  }
}
