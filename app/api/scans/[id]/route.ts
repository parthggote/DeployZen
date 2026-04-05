import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import logger from "@/lib/logger"

/**
 * GET — Retrieves full scan results by ID
 * @param {NextRequest} _req - Incoming request
 * @param {object} context - Route params containing scan ID
 * @returns {NextResponse} Full scan document
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid scan ID" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const scan = await db.collection("scans").findOne({ _id: new ObjectId(id) })

    if (!scan) {
      return NextResponse.json(
        { success: false, error: "Scan not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, scan })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to fetch scan", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
