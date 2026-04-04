"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle,
  CheckCircle2,
  Clock,
  Cpu,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react"

import { RecentActivity } from "@/components/recent-activity"
import { StatsChart } from "@/components/stats-chart"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

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
  testCases: any[]
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
      console.error("Error loading dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

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
  const runningModels = models.filter((model) => model.status === "Running").length
  const completedTests = apis.reduce((sum, api) => sum + api.totalTests, 0)
  const passedTests = apis.reduce((sum, api) => sum + api.passedTests, 0)
  const failedTests = apis.reduce((sum, api) => sum + api.failedTests, 0)
  const successRate = completedTests > 0 ? (passedTests / completedTests) * 100 : 0

  const statValues = [
    { value: totalApis, detail: totalApis > 0 ? `${completedTests} checks recorded` : "No APIs uploaded yet" },
    { value: totalModels, detail: runningModels > 0 ? `${runningModels} live right now` : "No active model runtimes" },
    { value: `${successRate.toFixed(1)}%`, detail: `${passedTests} passed and ${failedTests} failed` },
    { value: completedTests, detail: completedTests > 0 ? "Static validation and test runs completed" : "No checks executed yet" },
  ]

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">
                    Overview
                  </Badge>
                  <Badge variant="secondary" className="rounded-full border border-border/60 bg-background px-3 py-1">
                    {totalApis} APIs
                  </Badge>
                  <Badge variant="secondary" className="rounded-full border border-border/60 bg-background px-3 py-1">
                    {totalModels} models
                  </Badge>
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[2rem]">Workspace overview</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">APIs, models, and recent runs.</p>
                </div>
              </div>
              <Button onClick={handleRefresh} disabled={refreshing} className="rounded-full px-5">
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing" : "Refresh workspace"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-gradient-to-br from-background to-surface-secondary shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-success/10 p-3">
                <ShieldCheck className="icon-md text-success" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Workspace health</p>
                <h2 className="text-xl font-medium tracking-tight">
                  {loading ? "Loading current posture" : failedTests > 0 ? "Review failures before rollout" : "Operational posture looks steady"}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {loading
                    ? "Fetching workspace state."
                    : failedTests > 0
                      ? `${failedTests} checks still need attention.`
                      : "No critical issues surfaced."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statCardStyles.map((style, index) => (
          <Card key={style.title} className="border-border/70 bg-surface/75 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className={`rounded-2xl p-3 ${style.surface}`}>
                  <style.icon className={`icon-md ${style.tone}`} />
                </div>
                <Badge variant="secondary" className="rounded-full border border-border/60 bg-background px-3 py-1">
                  Live
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{style.title}</p>
              <p className="mt-2 text-3xl font-medium tracking-tight">{statValues[index].value}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{statValues[index].detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Performance overview</CardTitle>
          </CardHeader>
          <CardContent>
            <StatsChart />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70 bg-surface/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Workspace details</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["models", "apis"]} className="w-full">
            <AccordionItem value="models" className="border-border/60">
              <AccordionTrigger className="py-5 text-left hover:no-underline">
                <div>
                  <p className="text-base font-semibold">Deployed models</p>
                  <p className="text-sm font-normal text-muted-foreground">{models.length} tracked</p>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {models.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 py-12 text-center">
                    <Cpu className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="text-lg font-medium">No models deployed</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Deploy a model to begin tracking runtime state from this workspace.</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[26rem] pr-4">
                    <div className="space-y-4">
                      {models.map((model) => (
                        <div
                          key={model.id}
                          className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/80 p-5 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="flex items-start gap-4">
                            <div className="rounded-2xl bg-info/10 p-3">
                              <Cpu className="h-5 w-5 text-info" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold">{model.modelName}</p>
                              <p className="text-sm text-muted-foreground">
                                {model.mode} / {model.tokens} tokens / Created {new Date(model.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              className={
                                model.status === "Running"
                                  ? "rounded-full bg-success/10 text-success hover:bg-success/10"
                                  : model.status === "Pending"
                                    ? "rounded-full bg-warning/10 text-warning hover:bg-warning/10"
                                    : "rounded-full bg-error/10 text-error hover:bg-error/10"
                              }
                            >
                              {model.status === "Running" && <CheckCircle className="mr-1 h-3 w-3" />}
                              {model.status === "Pending" && <Clock className="mr-1 h-3 w-3" />}
                              {model.status === "Failed" && <XCircle className="mr-1 h-3 w-3" />}
                              {model.status}
                            </Badge>
                            {model.port ? (
                              <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">
                                Port {model.port}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="apis" className="border-border/60">
              <AccordionTrigger className="py-5 text-left hover:no-underline">
                <div>
                  <p className="text-base font-semibold">Recent APIs</p>
                  <p className="text-sm font-normal text-muted-foreground">{apis.length} tracked</p>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {apis.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 py-12 text-center">
                    <CheckCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="text-lg font-medium">No APIs uploaded</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Upload an API to start generating structured test coverage.</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[26rem] pr-4">
                    <div className="space-y-4">
                      {apis.map((api) => (
                        <div
                          key={api.id}
                          className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/80 p-5 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="flex items-start gap-4">
                            <div className="rounded-2xl bg-primary/10 p-3">
                              <CheckCircle className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-semibold">{api.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {api.totalTests} checks / {api.passedTests} passed / {api.failedTests} failed
                              </p>
                            </div>
                          </div>
                          <Badge
                            className={
                              api.status === "completed"
                                ? "rounded-full bg-success/10 text-success hover:bg-success/10"
                                : api.status === "testing"
                                  ? "rounded-full bg-warning/10 text-warning hover:bg-warning/10"
                                  : "rounded-full bg-muted text-muted-foreground hover:bg-muted"
                            }
                          >
                            {api.status === "completed" && <CheckCircle className="mr-1 h-3 w-3" />}
                            {(api.status === "testing" || api.status === "uploaded") && <Clock className="mr-1 h-3 w-3" />}
                            {api.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
