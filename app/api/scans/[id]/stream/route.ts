import { NextRequest } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export const maxDuration = 300

const POLL_MS = 1500
const STALE_SCAN_MS = 10 * 60 * 1000

/**
 * GET — Server-Sent Events stream for live scan updates.
 * Polls MongoDB and pushes state changes to the client.
 * @param {NextRequest} req - Incoming SSE request
 * @param {object} context - Route params containing scan ID
 * @returns {Response} SSE stream
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id || !ObjectId.isValid(id)) {
    return new Response(JSON.stringify({ error: "Invalid scan ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const encoder = new TextEncoder()
  let eventId = 0
  let lastHash = ""

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        eventId++
        controller.enqueue(
          encoder.encode(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      const poll = async () => {
        try {
          const client = await clientPromise
          const db = client.db("DeployZen")
          const scan = await db.collection("scans").findOne({ _id: new ObjectId(id) })

          if (!scan) {
            send("error", { error: "Scan not found" })
            clearInterval(timer)
            try { controller.close() } catch { /* already closed */ }
            return
          }

          const progressUpdatedAt = scan.progress?.updatedAt
            ? new Date(scan.progress.updatedAt).getTime()
            : NaN

          if (
            scan.status === "running"
            && Number.isFinite(progressUpdatedAt)
            && Date.now() - progressUpdatedAt > STALE_SCAN_MS
          ) {
            const staleError = "Scan stalled before completion. The worker may have restarted or timed out."
            await db.collection("scans").updateOne(
              { _id: new ObjectId(id) },
              {
                $set: {
                  status: "failed",
                  completedAt: new Date().toISOString(),
                  error: staleError,
                  progress: { ...(scan.progress || {}), stage: "Failed", percent: 0, updatedAt: new Date().toISOString() },
                },
              }
            )
            scan.status = "failed"
            scan.error = staleError
          }

          const hash = `${scan.status}|${scan.progress?.stage}|${scan.progress?.percent}|${scan.findings?.length}|${scan.fileTree?.length}`

          if (hash !== lastHash) {
            lastHash = hash

            const isTerminal = ["completed", "completed_with_errors", "failed"].includes(scan.status)

            send("scan_update", {
              scan: {
                _id: scan._id.toString(),
                repoFullName: scan.repoFullName,
                branch: scan.branch,
                commitSha: scan.commitSha,
                status: scan.status,
                startedAt: scan.startedAt,
                completedAt: scan.completedAt,
                fileTree: scan.fileTree || [],
                findings: scan.findings || [],
                summary: scan.summary || null,
                progress: scan.progress || null,
                aiExplanations: scan.aiExplanations || {},
                chatHistory: scan.chatHistory || [],
                error: scan.error || null,
              },
              isTerminal,
            })

            if (isTerminal) {
              clearInterval(timer)
              try { controller.close() } catch { /* already closed */ }
            }
          }
        } catch {
          /* transient DB errors are non-fatal for the stream */
        }
      }

      await poll()
      const timer = setInterval(poll, POLL_MS)

      req.signal.addEventListener("abort", () => {
        clearInterval(timer)
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
