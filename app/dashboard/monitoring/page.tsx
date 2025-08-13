"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, Zap, Clock, TrendingUp, AlertCircle, CheckCircle, Server, RefreshCw } from "lucide-react"
import { LiveChart } from "@/components/live-chart"
import { ModelCard } from "@/components/model-card"

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
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadModels, 30000)
    return () => clearInterval(interval)
  }, [])

  // Calculate monitoring stats
  const runningModels = models.filter(m => m.status === "Running")
  const totalModels = models.length
  const avgLatency = runningModels.length > 0 ? 120 : 0 // Simulated for demo
  const totalTokensPerSec = runningModels.length * 45 // Simulated for demo
  const totalRequestsPerSec = runningModels.length * 8 // Simulated for demo

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time performance metrics and health monitoring for all deployments.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Real-time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Latency</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLatency}ms</div>
            <div className="h-20 mt-4">
              <LiveChart data={[120, 115, 108, 95, 102, avgLatency]} color="hsl(var(--warning))" label="Latency (ms)" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens/sec</CardTitle>
            <Zap className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTokensPerSec}</div>
            <div className="h-20 mt-4">
              <LiveChart data={[85, 92, 97, 103, 98, totalTokensPerSec]} color="hsl(var(--success))" label="Tokens/sec" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requests/sec</CardTitle>
            <TrendingUp className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequestsPerSec}</div>
            <div className="h-20 mt-4">
              <LiveChart data={[15, 18, 20, 22, 19, totalRequestsPerSec]} color="hsl(var(--info))" label="Requests/sec" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {models.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No models deployed</h3>
            <p className="text-muted-foreground">Deploy models to see monitoring data.</p>
          </div>
        ) : (
          models.map((model) => (
            <Card key={model.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{model.modelName}</h3>
                  <p className="text-sm text-muted-foreground">{model.mode}</p>
                </div>
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
                  {model.status}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Latency:</span>
                  <span>{model.status === "Running" ? "120ms" : "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tokens/sec:</span>
                  <span>{model.status === "Running" ? "45" : "0"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Requests/sec:</span>
                  <span>{model.status === "Running" ? "8" : "0"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Port:</span>
                  <span>{model.port || "N/A"}</span>
                </div>
                {model.lastActivity && (
                  <div className="flex justify-between text-sm">
                    <span>Last Activity:</span>
                    <span>{new Date(model.lastActivity).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* GPU Utilization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Server className="w-5 h-5 mr-2" />
            GPU Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {["GPU0", "GPU1", "GPU2"].map((gpu, index) => (
              <div key={gpu} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{gpu}</div>
                  <Badge variant="secondary">A100-80GB</Badge>
                </div>
                <div className="h-32">
                  <LiveChart
                    data={
                      [
                        index === 0
                          ? [65, 70, 68, 72, 69, 71]
                          : index === 1
                            ? [45, 48, 52, 49, 51, 47]
                            : [90, 88, 92, 89, 91, 90],
                      ][0]
                    }
                    color={
                      index === 0 ? "hsl(var(--success))" : index === 1 ? "hsl(var(--warning))" : "hsl(var(--error))"
                    }
                    label="GPU Usage %"
                    showGrid={true}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Current: {index === 0 ? "71%" : index === 1 ? "47%" : "90%"} utilization
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>API Gateway</span>
                </div>
                <Badge className="bg-success text-success-foreground">Healthy</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Load Balancer</span>
                </div>
                <Badge className="bg-success text-success-foreground">Healthy</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-warning" />
                  <span>Database</span>
                </div>
                <Badge className="bg-warning text-warning-foreground">Warning</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Storage</span>
                </div>
                <Badge className="bg-success text-success-foreground">Healthy</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                <div>
                  <div className="text-sm font-medium">High GPU temperature on GPU2</div>
                  <div className="text-xs text-muted-foreground">2 minutes ago</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Model deployment completed</div>
                  <div className="text-xs text-muted-foreground">15 minutes ago</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-4 h-4 text-error mt-0.5" />
                <div>
                  <div className="text-sm font-medium">API rate limit exceeded</div>
                  <div className="text-xs text-muted-foreground">1 hour ago</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
