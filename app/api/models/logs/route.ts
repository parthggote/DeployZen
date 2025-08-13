import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVITY_LOG = path.join(DATA_DIR, "activity-log.md")

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export async function GET() {
  try {
    ensureDataDir()

    let logs = ""

    if (fs.existsSync(ACTIVITY_LOG)) {
      logs = fs.readFileSync(ACTIVITY_LOG, "utf8")
    } else {
      // Create initial log file
      logs = `# Activity Log

## ${new Date().toISOString()}
📝 Activity log initialized

`
      fs.writeFileSync(ACTIVITY_LOG, logs)
    }

    return NextResponse.json({
      success: true,
      logs,
    })
  } catch (error) {
    console.error("Error reading logs:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to read logs",
        logs: "# Activity Log\n\n❌ Error loading activity logs. Please try again.",
      },
      { status: 500 },
    )
  }
}
