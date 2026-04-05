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

/**
 * DELETE — Removes a scan record from the database
 * @param {NextRequest} _req - Incoming request
 * @param {object} context - Route params containing scan ID
 * @returns {NextResponse} Success or error
 */
export async function DELETE(
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

    const result = await db.collection("scans").deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      logger.info("Scan delete requested for missing document", { scanId: id })
      return NextResponse.json({ success: true, alreadyDeleted: true })
    }

    logger.info("Scan deleted", { scanId: id })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to delete scan", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
