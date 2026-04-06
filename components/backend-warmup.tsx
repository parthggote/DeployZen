"use client"

import { useEffect, useRef } from "react"

const WARMUP_INTERVAL_MS = 10 * 60 * 1000

/**
 * Invisible client component that pings the worker wake endpoint
 * on mount and periodically while the tab is visible, keeping the
 * Render free-tier semgrep-worker from sleeping.
 */
export function BackendWarmup() {
  const pingedRef = useRef(false)

  useEffect(() => {
    const ping = () => { fetch("/api/worker/wake").catch(() => {}) }
    let interval: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (interval) return
      interval = setInterval(ping, WARMUP_INTERVAL_MS)
    }
    const stop = () => {
      if (!interval) return
      clearInterval(interval)
      interval = null
    }
    const onVis = () => {
      if (document.hidden) stop()
      else start()
    }

    if (!pingedRef.current) {
      pingedRef.current = true
      ping()
    }

    start()
    document.addEventListener("visibilitychange", onVis)
    return () => { stop(); document.removeEventListener("visibilitychange", onVis) }
  }, [])

  return null
}
