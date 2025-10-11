import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { writeFile, mkdir, access } from "fs/promises";
import { join } from "path";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
  const client = await clientPromise;
  const db = client.db("DeployZen");
  try {
    const formData = await req.formData();
    const file = formData.get("apiFile") as File;
    const description = formData.get("description") as string;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), "uploads");
    try {
      await access(uploadsDir);
    } catch (error) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const fileContents = await file.text();
    const uniqueId = new ObjectId().toHexString();
    const fileName = `${uniqueId}-${file.name}`;
    const filePath = join(uploadsDir, fileName);

    await writeFile(filePath, fileContents);

    const result = await db.collection("apis").insertOne({
      _id: new ObjectId(uniqueId),
      name: file.name.replace(/\.[^/.]+$/, ""),
      description,
      filePath,
      fileName: file.name,
      fileSize: file.size,
      testCases: [],
      status: "uploaded",
      createdAt: new Date().toISOString(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
    });

    return NextResponse.json({ success: true, apiId: result.insertedId });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json({ success: false, error: "Failed to upload API" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
    const client = await clientPromise
    const db = client.db("DeployZen")
    try {
      const apis = await db.collection("apis").find({}).toArray()
      const apisWithId = apis.map(api => ({ ...api, id: api._id.toString() }))
      return NextResponse.json({ success: true, apis: apisWithId })
    } catch (e) {
      return NextResponse.json({ success: false, error: "Failed to load APIs", apis: [] }, { status: 500 })
    }
}
