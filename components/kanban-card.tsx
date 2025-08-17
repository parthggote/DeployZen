import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileCode, Cpu, MoreHorizontal, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LiveChart } from "@/components/live-chart"

interface KanbanCardProps {
  item: {
    id: string
    title: string
    type: "api" | "model"
    status: string
    lastUpdated: string
    description: string
    modelDetails?: {
      name: string
      status: string
      latency: number
      tokensPerSec: number
      requestsPerSec: number
      gpu: string
      memory: string
    }
  }
  statusIcon: React.ReactNode
  onEdit?: (item: any) => void
  onDelete?: (item: any) => void
}

export function KanbanCard({ item, statusIcon, onEdit, onDelete }: KanbanCardProps) {
  const { modelDetails } = item

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

  const generateData = () => {
    if (modelDetails && modelDetails.status === "running") {
      return Array.from({ length: 6 }, () => Math.floor(Math.random() * 20) + modelDetails.latency - 10)
    }
    return [0, 0, 0, 0, 0, 0]
  }

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow bg-surface">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            {item.type === "api" ? (
              <FileCode className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Cpu className="w-4 h-4 text-muted-foreground" />
            )}
            <Badge variant="outline" className="text-xs">
              {item.type.toUpperCase()}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit && onEdit(item)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete && onDelete(item)} className="text-error">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <h4 className="font-medium text-sm leading-tight">{item.title}</h4>
          {item.type === "model" && modelDetails ? (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Latency</div>
                  <div className="font-medium">{modelDetails.latency}ms</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Tokens/sec</div>
                  <div className="font-medium">{modelDetails.tokensPerSec}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Requests/sec</div>
                  <div className="font-medium">{modelDetails.requestsPerSec}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">GPU</div>
                  <div className="font-medium">{modelDetails.gpu}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Performance</div>
                <div className="h-16">
                  <LiveChart
                    data={generateData()}
                    color={
                      modelDetails.status === "running"
                        ? "hsl(var(--success))"
                        : modelDetails.status === "idle"
                          ? "hsl(var(--warning))"
                          : "hsl(var(--error))"
                    }
                    label="Latency"
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Memory: {modelDetails.memory}</div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {statusIcon}
            <span className="text-xs text-muted-foreground capitalize">{item.status}</span>
          </div>
          {item.type === 'model' && modelDetails ? (
             <Badge className={getStatusColor(modelDetails.status)}>
                {getStatusIcon(modelDetails.status)}
                {modelDetails.status}
              </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{item.lastUpdated}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
