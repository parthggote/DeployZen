import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LiveChart } from "@/components/live-chart"
import { Cpu, CheckCircle, Clock, AlertCircle } from "lucide-react"

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

export function ModelCard({ model }: ModelCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-success text-success-foreground"
      case "idle":
        return "bg-warning text-warning-foreground"
      default:
        return "bg-error text-error-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <CheckCircle className="w-3 h-3 mr-1" />
      case "idle":
        return <Clock className="w-3 h-3 mr-1" />
      default:
        return <AlertCircle className="w-3 h-3 mr-1" />
    }
  }

  // Generate sample data based on model status
  const generateData = () => {
    if (model.status === "running") {
      return Array.from({ length: 6 }, () => Math.floor(Math.random() * 20) + model.latency - 10)
    }
    return [0, 0, 0, 0, 0, 0]
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Cpu className="w-5 h-5 mr-2" />
            {model.name}
          </CardTitle>
          <Badge className={getStatusColor(model.status)}>
            {getStatusIcon(model.status)}
            {model.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Latency</div>
            <div className="font-medium">{model.latency}ms</div>
          </div>
          <div>
            <div className="text-muted-foreground">Tokens/sec</div>
            <div className="font-medium">{model.tokensPerSec}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Requests/sec</div>
            <div className="font-medium">{model.requestsPerSec}</div>
          </div>
          <div>
            <div className="text-muted-foreground">GPU</div>
            <div className="font-medium">{model.gpu}</div>
          </div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-2">Performance</div>
          <div className="h-16">
            <LiveChart
              data={generateData()}
              color={
                model.status === "running"
                  ? "hsl(var(--success))"
                  : model.status === "idle"
                    ? "hsl(var(--warning))"
                    : "hsl(var(--error))"
              }
              label="Latency"
            />
          </div>
        </div>

        <div className="text-xs text-muted-foreground">Memory: {model.memory}</div>
      </CardContent>
    </Card>
  )
}
