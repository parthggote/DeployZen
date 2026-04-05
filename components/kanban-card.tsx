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
    <Card className="border-border/70 bg-background/90 shadow-sm transition-shadow hover:shadow-md overflow-hidden">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-xl bg-surface-secondary p-1.5 shrink-0">
              {item.type === "api" ? (
                <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider shrink-0">
              {item.type}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => onEdit?.(item)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(item)} className="text-error">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1 min-w-0">
          <h4 className="text-xs font-semibold leading-snug truncate">{item.title}</h4>
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {item.description || "No description added yet."}
          </p>
        </div>

        {item.type === "model" && modelDetails ? (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-border/50 bg-surface-secondary/60 px-2.5 py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Latency</p>
              <p className="mt-0.5 text-xs font-medium truncate">
                {modelDetails.latency !== null ? `${modelDetails.latency} ms` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-secondary/60 px-2.5 py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Throughput</p>
              <p className="mt-0.5 text-xs font-medium truncate">
                {modelDetails.tokensPerSec !== null ? `${modelDetails.tokensPerSec} tok/s` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-secondary/60 px-2.5 py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Requests</p>
              <p className="mt-0.5 text-xs font-medium truncate">
                {modelDetails.requestsPerSec !== null ? `${modelDetails.requestsPerSec}/s` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface-secondary/60 px-2.5 py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Runtime</p>
              <p className="mt-0.5 text-xs font-medium truncate">{modelDetails.gpu || modelDetails.memory || "—"}</p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0 truncate">
            {statusIcon}
            <span className="capitalize truncate">{item.status}</span>
          </div>

          {item.type === "model" && modelDetails ? (
            <Badge className={`rounded-full text-[10px] px-2 py-0 shrink-0 ${getModelStatusTone(modelDetails.status)}`}>
              {getModelStatusIcon(modelDetails.status)}
              {modelDetails.status}
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground shrink-0">{item.lastUpdated}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
