"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Bot, LayoutDashboard, Upload, Cpu, Activity, Kanban, ChevronLeft, ChevronRight } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Upload API", href: "/dashboard/upload-api", icon: Upload },
  { name: "Upload Model", href: "/dashboard/upload-model", icon: Cpu },
  { name: "Monitoring", href: "/dashboard/monitoring", icon: Activity },
  { name: "Kanban", href: "/dashboard/kanban", icon: Kanban },
]

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <div
      className={cn(
        "flex flex-col bg-surface-secondary border-r transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="p-4 border-b bg-gradient-to-r from-surface to-surface-secondary">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-primary via-info to-primary rounded-lg flex items-center justify-center shadow-md ring-1 ring-primary/20">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border border-background animate-pulse"></div>
              </div>
              <div>
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
                  DeployZen
                </span>
                <div className="text-xs text-muted-foreground font-medium">Dashboard</div>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="relative mx-auto">
              <div className="w-9 h-9 bg-gradient-to-br from-primary via-info to-primary rounded-lg flex items-center justify-center shadow-md ring-1 ring-primary/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border border-background animate-pulse"></div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 hover:bg-surface-tertiary/50 transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start transition-all duration-200 group",
                  collapsed && "px-2",
                  isActive
                    ? "bg-gradient-to-r from-primary to-info text-white shadow-md hover:from-primary/90 hover:to-info/90"
                    : "hover:bg-surface-tertiary/70 hover:text-foreground text-muted-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    !collapsed && "mr-3",
                    isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {!collapsed && (
                  <span
                    className={cn(
                      "font-medium transition-colors",
                      isActive ? "text-white" : "group-hover:text-foreground",
                    )}
                  >
                    {item.name}
                  </span>
                )}
                {isActive && !collapsed && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full opacity-75"></div>}
              </Button>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
