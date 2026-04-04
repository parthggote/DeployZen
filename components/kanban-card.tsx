import type React from "react"
import { AlertCircle, CheckCircle, Clock, Cpu, FileCode, MoreHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

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
      latency: number | null
      tokensPerSec: number | null
      requestsPerSec: number | null
      gpu: string
      memory: string
    }
  }
  statusIcon: React.ReactNode
  onEdit?: (item: KanbanCardProps["item"]) => void
  onDelete?: (item: KanbanCardProps["item"]) => void
}

export function KanbanCard({ item, statusIcon, onEdit, onDelete }: KanbanCardProps) {
  const { modelDetails } = item

  function getModelStatusTone(status: string) {
    switch (status) {
      case "running":
        return "bg-success/10 text-success hover:bg-success/10"
      case "idle":
        return "bg-warning/10 text-warning hover:bg-warning/10"
      default:
        return "bg-error/10 text-error hover:bg-error/10"
    }
  }

  function getModelStatusIcon(status: string) {
    switch (status) {
      case "running":
        return <CheckCircle className="mr-1 icon-xs" />
      case "idle":
        return <Clock className="mr-1 icon-xs" />
      default:
        return <AlertCircle className="mr-1 icon-xs" />
    }
  }

  return (
    <Card className="border-border/70 bg-background/90 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-surface-secondary p-2">
              {item.type === "api" ? (
                <FileCode className="icon-sm text-muted-foreground" />
              ) : (
                <Cpu className="icon-sm text-muted-foreground" />
              )}
            </div>
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1 text-[11px] uppercase tracking-[0.12em]">
              {item.type}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <MoreHorizontal className="icon-sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onClick={() => onEdit?.(item)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(item)} className="text-error">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold leading-6">{item.title}</h4>
          <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
            {item.description || "No description added yet."}
          </p>
        </div>

        {item.type === "model" && modelDetails ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Latency</p>
              <p className="mt-1 text-sm font-medium">
                {modelDetails.latency !== null ? `${modelDetails.latency} ms` : "No telemetry yet"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Throughput</p>
              <p className="mt-1 text-sm font-medium">
                {modelDetails.tokensPerSec !== null ? `${modelDetails.tokensPerSec} tok/s` : "No telemetry yet"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Requests</p>
              <p className="mt-1 text-sm font-medium">
                {modelDetails.requestsPerSec !== null ? `${modelDetails.requestsPerSec}/s` : "No telemetry yet"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Runtime</p>
              <p className="mt-1 text-sm font-medium">{modelDetails.gpu || modelDetails.memory || "Not reported"}</p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {statusIcon}
            <span className="capitalize">{item.status}</span>
          </div>

          {item.type === "model" && modelDetails ? (
            <Badge className={`rounded-full ${getModelStatusTone(modelDetails.status)}`}>
              {getModelStatusIcon(modelDetails.status)}
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
