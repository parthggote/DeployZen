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
  ShieldCheck,
  TrendingUp,
} from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

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

  const loadModels = async () => {
    try {
      const response = await fetch("/api/models")
      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
      }
    } catch (error) {
      console.error("Error loading models:", error)
      setModels([])
    } finally {
      setLoading(false)
    }
  }

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

  const runningModels = models.filter((model) => model.status === "Running")
  const pendingModels = models.filter((model) => model.status === "Pending" || model.status === "Initializing")
  const failedModels = models.filter((model) => model.status === "Failed")
  const modelsWithPorts = models.filter((model) => model.port).length

  const statusBlocks = [
    {
      label: "Running runtimes",
      value: runningModels.length,
      helper: runningModels.length ? "Actively serving or ready" : "No active runtimes",
      icon: CheckCircle,
      tone: "text-success",
      surface: "bg-success/10",
    },
    {
      label: "Pending review",
      value: pendingModels.length,
      helper: pendingModels.length ? "Still initializing or waiting" : "No pending runtimes",
      icon: Clock,
      tone: "text-warning",
      surface: "bg-warning/10",
    },
    {
      label: "Network endpoints",
      value: modelsWithPorts,
      helper: "Models exposing a reachable port",
      icon: TrendingUp,
      tone: "text-info",
      surface: "bg-info/10",
    },
  ]

  const getStatusBadge = (status: ModelData["status"]) => {
    switch (status) {
      case "Running":
        return "bg-success/10 text-success hover:bg-success/10"
      case "Pending":
      case "Initializing":
        return "bg-warning/10 text-warning hover:bg-warning/10"
      case "Failed":
        return "bg-error/10 text-error hover:bg-error/10"
      default:
        return "bg-muted text-muted-foreground hover:bg-muted"
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-4">
                <Badge variant="outline" className="w-fit rounded-full border-border/70 bg-background px-3 py-1">
                  Monitoring workspace
                </Badge>
                <div className="space-y-2">
                  <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[2rem]">Runtime monitor</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Real deployment state without fabricated telemetry.
                  </p>
                </div>
              </div>
              <Button variant="outline" className="rounded-full border-border/70 bg-background/80" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing" : "Refresh status"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-gradient-to-br from-background to-surface-secondary shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-3xl bg-primary/10 p-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Monitoring note</p>
                <h2 className="text-xl font-medium tracking-tight">
                  {loading ? "Loading runtime posture" : failedModels.length ? "Some runtimes need attention" : "Runtime posture looks steady"}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {loading
                    ? "Gathering current model state."
                    : failedModels.length
                      ? `${failedModels.length} model${failedModels.length === 1 ? "" : "s"} need review.`
                      : "No failed model states reported."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {statusBlocks.map((item) => (
          <Card key={item.label} className="border-border/70 bg-surface/75 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className={`rounded-2xl p-3 ${item.surface}`}>
                  <item.icon className={`h-5 w-5 ${item.tone}`} />
                </div>
                <Badge variant="secondary" className="rounded-full border border-border/60 bg-background px-3 py-1">
                  Snapshot
                </Badge>
              </div>
              <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.helper}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Runtime inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {models.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 py-12 text-center">
                <Server className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">No models deployed</h3>
                <p className="mt-2 text-sm text-muted-foreground">Deploy models to populate the monitoring workspace.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[34rem] pr-4">
                <Accordion type="multiple" defaultValue={models.slice(0, 1).map((model) => model.id)} className="w-full">
                  {models.map((model) => (
                    <AccordionItem
                      key={model.id}
                      value={model.id}
                      className="mb-3 overflow-hidden rounded-3xl border border-border/70 bg-background/80 px-5 shadow-sm"
                    >
                      <AccordionTrigger className="py-5 text-left hover:no-underline">
                        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="rounded-2xl bg-info/10 p-3">
                              <Cpu className="h-5 w-5 text-info" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold">{model.modelName}</p>
                              <p className="text-sm font-normal text-muted-foreground">
                                {model.mode} / Created {new Date(model.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge className={`rounded-full ${getStatusBadge(model.status)}`}>{model.status}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Port</p>
                            <p className="mt-2 text-lg font-semibold">{model.port ?? "Not exposed"}</p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tokens</p>
                            <p className="mt-2 text-lg font-semibold">{model.tokens}</p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Last activity</p>
                            <p className="mt-2 text-sm font-medium">
                              {model.lastActivity ? new Date(model.lastActivity).toLocaleString() : "No activity recorded"}
                            </p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Monitoring notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={["telemetry", "system"]} className="w-full">
              <AccordionItem value="telemetry" className="border-border/60">
                <AccordionTrigger className="py-5 text-left hover:no-underline">
                  <div>
                    <p className="text-base font-semibold">Telemetry availability</p>
                    <p className="text-sm font-normal text-muted-foreground">Why some charts are absent</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                      <div className="flex items-start gap-3">
                        <Activity className="mt-0.5 h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Live metrics are not yet backed by a persisted telemetry source</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            This page avoids inventing latency, throughput, or GPU numbers.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                        <p className="text-sm font-medium">Models with activity timestamps</p>
                        <p className="mt-2 text-2xl font-semibold">{models.filter((model) => model.lastActivity).length}</p>
                      </div>
                      <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                        <p className="text-sm font-medium">Failed model states</p>
                        <p className="mt-2 text-2xl font-semibold text-error">{failedModels.length}</p>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="system" className="border-border/60">
                <AccordionTrigger className="py-5 text-left hover:no-underline">
                  <div>
                    <p className="text-base font-semibold">System posture</p>
                    <p className="text-sm font-normal text-muted-foreground">Signals the workspace can verify</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium">Deployment inventory</span>
                      </div>
                      <Badge className="rounded-full bg-success/10 text-success hover:bg-success/10">Available</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium">Live telemetry pipeline</span>
                      </div>
                      <Badge className="rounded-full bg-warning/10 text-warning hover:bg-warning/10">Not configured</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium">Runtime status polling</span>
                      </div>
                      <Badge className="rounded-full bg-success/10 text-success hover:bg-success/10">Active</Badge>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
