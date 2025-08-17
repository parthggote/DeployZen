import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function POST(req: NextRequest) {
  try {
    const { testId, value } = await req.json()

    const client = await clientPromise
    const db = client.db("DeployZen")

    const feedbackEntry = {
      testId,
      value,
      createdAt: new Date(),
    }

    await db.collection("feedback").insertOne(feedbackEntry)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ success: false, error: "Failed to submit feedback" }, { status: 500 })
  }
}