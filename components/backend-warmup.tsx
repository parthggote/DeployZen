"use client"

import { useEffect, useRef } from "react"

const WARMUP_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Invisible client component that fires a lightweight request to the
 * worker wake endpoint on mount and periodically thereafter. This keeps
 * the Render free-tier semgrep-worker from sleeping while the user has
 * the dashboard open.
 */
export function BackendWarmup() {
  const pingedRef = useRef(false)

  useEffect(() => {
    /**
     * Sends a fire-and-forget ping to the worker wake endpoint
     */
    const ping = () => {
      fetch("/api/worker/wake").catch(() => {})
    }

    if (!pingedRef.current) {
      pingedRef.current = true
      ping()
    }

    const interval = setInterval(ping, WARMUP_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return null
}
