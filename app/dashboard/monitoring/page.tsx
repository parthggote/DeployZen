"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  Cpu,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { getModelStatusStyle } from "@/lib/status-styles"
import logger from "@/lib/logger"

interface ModelData {
  id: string
  modelName: string
  huggingFaceModelId: string
  task: string
  status: "Pending" | "Running" | "Loading" | "Failed"
  createdAt: string
  lastActivity?: string
  metrics?: { totalRequests: number; avgLatencyMs: number; lastError: string | null }
}

interface PerModelMetric {
  modelId: string
  modelName: string
  huggingFaceModelId: string
  task: string
  requestCount: number
  avgLatencyMs: number
  errorCount: number
  lastError: string | null
}

interface LatencyBucket {
  hour: string
  avgLatencyMs: number
  requestCount: number
}

interface MetricsData {
  totalRequests: number
  avgLatencyMs: number
  errorRate: number
  perModel: PerModelMetric[]
  latencyTrend: LatencyBucket[]
}

export default function MonitoringPage() {
  const [models, setModels] = useState<ModelData[]>([])
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedModel, setExpandedModel] = useState<string | null>(null)

  /**
   * Loads all models from the API
   */
  const loadModels = useCallback(async () => {
    try {
      const response = await fetch("/api/models")
      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
      }
    } catch (error) {
      logger.error("Failed to load models", { error: error instanceof Error ? error.message : String(error) })
      setModels([])
    }
  }, [])

  /**
   * Loads aggregated inference metrics from the API
   */
  const loadMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/models/metrics")
      if (response.ok) {
        const data = await response.json()
        if (data.success) setMetrics(data.metrics)
      }
    } catch (error) {
      logger.error("Failed to load metrics", { error: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  /**
   * Loads all data in parallel
   */
  const loadAll = useCallback(async () => {
    await Promise.all([loadModels(), loadMetrics()])
    setLoading(false)
  }, [loadModels, loadMetrics])

  /**
   * Manually refreshes all data
   */
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 30000)
    return () => clearInterval(interval)
  }, [loadAll])

  const runningModels = models.filter((m) => m.status === "Running")
  const pendingModels = models.filter((m) => m.status === "Pending" || m.status === "Loading")
  const failedModels = models.filter((m) => m.status === "Failed")

  const hasMetrics = metrics && metrics.totalRequests > 0
  const maxTrendLatency = metrics?.latencyTrend?.length
    ? Math.max(...metrics.latencyTrend.map((t) => t.avgLatencyMs), 1)
    : 1

  const statusBlocks = [
    { label: "Running", value: runningModels.length, icon: CheckCircle, tone: "text-success", surface: "bg-success/10" },
    { label: "Total requests", value: metrics?.totalRequests || 0, icon: Activity, tone: "text-info", surface: "bg-info/10" },
    { label: "Avg latency", value: metrics?.avgLatencyMs ? `${metrics.avgLatencyMs}ms` : "—", icon: Zap, tone: "text-warning", surface: "bg-warning/10" },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <section className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-surface/80 p-5 space-y-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between animate-slide-up-fade">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem] font-display">Runtime monitor</h1>
          <p className="text-sm text-muted-foreground">Live deployment state and inference metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          {failedModels.length > 0 && (
            <Badge variant="secondary" className="rounded-full bg-error/10 text-error">{failedModels.length} failed</Badge>
          )}
          <Button variant="outline" className="rounded-full border-border/70 bg-background/80 active:scale-[0.97] transition-transform" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid gap-4 md:grid-cols-3">
        {statusBlocks.map((item, idx) => (
          <div key={item.label} className={`rounded-2xl border border-border/60 bg-surface/80 p-5 animate-slide-up-fade stagger-${idx + 1}`}>
            <div className="mb-3">
              <div className={`inline-flex rounded-xl p-2 ${item.surface}`}>
                <item.icon className={`h-4 w-4 ${item.tone}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight font-mono tabular-nums">{item.value}</p>
          </div>
        ))}
      </section>

      {/* Runtime inventory + Telemetry side-by-side */}
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-display">Runtime inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {models.length === 0 ? (
              <div className="flex h-[20rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/70">
                <div className="text-center">
                  <Server className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                  <h3 className="font-medium">No models deployed</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Deploy models to populate this view.</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[24rem]">
                <div className="space-y-2 pr-3">
                  {models.map((model) => {
                    const isOpen = expandedModel === model.id
                    const modelMetric = metrics?.perModel.find((m) => m.modelId === model.id)
                    return (
                      <div key={model.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/80">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-secondary/50"
                          onClick={() => setExpandedModel(isOpen ? null : model.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="rounded-lg bg-info/10 p-1.5 shrink-0">
                              <Cpu className="h-4 w-4 text-info" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{model.modelName}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{model.task} · {new Date(model.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <Badge className={`rounded-full text-[10px] shrink-0 ${getModelStatusStyle(model.status)}`}>{model.status}</Badge>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border/60 px-4 pb-4 pt-3 animate-slide-up-fade">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Requests</p>
                                <p className="mt-1 text-sm font-semibold font-mono tabular-nums">{modelMetric?.requestCount || 0}</p>
                              </div>
                              <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg latency</p>
                                <p className="mt-1 text-sm font-semibold font-mono tabular-nums">{modelMetric?.avgLatencyMs ? `${modelMetric.avgLatencyMs}ms` : "—"}</p>
                              </div>
                              <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Errors</p>
                                <p className="mt-1 text-sm font-semibold font-mono tabular-nums text-error">{modelMetric?.errorCount || 0}</p>
                              </div>
                            </div>
                            {modelMetric?.lastError && (
                              <div className="mt-2 rounded-lg border border-error/20 bg-error/5 px-3 py-2">
                                <p className="text-[11px] text-error">Last error: {modelMetric.lastError}</p>
                              </div>
                            )}
                            <div className="mt-2 text-[11px] text-muted-foreground">
                              Last activity: {model.lastActivity ? new Date(model.lastActivity).toLocaleString() : "No activity"}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground font-display">Inference telemetry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Quick stats */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-surface-secondary p-4">
                <p className="text-xs text-muted-foreground">Error rate</p>
                <p className={`mt-1 text-xl font-semibold ${metrics?.errorRate && metrics.errorRate > 10 ? "text-error" : ""}`}>
                  {metrics?.errorRate !== undefined ? `${metrics.errorRate}%` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-secondary p-4">
                <p className="text-xs text-muted-foreground">Pending models</p>
                <p className="mt-1 text-xl font-semibold">{pendingModels.length}</p>
              </div>
            </div>

            {/* System posture */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">System posture</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                    <span className="text-sm">Deployment inventory</span>
                  </div>
                  <Badge className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success hover:bg-success/10">Available</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    {hasMetrics ? (
                      <CheckCircle className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-warning" />
                    )}
                    <span className="text-sm">Live telemetry</span>
                  </div>
                  <Badge className={`rounded-full px-2 py-0.5 text-[10px] ${
                    hasMetrics
                      ? "bg-success/10 text-success hover:bg-success/10"
                      : "bg-warning/10 text-warning hover:bg-warning/10"
                  }`}>
                    {hasMetrics ? "Active" : "No data yet"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                    <span className="text-sm">Status polling</span>
                  </div>
                  <Badge className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success hover:bg-success/10">Active</Badge>
                </div>
              </div>
            </div>

            {/* Latency trend (last 24h) */}
            {hasMetrics && metrics.latencyTrend.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Latency trend (24h)</p>
                </div>
                <div className="flex h-20 items-end gap-[2px] rounded-xl border border-border/60 bg-surface-secondary p-3">
                  {metrics.latencyTrend.map((bucket, i) => {
                    const height = Math.max((bucket.avgLatencyMs / maxTrendLatency) * 100, 4)
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-primary/60 transition-all hover:bg-primary"
                        style={{ height: `${height}%` }}
                        title={`${bucket.hour}\n${bucket.avgLatencyMs}ms avg\n${bucket.requestCount} requests`}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>24h ago</span>
                  <span>Now</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-surface-secondary p-4">
                <div className="flex items-start gap-2.5">
                  <Activity className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {hasMetrics ? "No recent trend data" : "Run an inference to start collecting metrics"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Latency charts and per-model breakdowns will appear here once you test models from the deployments page.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
