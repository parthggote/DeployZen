import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Upload, Cpu, Zap, Clock, ListFilter } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const statusIconMap: Record<string, any> = {
  success: CheckCircle,
  error: XCircle,
  upload: Upload,
  deployment: Cpu,
  test: Zap,
  pending: Clock,
  info: Clock,
  other: Clock,
}

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Upload", value: "upload" },
  { label: "Test", value: "test" },
  { label: "Deployment", value: "deployment" },
  { label: "Kanban", value: "kanban" },
  { label: "Error", value: "error" },
]

export function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState<any | null>(null)

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

  if (loading) return <div className="text-muted-foreground text-sm">Loading activity...</div>
  if (error) return <div className="text-error text-sm">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ListFilter className="w-4 h-4 text-muted-foreground" />
        {FILTERS.map(f => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            className="text-xs px-2 py-1"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {filtered.length === 0 && <div className="text-muted-foreground text-sm">No recent activity.</div>}
      {filtered.map((activity, i) => {
        const Icon = statusIconMap[activity.type] || statusIconMap[activity.status] || Clock
        return (
          <div
            key={i}
            className="flex items-start space-x-3 cursor-pointer hover:bg-muted/40 rounded-md p-2"
            onClick={() => setSelected(activity)}
            tabIndex={0}
            role="button"
            aria-label={`Show details for ${activity.title}`}
          >
            <div
              className={`p-2 rounded-full ${
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
                className={`w-4 h-4 ${
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
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{activity.title}</p>
                <Badge
                  variant="secondary"
                  className={
                    activity.status === "success"
                      ? "bg-success/10 text-success"
                      : activity.status === "error"
                      ? "bg-error/10 text-error"
                      : activity.status === "pending"
                      ? "bg-warning/10 text-warning"
                      : ""
                  }
                >
                  {activity.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{activity.description}</p>
              <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
            </div>
          </div>
        )
      })}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = statusIconMap[selected.type] || statusIconMap[selected.status] || Clock
                  return <Icon className="w-5 h-5" />
                })()}
                <span className="font-semibold text-base">{selected.title}</span>
                <Badge
                  variant="secondary"
                  className={
                    selected.status === "success"
                      ? "bg-success/10 text-success"
                      : selected.status === "error"
                      ? "bg-error/10 text-error"
                      : selected.status === "pending"
                      ? "bg-warning/10 text-warning"
                      : ""
                  }
                >
                  {selected.status}
                </Badge>
              </div>
              <div>
                <span className="font-semibold">Type:</span> {selected.type}
              </div>
              <div>
                <span className="font-semibold">Time:</span> {selected.time}
              </div>
              <div>
                <span className="font-semibold">Description:</span>
                <div className="text-muted-foreground mt-1 whitespace-pre-line">{selected.description}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
