"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  CheckCircle,
  CheckCircle2,
  Clock,
  Cpu,
  RefreshCw,
  TrendingUp,
  XCircle,
  Zap,
  ArrowRight,
} from "lucide-react"

import { RecentActivity } from "@/components/recent-activity"
import { StatsChart } from "@/components/stats-chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { getModelStatusStyle, getTestStatusStyle } from "@/lib/status-styles"
import logger from "@/lib/logger"

interface ModelData {
  id: string
  modelName: string
  filePath: string
  mode: "ollama" | "llama.cpp"
  tokens: number
  batchSize: number
  status: "Pending" | "Running" | "Failed" | "Stopped"
  port?: number
  createdAt: string
  lastActivity?: string
  processId?: number
}

interface ApiData {
  id: string
  name: string
  description?: string
  filePath: string
  fileName: string
  fileSize: number
  testCases: unknown[]
  status: "uploaded" | "testing" | "completed"
  createdAt: string
  lastTested?: string
  totalTests: number
  passedTests: number
  failedTests: number
}

const statCardStyles = [
  { title: "APIs uploaded", icon: CheckCircle2, tone: "text-primary", surface: "bg-primary/10" },
  { title: "Models deployed", icon: Cpu, tone: "text-info", surface: "bg-info/10" },
  { title: "Test success rate", icon: TrendingUp, tone: "text-success", surface: "bg-success/10" },
  { title: "Executed checks", icon: Zap, tone: "text-warning", surface: "bg-warning/10" },
]

export default function DashboardPage() {
  const [models, setModels] = useState<ModelData[]>([])
  const [apis, setApis] = useState<ApiData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  /**
   * Fetches models and APIs concurrently to populate the dashboard
   */
  const loadData = async () => {
    try {
      const [modelsResponse, apisResponse] = await Promise.all([fetch("/api/models"), fetch("/api/apis")])

      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json()
        setModels(modelsData.models || [])
      }

      if (apisResponse.ok) {
        const apisData = await apisResponse.json()
        setApis(apisData.apis || [])
      }
    } catch (error) {
      logger.error("Failed to load dashboard data", { error: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Manually refreshes all dashboard data
   */
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalApis = apis.length
  const totalModels = models.length
  const runningModels = models.filter((m) => m.status === "Running").length
  const completedTests = apis.reduce((sum, a) => sum + a.totalTests, 0)
  const passedTests = apis.reduce((sum, a) => sum + a.passedTests, 0)
  const failedTests = apis.reduce((sum, a) => sum + a.failedTests, 0)
  const successRate = completedTests > 0 ? (passedTests / completedTests) * 100 : 0

  const statValues = [
    { value: totalApis, detail: totalApis > 0 ? `${completedTests} checks recorded` : "No APIs uploaded yet" },
    { value: totalModels, detail: runningModels > 0 ? `${runningModels} live right now` : "No active runtimes" },
    { value: `${successRate.toFixed(1)}%`, detail: `${passedTests} passed · ${failedTests} failed` },
    { value: completedTests, detail: completedTests > 0 ? "Static + test runs completed" : "No checks executed yet" },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-surface/80 p-5 space-y-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </section>
        <section className="grid gap-6 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border-border/70 bg-surface/80 shadow-sm">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-48 w-full rounded-xl" />
              </CardContent>
            </Card>
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
          <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem]">Workspace overview</h1>
          <p className="text-sm text-muted-foreground">APIs, models, and recent runs at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          {failedTests > 0 && (
            <Badge variant="secondary" className="rounded-full bg-error/10 text-error">{failedTests} failed checks</Badge>
          )}
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="rounded-full border-border/70 bg-background/80">
            <RefreshCw className={`mr-2 icon-sm ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </section>

      {/* ── Stat cards ── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCardStyles.map((style, index) => (
          <div key={style.title} className="rounded-2xl border border-border/60 bg-surface/80 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className={`rounded-xl p-2 ${style.surface}`}>
                <style.icon className={`icon-sm ${style.tone}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{style.title}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{statValues[index].value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{statValues[index].detail}</p>
          </div>
        ))}
      </section>

      {/* ── Chart + Activity side-by-side ── */}
      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Performance overview</CardTitle>
          </CardHeader>
          <CardContent>
            <StatsChart />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </section>

      {/* ── Models + APIs side-by-side, scrollable ── */}
      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deployed models</CardTitle>
            <Link href="/dashboard/upload-model">
              <Button variant="ghost" size="sm" className="h-7 rounded-full px-3 text-xs">
                View all <ArrowRight className="ml-1 icon-xs" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {models.length === 0 ? (
              <div className="flex h-[14rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/70 text-sm text-muted-foreground">
                <div className="text-center">
                  <Cpu className="mx-auto mb-2 icon-md text-muted-foreground/60" />
                  No models deployed
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[14rem]">
                <div className="space-y-2 pr-3">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-info/10 p-1.5">
                          <Cpu className="icon-xs text-info" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{model.modelName}</p>
                          <p className="text-[11px] text-muted-foreground">{model.mode} · {model.tokens} tokens</p>
                        </div>
                      </div>
                      <Badge className={`rounded-full text-[10px] ${getModelStatusStyle(model.status)}`}>
                        {model.status === "Running" && <CheckCircle className="mr-1 icon-xs" />}
                        {model.status === "Pending" && <Clock className="mr-1 icon-xs" />}
                        {model.status === "Failed" && <XCircle className="mr-1 icon-xs" />}
                        {model.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent APIs</CardTitle>
            <Link href="/dashboard/upload-api">
              <Button variant="ghost" size="sm" className="h-7 rounded-full px-3 text-xs">
                View all <ArrowRight className="ml-1 icon-xs" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {apis.length === 0 ? (
              <div className="flex h-[14rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/70 text-sm text-muted-foreground">
                <div className="text-center">
                  <CheckCircle className="mx-auto mb-2 icon-md text-muted-foreground/60" />
                  No APIs uploaded
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[14rem]">
                <div className="space-y-2 pr-3">
                  {apis.map((api) => (
                    <div
                      key={api.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-1.5">
                          <CheckCircle className="icon-xs text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{api.name}</p>
                          <p className="text-[11px] text-muted-foreground">{api.totalTests} checks · {api.passedTests} passed</p>
                        </div>
                      </div>
                      <Badge className={`rounded-full text-[10px] ${getTestStatusStyle(api.status)}`}>
                        {api.status === "completed" && <CheckCircle className="mr-1 icon-xs" />}
                        {(api.status === "testing" || api.status === "uploaded") && <Clock className="mr-1 icon-xs" />}
                        {api.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
