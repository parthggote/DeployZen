"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Upload, Cpu, Zap, Clock, ListFilter } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const statusIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: XCircle,
  upload: Upload,
  deployment: Cpu,
  test: Zap,
  pending: Clock,
  info: Clock,
  other: Clock,
}

interface ActivityItem {
  title: string
  description: string
  status: string
  type: string
  time: string
}

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Upload", value: "upload" },
  { label: "Test", value: "test" },
  { label: "Deploy", value: "deployment" },
  { label: "Kanban", value: "kanban" },
  { label: "Error", value: "error" },
]

/**
 * Displays recent workspace activity with filter chips and fixed-height scroll
 */
export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState<ActivityItem | null>(null)

  /**
   * Fetches activity feed from the backend
   */
  function fetchActivity() {
    fetch("/api/activity")
      .then(res => res.json())
      .then(data => {
        if (data.success) setActivities(data.activities)
        else setError(data.error || "Failed to load activity")
      })
      .catch(() => setError("Failed to load activity"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(fetchActivity, 10000)
    return () => clearInterval(interval)
  }, [])

  const filtered = filter === "all"
    ? activities
    : filter === "error"
      ? activities.filter(a => a.status === "error")
      : activities.filter(a => a.type === filter)

  if (loading) return <div className="text-muted-foreground text-sm py-8 text-center">Loading activity...</div>
  if (error) return <div className="text-error text-sm py-8 text-center">{error}</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <ListFilter className="icon-xs text-muted-foreground" />
        {FILTERS.map(f => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            className="h-7 rounded-full px-2.5 text-[11px]"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[22rem]">
        <div className="space-y-1 pr-3">
          {filtered.length === 0 && (
            <div className="text-muted-foreground text-sm py-8 text-center">No recent activity.</div>
          )}
          {filtered.map((activity, i) => {
            const Icon = statusIconMap[activity.type] || statusIconMap[activity.status] || Clock
            return (
              <div
                key={i}
                className="flex items-start gap-3 cursor-pointer rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-secondary/60"
                onClick={() => setSelected(activity)}
                tabIndex={0}
                role="button"
                aria-label={`Show details for ${activity.title}`}
              >
                <div
                  className={`shrink-0 rounded-lg p-1.5 ${
                    activity.status === "success"
                      ? "bg-success/10"
                      : activity.status === "error"
                      ? "bg-error/10"
                      : activity.status === "pending"
                      ? "bg-warning/10"
                      : "bg-muted"
                  }`}
                >
                  <Icon
                    className={`icon-xs ${
                      activity.status === "success"
                        ? "text-success"
                        : activity.status === "error"
                        ? "text-error"
                        : activity.status === "pending"
                        ? "text-warning"
                        : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{activity.time}</span>
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{activity.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null) }}>
        <DialogContent className="max-w-lg rounded-2xl border-border/70">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Activity details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = statusIconMap[selected.type] || statusIconMap[selected.status] || Clock
                  return <Icon className="icon-sm" />
                })()}
                <span className="font-medium">{selected.title}</span>
                <Badge
                  variant="secondary"
                  className={`rounded-full text-[10px] ${
                    selected.status === "success" ? "bg-success/10 text-success"
                    : selected.status === "error" ? "bg-error/10 text-error"
                    : selected.status === "pending" ? "bg-warning/10 text-warning"
                    : ""
                  }`}
                >
                  {selected.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted-foreground">Type:</span> {selected.type}</div>
                <div><span className="text-muted-foreground">Time:</span> {selected.time}</div>
              </div>
              <p className="text-muted-foreground whitespace-pre-line">{selected.description}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
