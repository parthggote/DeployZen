"use client"

import { useEffect, useState } from "react"
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Cpu,
  RefreshCw,
  Server,
  TrendingUp,
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
  filePath: string
  mode: "ollama" | "llama.cpp" | "onnx" | "torch" | "huggingface"
  tokens: number
  batchSize: number
  status: "Pending" | "Running" | "Failed" | "Stopped" | "Initializing"
  port?: number
  createdAt: string
  lastActivity?: string
  processId?: number
}

export default function MonitoringPage() {
  const [models, setModels] = useState<ModelData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedModel, setExpandedModel] = useState<string | null>(null)

  /**
   * Loads all deployed models from the API
   */
  const loadModels = async () => {
    try {
      const response = await fetch("/api/models")
      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
      }
    } catch (error) {
      logger.error("Failed to load models", { error: error instanceof Error ? error.message : String(error) })
      setModels([])
    } finally {
      setLoading(false)
    }
  }

  /**
   * Manually refreshes the model list
   */
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadModels()
    setRefreshing(false)
  }

  useEffect(() => {
    loadModels()
    const interval = setInterval(loadModels, 30000)
    return () => clearInterval(interval)
  }, [])

  const runningModels = models.filter((m) => m.status === "Running")
  const pendingModels = models.filter((m) => m.status === "Pending" || m.status === "Initializing")
  const failedModels = models.filter((m) => m.status === "Failed")
  const modelsWithPorts = models.filter((m) => m.port).length
  const modelsWithActivity = models.filter((m) => m.lastActivity).length

  const statusBlocks = [
    { label: "Running", value: runningModels.length, icon: CheckCircle, tone: "text-success", surface: "bg-success/10" },
    { label: "Pending", value: pendingModels.length, icon: Clock, tone: "text-warning", surface: "bg-warning/10" },
    { label: "Endpoints", value: modelsWithPorts, icon: TrendingUp, tone: "text-info", surface: "bg-info/10" },
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
      {/* ── Compact header ── */}
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem]">Runtime monitor</h1>
          <p className="text-sm text-muted-foreground">Live deployment state and system signals.</p>
        </div>
        <div className="flex items-center gap-3">
          {failedModels.length > 0 && (
            <Badge variant="secondary" className="rounded-full bg-error/10 text-error">{failedModels.length} failed</Badge>
          )}
          <Button variant="outline" className="rounded-full border-border/70 bg-background/80" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 icon-sm ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </section>

      {/* ── Stat cards ── */}
      <section className="grid gap-4 md:grid-cols-3">
        {statusBlocks.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border/60 bg-surface/80 p-5">
            <div className="mb-3">
              <div className={`inline-flex rounded-xl p-2 ${item.surface}`}>
                <item.icon className={`icon-sm ${item.tone}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{item.value}</p>
          </div>
        ))}
      </section>

      {/* ── Runtime inventory + System signals side-by-side ── */}
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Runtime inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {models.length === 0 ? (
              <div className="flex h-[20rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/70">
                <div className="text-center">
                  <Server className="mx-auto mb-3 icon-lg text-muted-foreground/50" />
                  <h3 className="font-medium">No models deployed</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Deploy models to populate this view.</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[24rem]">
                <div className="space-y-2 pr-3">
                  {models.map((model) => {
                    const isOpen = expandedModel === model.id
                    return (
                      <div key={model.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/80">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-secondary/50"
                          onClick={() => setExpandedModel(isOpen ? null : model.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-info/10 p-1.5">
                              <Cpu className="icon-sm text-info" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{model.modelName}</p>
                              <p className="text-[11px] text-muted-foreground">{model.mode} · {new Date(model.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <Badge className={`rounded-full text-[10px] ${getModelStatusStyle(model.status)}`}>{model.status}</Badge>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border/60 px-4 pb-4 pt-3">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Port</p>
                                <p className="mt-1 text-sm font-semibold">{model.port ?? "Not exposed"}</p>
                              </div>
                              <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tokens</p>
                                <p className="mt-1 text-sm font-semibold">{model.tokens}</p>
                              </div>
                              <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last activity</p>
                                <p className="mt-1 text-xs font-medium">
                                  {model.lastActivity ? new Date(model.lastActivity).toLocaleString() : "No activity"}
                                </p>
                              </div>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">System signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Quick stats */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-surface-secondary p-4">
                <p className="text-xs text-muted-foreground">Models with activity</p>
                <p className="mt-1 text-xl font-semibold">{modelsWithActivity}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-secondary p-4">
                <p className="text-xs text-muted-foreground">Failed states</p>
                <p className="mt-1 text-xl font-semibold text-error">{failedModels.length}</p>
              </div>
            </div>

            {/* System posture checklist */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">System posture</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="icon-xs text-success" />
                    <span className="text-sm">Deployment inventory</span>
                  </div>
                  <Badge className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success hover:bg-success/10">Available</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="icon-xs text-warning" />
                    <span className="text-sm">Live telemetry</span>
                  </div>
                  <Badge className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-warning hover:bg-warning/10">Not configured</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="icon-xs text-success" />
                    <span className="text-sm">Status polling</span>
                  </div>
                  <Badge className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success hover:bg-success/10">Active</Badge>
                </div>
              </div>
            </div>

            {/* Telemetry note */}
            <div className="rounded-xl border border-border/60 bg-surface-secondary p-4">
              <div className="flex items-start gap-2.5">
                <Activity className="mt-0.5 icon-sm text-primary" />
                <div>
                  <p className="text-sm font-medium">Telemetry not yet connected</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This page shows real deployment state. Latency and throughput metrics will appear once a telemetry pipeline is configured.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
