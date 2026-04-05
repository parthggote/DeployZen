import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import logger from "@/lib/logger"

interface Finding {
  ruleId: string
  severity: string
  message: string
  filePath: string
  startLine: number
  endLine: number
  snippet: string
  category: string
}

interface FileTreeEntry {
  path: string
  type: string
  size?: number
  findingCount: number
}

interface IncrementalPayload {
  directory: string
  findings: Finding[]
  fileTree: FileTreeEntry[]
  scannedDirs: string[]
  totalDirs: number
  currentDir: string | null
  stats: {
    total: number
    critical: number
    warning: number
    info: number
    filesScanned: number
  }
}

interface CompletionPayload {
  status: "completed" | "failed"
  error?: string
  findings?: Finding[]
  fileTree?: FileTreeEntry[]
  stats?: {
    total: number
    critical: number
    warning: number
    info: number
    filesScanned: number
  }
}

function buildSummary(
  findings: Finding[],
  stats: {
    total: number
    critical: number
    warning: number
    info: number
    filesScanned: number
  }
) {
  const categoryMap: Record<string, number> = {}

  for (const finding of findings) {
    categoryMap[finding.category] = (categoryMap[finding.category] || 0) + 1
  }

  const topCategories = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    total: stats.total,
    critical: stats.critical,
    warning: stats.warning,
    info: stats.info,
    filesScanned: stats.filesScanned,
    topCategories,
  }
}

/**
 * PATCH — Accepts incremental findings from the Semgrep worker
 * Appends new findings, merges file tree, updates progress and summary
 * @param {NextRequest} req - Request with partial findings payload
 * @param {object} context - Route params containing scan ID
 * @returns {NextResponse} Success acknowledgement
 */
export async function PATCH(
  req: NextRequest,
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

    const payload: IncrementalPayload = await req.json()
    const { directory, findings, fileTree, scannedDirs, totalDirs, currentDir, stats } = payload

    const client = await clientPromise
    const db = client.db("DeployZen")

    const percent = Math.min(90, Math.round((scannedDirs.length / totalDirs) * 85) + 10)

    const existingDoc = await db.collection("scans").findOne(
      { _id: new ObjectId(id) },
      { projection: { findings: 1, fileTree: 1 } }
    )

    const existingFindings: Finding[] = existingDoc?.findings || []
    const allFindings = [...existingFindings, ...findings]
    const summary = buildSummary(allFindings, stats)

    const scanningLabel = currentDir
      ? `Scanning: ${currentDir}`
      : `Scanned ${scannedDirs.length}/${totalDirs} directories`

    const existingPaths = new Set<string>()
    if (existingDoc?.fileTree) {
      for (const entry of existingDoc.fileTree as FileTreeEntry[]) {
        existingPaths.add(entry.path)
      }
    }

    const newTreeEntries = (fileTree || []).filter(
      (entry: FileTreeEntry) => !existingPaths.has(entry.path)
    )

    await db.collection("scans").updateOne(
      { _id: new ObjectId(id) },
      {
        $push: {
          findings: { $each: findings },
          fileTree: { $each: newTreeEntries },
        },
        $set: {
          summary,
          progress: {
            stage: scanningLabel,
            percent,
            updatedAt: new Date().toISOString(),
            currentDir: currentDir || null,
            scannedDirs,
            totalDirs,
          },
        },
      } as Record<string, unknown>
    )

    logger.info("Incremental findings received", {
      scanId: id,
      directory,
      newFindings: findings.length,
      totalFindings: stats.total,
      progress: `${scannedDirs.length}/${totalDirs}`,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to process incremental findings", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST — Finalises a scan after the worker finishes
 * @param {NextRequest} req - Request with final scan payload
 * @param {object} context - Route params containing scan ID
 * @returns {NextResponse} Success acknowledgement
 */
export async function POST(
  req: NextRequest,
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

    const payload: CompletionPayload = await req.json()
    const client = await clientPromise
    const db = client.db("DeployZen")

    if (payload.status === "failed") {
      await db.collection("scans").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: "failed",
            completedAt: new Date().toISOString(),
            error: payload.error || "Scan failed",
            progress: { stage: "Failed", percent: 0, updatedAt: new Date().toISOString() },
          },
        }
      )

      logger.error("Worker marked scan as failed", { scanId: id, error: payload.error })
      return NextResponse.json({ success: true })
    }

    const findings = payload.findings || []
    const fileTree = payload.fileTree || []
    const stats = payload.stats || {
      total: findings.length,
      critical: findings.filter((f) => f.severity === "ERROR").length,
      warning: findings.filter((f) => f.severity === "WARNING").length,
      info: findings.filter((f) => f.severity === "INFO").length,
      filesScanned: fileTree.filter((entry) => entry.type === "file").length,
    }

    const summary = buildSummary(findings, stats)

    await db.collection("scans").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "completed",
          completedAt: new Date().toISOString(),
          findings,
          fileTree,
          summary,
          progress: { stage: "Complete", percent: 100, updatedAt: new Date().toISOString() },
          error: null,
        },
      }
    )

    logger.info("Worker finalized scan", { scanId: id, findings: findings.length })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to finalize scan", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
