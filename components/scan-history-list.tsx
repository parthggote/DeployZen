"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  GitBranch,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface ScanSummary {
  total: number
  critical: number
  warning: number
  info: number
  filesScanned: number
}

export interface ScanRecord {
  _id: string
  repoFullName: string
  branch: string
  commitSha: string
  status: "queued" | "pending" | "running" | "completed" | "completed_with_errors" | "failed"
  startedAt: string
  completedAt: string | null
  summary: ScanSummary | null
  error?: string | null
  batchErrors?: Array<{ directory: string; error: string }> | null
}

interface ScanHistoryListProps {
  scans: ScanRecord[]
  loading: boolean
  selectedId: string | null
  onSelect: (scanId: string) => void
  onDelete: (scanId: string) => void | Promise<void>
}

/**
 * Returns a human-readable relative time string
 * @param {string} dateStr - ISO date string
 * @returns {string} Relative time (e.g. "2h ago")
 */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Displays a scrollable list of past scans with status indicators and delete action
 * @param {ScanHistoryListProps} props - Component props
 */
export function ScanHistoryList({ scans, loading, selectedId, onSelect, onDelete }: ScanHistoryListProps) {
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  /**
   * Handles the delete action with confirmation
   * @param {string} scanId - Scan ID to delete
   */
  async function handleDelete(scanId: string) {
    if (confirmingDelete !== scanId) {
      setConfirmingDelete(scanId)
      setTimeout(() => setConfirmingDelete(null), 3000)
      return
    }

    setDeleting(scanId)
    setConfirmingDelete(null)
    try {
      await Promise.resolve(onDelete(scanId))
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="icon-md animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div className="py-8 text-center">
        <GitBranch className="mx-auto icon-lg text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No scans yet</p>
        <p className="text-xs text-muted-foreground/70">Select a repo and start scanning</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[20rem]">
      <div className="space-y-1.5 pr-3">
        {scans.map((scan) => {
          const StatusIcon =
            scan.status === "completed"
              ? CheckCircle
              : scan.status === "completed_with_errors"
                ? AlertTriangle
                : scan.status === "failed"
                  ? XCircle
                  : scan.status === "running"
                    ? Loader2
                    : Clock

          const statusColor =
            scan.status === "completed"
              ? "text-success"
              : scan.status === "completed_with_errors"
                ? "text-warning"
                : scan.status === "failed"
                  ? "text-error"
                  : "text-warning"

          const isConfirming = confirmingDelete === scan._id
          const isDeleting = deleting === scan._id

          return (
            <div
              key={scan._id}
              className={cn(
                "group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                selectedId === scan._id
                  ? "border-primary/30 bg-primary/5"
                  : "border-transparent hover:border-border/60 hover:bg-background/80"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(scan._id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <StatusIcon
                  className={cn(
                    "icon-sm shrink-0",
                    statusColor,
                    scan.status === "running" && "animate-spin"
                  )}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {scan.repoFullName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{scan.branch}</span>
                    <span>·</span>
                    <span>{timeAgo(scan.startedAt)}</span>
                  </div>
                </div>

                {scan.summary && (scan.status === "completed" || scan.status === "completed_with_errors") && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {scan.status === "completed_with_errors" && (
                      <Badge className="bg-warning/10 text-warning hover:bg-warning/10 text-[10px] px-1.5 py-0">
                        partial
                      </Badge>
                    )}
                    {scan.summary.critical > 0 && (
                      <Badge className="bg-error/10 text-error hover:bg-error/10 text-[10px] px-1.5 py-0">
                        {scan.summary.critical}
                      </Badge>
                    )}
                    {scan.summary.warning > 0 && (
                      <Badge className="bg-warning/10 text-warning hover:bg-warning/10 text-[10px] px-1.5 py-0">
                        {scan.summary.warning}
                      </Badge>
                    )}
                    {scan.summary.info > 0 && (
                      <Badge className="bg-info/10 text-info hover:bg-info/10 text-[10px] px-1.5 py-0">
                        {scan.summary.info}
                      </Badge>
                    )}
                  </div>
                )}

                {scan.status === "failed" && (
                  <AlertTriangle className="icon-xs shrink-0 text-error" />
                )}
              </button>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 shrink-0 rounded-lg transition-all",
                  isConfirming
                    ? "bg-error/10 text-error opacity-100"
                    : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10"
                )}
                disabled={isDeleting}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(scan._id)
                }}
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
