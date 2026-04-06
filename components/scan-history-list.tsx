"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  Loader2,
  ShieldAlert,
  Trash2,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  viewportClassName?: string
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
 * Returns the status icon and color for a scan record
 * @param {string} status - Scan status
 * @returns {{ Icon: React.ComponentType, color: string }}
 */
function statusMeta(status: string) {
  switch (status) {
    case "completed":
      return { Icon: CircleCheck, color: "text-success" }
    case "completed_with_errors":
      return { Icon: ShieldAlert, color: "text-warning" }
    case "failed":
      return { Icon: CircleX, color: "text-error" }
    case "running":
      return { Icon: Loader2, color: "text-primary", spin: true }
    case "queued":
    case "pending":
      return { Icon: Clock, color: "text-muted-foreground" }
    default:
      return { Icon: CircleDot, color: "text-muted-foreground" }
  }
}

/**
 * Displays a scrollable list of past scans with status indicators and delete action
 * @param {ScanHistoryListProps} props - Component props
 */
export function ScanHistoryList({
  scans,
  loading,
  selectedId,
  onSelect,
  onDelete,
  viewportClassName,
}: ScanHistoryListProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  /**
   * Handles the confirmed delete action
   */
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(deleteTarget)
    setDeleteTarget(null)
    try {
      await Promise.resolve(onDelete(deleteTarget))
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
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground/30" />
        <p className="mt-2 text-sm text-muted-foreground">No scans yet</p>
        <p className="text-xs text-muted-foreground/70">Select a repo and start scanning</p>
      </div>
    )
  }

  const deleteTargetScan = scans.find((s) => s._id === deleteTarget)

  return (
    <>
      <ScrollArea className={cn("h-[18rem] sm:h-[20rem]", viewportClassName)}>
        <div className="space-y-1 pr-3">
          {scans.map((scan) => {
            const { Icon, color, spin } = statusMeta(scan.status) as { Icon: React.ComponentType<{ className?: string }>; color: string; spin?: boolean }
            const isDeleting = deleting === scan._id

            return (
              <div
                key={scan._id}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all",
                  selectedId === scan._id
                    ? "border-primary/30 bg-primary/5"
                    : "border-transparent hover:border-border/60 hover:bg-background/80",
                  isDeleting && "opacity-50 pointer-events-none"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(scan._id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      color,
                      spin && "animate-spin"
                    )}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {scan.repoFullName}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="truncate">{scan.branch}</span>
                      <span>·</span>
                      <span className="shrink-0">{timeAgo(scan.startedAt)}</span>
                    </div>
                  </div>

                  {scan.summary && (scan.status === "completed" || scan.status === "completed_with_errors") && (
                    <div className="flex shrink-0 items-center gap-1">
                      {scan.status === "completed_with_errors" && (
                        <Badge className="bg-warning/10 text-warning hover:bg-warning/10 text-[9px] px-1 py-0">
                          partial
                        </Badge>
                      )}
                      {scan.summary.critical > 0 && (
                        <Badge className="bg-error/10 text-error hover:bg-error/10 text-[9px] px-1 py-0">
                          {scan.summary.critical}
                        </Badge>
                      )}
                      {scan.summary.warning > 0 && (
                        <Badge className="bg-warning/10 text-warning hover:bg-warning/10 text-[9px] px-1 py-0">
                          {scan.summary.warning}
                        </Badge>
                      )}
                    </div>
                  )}
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 rounded-lg text-muted-foreground/40 hover:text-error hover:bg-error/10 transition-all"
                  disabled={isDeleting}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDeleteTarget(scan._id)
                  }}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete scan?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will permanently delete the scan for{" "}
              <span className="font-medium text-foreground">{deleteTargetScan?.repoFullName}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs rounded-lg bg-error text-error-foreground hover:bg-error/90"
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
