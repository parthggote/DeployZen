import { NextResponse } from "next/server"

/**
 * GET — Returns basic health status for the Next.js application.
 * Used by external uptime monitors and frontend pre-warm logic.
 * @returns {NextResponse} JSON with status, timestamp, and uptime
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
}
