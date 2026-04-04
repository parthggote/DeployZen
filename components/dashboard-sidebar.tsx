"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, ArrowUpRight, ChevronLeft, ChevronRight, Cpu, Kanban, LayoutDashboard, ShieldCheck, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Workspace Home", href: "/dashboard", icon: LayoutDashboard, hint: "Summary, recent runs, and tracked assets" },
  { name: "API Test Lab", href: "/dashboard/upload-api", icon: Upload, hint: "Upload specs, generate tests, and review results" },
  { name: "Model Deployments", href: "/dashboard/upload-model", icon: Cpu, hint: "Deploy runtimes and manage model artifacts" },
  { name: "Runtime Monitor", href: "/dashboard/monitoring", icon: Activity, hint: "Check runtime health and available telemetry" },
  { name: "Release Board", href: "/dashboard/kanban", icon: Kanban, hint: "Move API and model work across workflow stages" },
]

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "hidden border-r border-border/70 bg-surface/75 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col",
        collapsed ? "lg:w-24" : "lg:w-72",
      )}
    >
      <div className="relative border-b border-border/70 px-4 py-5">
        <div className={cn("flex min-h-12 items-center", collapsed ? "justify-center" : "pr-8")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="relative shrink-0 rounded-[1.35rem] border border-border/70 bg-background p-1.5 shadow-sm">
              <img
                src="/Gemini_Generated_Image_l0hl0hl0hl0hl0hl.png"
                alt="DeployZen"
                className={cn("rounded-2xl", collapsed ? "h-8 w-8" : "h-9 w-9")}
              />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-success" />
            </div>
            {!collapsed ? <span className="text-base font-medium tracking-tight text-foreground">DeployZen</span> : null}
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((value) => !value)}
              className={cn(
                "absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/70 bg-background/90 shadow-sm hover:bg-surface-secondary",
                collapsed ? "right-1/2 h-8 w-8 translate-x-1/2" : "right-0 h-9 w-9 translate-x-1/2",
              )}
            >
              {collapsed ? <ChevronRight className="icon-xs" /> : <ChevronLeft className="icon-xs" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 px-4 py-5">
        {!collapsed && (
          <p className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Navigation
          </p>
        )}
        <nav className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <div
                      className={cn(
                        "group flex items-center rounded-3xl border transition-all",
                        collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3",
                        isActive
                          ? "border-primary/20 bg-primary/10 shadow-sm"
                          : "border-transparent bg-transparent hover:border-border/60 hover:bg-background/80",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors",
                          isActive ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <item.icon className="icon-sm" />
                      </div>
                      {!collapsed && (
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm font-medium", isActive ? "text-foreground" : "text-foreground/90")}>
                            {item.name}
                          </p>
                        </div>
                      )}
                      {!collapsed && isActive && <ArrowUpRight className="icon-sm text-primary" />}
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.hint}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>
      </div>

      <div className="border-t border-border/70 px-4 py-5">
        {collapsed ? (
          <div className="flex justify-center">
            <ShieldCheck className="icon-md text-success" />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2">
            <ShieldCheck className="icon-sm text-success" />
            <span className="text-xs text-muted-foreground">System status</span>
            <span className="text-xs font-medium text-success">Clean</span>
          </div>
        )}
      </div>
    </aside>
  )
}
