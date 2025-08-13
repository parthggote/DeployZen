import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const ACTIVITY_LOG = path.join(process.cwd(), "data", "activity-log.md")

function parseActivityLog(md: string) {
  // Split by log entries (## timestamp)
  const entries = md.split(/^## /gm).slice(1)
  const activities = entries.map(entry => {
    const [timestampLine, ...rest] = entry.split("\n")
    const time = timestampLine.trim()
    const summaryLine = rest.find(line => line.startsWith("- Summary:")) || ""
    const featureLine = rest.find(line => line.startsWith("- Feature:")) || ""
    const title = featureLine.replace("- Feature:", "").trim() || "Activity"
    const description = summaryLine.replace("- Summary:", "").trim()
    // Heuristic: set type/status based on keywords
    let type = "other", status = "info"
    if (/test/i.test(title) || /test/i.test(description)) type = "test"
    if (/deploy/i.test(title) || /deploy/i.test(description)) type = "deployment"
    if (/upload/i.test(title) || /upload/i.test(description)) type = "upload"
    if (/fail|error/i.test(title) || /fail|error/i.test(description)) status = "error"
    else if (/success|complete|deployed|created/i.test(title) || /success|complete|deployed|created/i.test(description)) status = "success"
    else if (/start|init|pending/i.test(title) || /start|init|pending/i.test(description)) status = "pending"
    return {
      type, title, description, time, status
    }
  })
  return activities.slice(0, 10)
}

export async function GET() {
  try {
    const md = fs.readFileSync(ACTIVITY_LOG, "utf8")
    const activities = parseActivityLog(md)
    return NextResponse.json({ success: true, activities })
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to read activity log" }, { status: 500 })
  }
}