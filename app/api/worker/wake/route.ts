import { NextResponse } from "next/server"
import logger from "@/lib/logger"

const SEMGREP_WORKER_URL = process.env.SEMGREP_WORKER_URL || ""
const WAKE_TIMEOUT_MS = 45_000

/**
 * GET — Pings the semgrep-worker health endpoint to wake it from
 * Render's free-tier sleep. Returns the worker's health response
 * or a descriptive error so the frontend can show appropriate UI.
 * @returns {NextResponse} Worker health status or error details
 */
export async function GET() {
  if (!SEMGREP_WORKER_URL) {
    return NextResponse.json(
      { status: "unconfigured", message: "SEMGREP_WORKER_URL is not set" },
      { status: 503 }
    )
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS)

    const res = await fetch(`${SEMGREP_WORKER_URL}/health`, {
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      logger.warn("Worker health check returned non-OK", { status: res.status })
      return NextResponse.json(
        { status: "unhealthy", workerStatus: res.status },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json({ status: "ok", worker: data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const isAbort = error instanceof DOMException && error.name === "AbortError"

    logger.warn("Worker wake ping failed", {
      error: message,
      timedOut: isAbort,
    })

    return NextResponse.json(
      {
        status: "waking",
        message: isAbort
          ? "Worker is cold-starting, may take up to 60 seconds"
          : `Worker unreachable: ${message}`,
      },
      { status: 503 }
    )
  }
}
