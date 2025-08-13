"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Cpu, Zap, Clock, TrendingUp, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { StatsChart } from "@/components/stats-chart"
import { RecentActivity } from "@/components/recent-activity"

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

export default function DashboardPage() {
  const [models, setModels] = useState<ModelData[]>([])
  const [apis, setApis] = useState<ApiData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async () => {
    try {
      const [modelsResponse, apisResponse] = await Promise.all([
        fetch("/api/models"),
        fetch("/api/apis")
      ])

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

  // Calculate dashboard stats
  const totalApis = apis.length
  const totalModels = models.length
  const runningModels = models.filter(m => m.status === "Running").length
  const completedTests = apis.reduce((sum, api) => sum + api.totalTests, 0)
  const passedTests = apis.reduce((sum, api) => sum + api.passedTests, 0)
  const failedTests = apis.reduce((sum, api) => sum + api.failedTests, 0)
  const successRate = completedTests > 0 ? (passedTests / completedTests) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening with your APIs and models.</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">APIs Uploaded</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalApis}</div>
            <p className="text-xs text-muted-foreground">
              {totalApis > 0 ? `${completedTests} tests completed` : 'No APIs uploaded yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Models Deployed</CardTitle>
            <Cpu className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalModels}</div>
            <p className="text-xs text-muted-foreground">
              {runningModels > 0 ? `${runningModels} running` : 'No models deployed yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {passedTests} passed, {failedTests} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <Zap className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTests}</div>
            <p className="text-xs text-muted-foreground">
              {completedTests > 0 ? 'Tests executed' : 'No tests run yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <StatsChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </div>

      {/* Active Models */}
      <Card>
        <CardHeader>
          <CardTitle>Deployed Models</CardTitle>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <div className="text-center py-8">
              <Cpu className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No models deployed</h3>
              <p className="text-muted-foreground mb-4">Deploy your first model to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-surface-secondary rounded-lg flex items-center justify-center">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{model.modelName}</div>
                      <div className="text-sm text-muted-foreground">
                        {model.mode} • {model.tokens} tokens • Created {new Date(model.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        model.status === "Running" ? "default" : model.status === "Pending" ? "secondary" : "destructive"
                      }
                      className={
                        model.status === "Running"
                          ? "bg-success text-success-foreground"
                          : model.status === "Pending"
                            ? "bg-warning text-warning-foreground"
                            : "bg-error text-error-foreground"
                      }
                    >
                      {model.status === "Running" && <CheckCircle className="w-3 h-3 mr-1" />}
                      {model.status === "Pending" && <Clock className="w-3 h-3 mr-1" />}
                      {model.status === "Failed" && <XCircle className="w-3 h-3 mr-1" />}
                      {model.status}
                    </Badge>
                    {model.port && <Badge variant="outline">Port {model.port}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent APIs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent APIs</CardTitle>
        </CardHeader>
        <CardContent>
          {apis.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No APIs uploaded</h3>
              <p className="text-muted-foreground mb-4">Upload your first API to generate test cases.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apis.slice(0, 5).map((api) => (
                <div key={api.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-surface-secondary rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{api.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {api.totalTests} tests • {api.passedTests} passed • {api.failedTests} failed
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        api.status === "completed" ? "default" : api.status === "testing" ? "secondary" : "outline"
                      }
                      className={
                        api.status === "completed"
                          ? "bg-success text-success-foreground"
                          : api.status === "testing"
                            ? "bg-warning text-warning-foreground"
                            : "bg-muted text-muted-foreground"
                      }
                    >
                      {api.status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
                      {api.status === "testing" && <Clock className="w-3 h-3 mr-1" />}
                      {api.status === "uploaded" && <Clock className="w-3 h-3 mr-1" />}
                      {api.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
