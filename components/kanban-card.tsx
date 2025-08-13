import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileCode, Cpu, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface KanbanCardProps {
  item: {
    id: string
    title: string
    type: "api" | "model"
    status: string
    lastUpdated: string
    description: string
  }
  statusIcon: React.ReactNode
  onEdit?: (item: any) => void
  onDelete?: (item: any) => void
}

export function KanbanCard({ item, statusIcon, onEdit, onDelete }: KanbanCardProps) {
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
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {statusIcon}
            <span className="text-xs text-muted-foreground capitalize">{item.status}</span>
          </div>
          <span className="text-xs text-muted-foreground">{item.lastUpdated}</span>
        </div>
      </CardContent>
    </Card>
  )
}
