"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LiveChart } from "@/components/live-chart"
import { Cpu, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModelCardProps {
  model: {
    name: string
    status: string
    latency: number
    tokensPerSec: number
    requestsPerSec: number
    gpu: string
    memory: string
  }
}

/**
 * Returns badge color class for a model runtime status
 * @param {string} status - Model runtime status
 * @returns {string} Tailwind class string
 */
function getStatusColor(status: string) {
  switch (status) {
    case "running":
      return "bg-success text-success-foreground"
    case "idle":
      return "bg-warning text-warning-foreground"
    default:
      return "bg-error text-error-foreground"
  }
}

/**
 * Returns the status icon for a model runtime status
 * @param {string} status - Model runtime status
 * @returns {React.ReactNode} Status icon element
 */
function getStatusIcon(status: string) {
  switch (status) {
    case "running":
      return <CheckCircle className="w-3 h-3 mr-1" />
    case "idle":
      return <Clock className="w-3 h-3 mr-1" />
    default:
      return <AlertCircle className="w-3 h-3 mr-1" />
  }
}

/**
 * Displays a model deployment card with live performance chart
 * @param {ModelCardProps} props - Component props
 */
export function ModelCard({ model }: ModelCardProps) {
  const chartData = useMemo(() => {
    if (model.status === "running") {
      const seed = model.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
      return Array.from({ length: 6 }, (_, i) => {
        const pseudo = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280
        return Math.floor(pseudo * 20) + model.latency - 10
      })
    }
    return [0, 0, 0, 0, 0, 0]
  }, [model.status, model.latency, model.name])

  const chartColor = model.status === "running"
    ? "hsl(var(--success))"
    : model.status === "idle"
      ? "hsl(var(--warning))"
      : "hsl(var(--error))"

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center font-display">
            <Cpu className="w-5 h-5 mr-2" />
            {model.name}
          </CardTitle>
          <Badge className={cn("rounded-full", getStatusColor(model.status))}>
            {getStatusIcon(model.status)}
            {model.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border/50 bg-surface-secondary/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Latency</div>
            <div className="font-semibold font-mono text-sm mt-0.5">{model.latency}ms</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-surface-secondary/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Tokens/sec</div>
            <div className="font-semibold font-mono text-sm mt-0.5">{model.tokensPerSec}</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-surface-secondary/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Requests/sec</div>
            <div className="font-semibold font-mono text-sm mt-0.5">{model.requestsPerSec}</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-surface-secondary/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">GPU</div>
            <div className="font-semibold text-sm mt-0.5">{model.gpu}</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-2 font-display font-medium">Performance</div>
          <div className="h-16">
            <LiveChart data={chartData} color={chartColor} label="Latency" />
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-mono">Memory: {model.memory}</div>
      </CardContent>
    </Card>
  )
}
