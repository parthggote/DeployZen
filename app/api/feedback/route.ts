import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const FEEDBACK_LOG = path.join(process.cwd(), "data", "feedback-log.md")

export async function POST(req: NextRequest) {
  try {
    const { testId, value } = await req.json()
    const timestamp = new Date().toISOString()
    const logEntry = `- ${timestamp} | testId: ${testId} | value: ${value}\n`
    fs.appendFileSync(FEEDBACK_LOG, logEntry)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}