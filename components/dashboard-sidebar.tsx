"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  ChevronLeft,
  Cpu,
  Kanban,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Upload,
  X,
  AlertTriangle,
} from "lucide-react"

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

interface SystemHealth {
  label: string
  tone: "success" | "warning" | "error"
}

/**
 * Fetches lightweight health status from API and model endpoints
 * @returns {Promise<SystemHealth>} Current system health summary
 */
async function fetchSystemHealth(): Promise<SystemHealth> {
  try {
    const [modelsRes, apisRes] = await Promise.all([
      fetch("/api/models").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/apis").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])

    const models = modelsRes?.models ?? []
    const apis = apisRes?.apis ?? []
    const failedModels = models.filter((m: { status: string }) => m.status === "Failed").length
    const failedTests = apis.reduce((sum: number, a: { failedTests?: number }) => sum + (a.failedTests ?? 0), 0)

    if (failedModels > 0 || failedTests > 0) {
      return { label: `${failedModels + failedTests} issues`, tone: "warning" }
    }
    return { label: "Clean", tone: "success" }
  } catch {
    return { label: "Unavailable", tone: "error" }
  }
}

/**
 * Sidebar navigation for the dashboard with collapse and mobile drawer support
 */
export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [health, setHealth] = useState<SystemHealth>({ label: "Loading", tone: "success" })
  const pathname = usePathname()

  useEffect(() => {
    fetchSystemHealth().then(setHealth)
    const interval = setInterval(() => {
      fetchSystemHealth().then(setHealth)
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setMobileOpen(false)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [mobileOpen, handleEscape])

  const healthColor =
    health.tone === "success"
      ? "text-success"
      : health.tone === "warning"
        ? "text-warning"
        : "text-error"

  const healthBg =
    health.tone === "success"
      ? "bg-success"
      : health.tone === "warning"
        ? "bg-warning"
        : "bg-error"

  const HealthIcon = health.tone === "success" ? ShieldCheck : AlertTriangle

  const sidebarContent = (
    <>
      <div className="relative border-b border-border/70 px-4 py-5">
        <div className={cn("flex min-h-12 items-center", collapsed ? "justify-center" : "pr-8")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="relative shrink-0 rounded-[1.35rem] border border-border/70 bg-background p-1.5 shadow-sm">
              <img
                src="/Gemini_Generated_Image_l0hl0hl0hl0hl0hl.png"
                alt="DeployZen"
                className="h-9 w-9 rounded-2xl"
              />
              <span className={cn("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background", healthBg)} />
            </div>
            {!collapsed ? <span className="text-base font-medium tracking-tight text-foreground">DeployZen</span> : null}
          </div>
        </div>

        {mobileOpen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full lg:hidden"
          >
            <X className="icon-sm" />
          </Button>
        )}
      </div>

      <div className={cn("flex-1 py-5", collapsed ? "px-2" : "px-4")}>
        <nav className="space-y-1.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <div
                      className={cn(
                        "group relative flex items-center rounded-2xl border transition-all",
                        collapsed ? "justify-center px-1.5 py-2.5" : "gap-3 px-3 py-3",
                        isActive
                          ? "border-primary/20 bg-primary/10 shadow-sm"
                          : "border-transparent bg-transparent hover:border-border/60 hover:bg-background/80",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
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
                      {isActive && (
                        <span className={cn(
                          "absolute rounded-full bg-primary",
                          collapsed
                            ? "bottom-1 left-1/2 h-1 w-4 -translate-x-1/2"
                            : "right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2"
                        )} />
                      )}
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.hint}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>
      </div>

      <div className={cn("border-t border-border/70 py-4", collapsed ? "px-2" : "px-4")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center">
                <HealthIcon className={cn("icon-md", healthColor)} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">System: {health.label}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2">
            <HealthIcon className={cn("icon-sm", healthColor)} />
            <span className="text-xs text-muted-foreground">System status</span>
            <span className={cn("text-xs font-medium", healthColor)}>{health.label}</span>
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger trigger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 h-10 w-10 rounded-full border border-border/70 bg-background/90 shadow-md lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="icon-md" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-border/70 bg-surface/95 backdrop-blur-xl transition-transform duration-300 flex flex-col lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "group/sidebar relative hidden border-r border-border/70 bg-surface/80 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col",
          collapsed ? "lg:w-[68px]" : "lg:w-72",
        )}
      >
        {sidebarContent}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="absolute -right-3 top-20 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-md transition-all duration-200 hover:bg-surface-secondary hover:text-foreground hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex opacity-0 group-hover/sidebar:opacity-100"
            >
              <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform duration-300", collapsed && "rotate-180")} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {collapsed ? "Expand" : "Collapse"}
          </TooltipContent>
        </Tooltip>
      </aside>
    </>
  )
}
