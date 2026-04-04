"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  ArrowUpRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Kanban,
  LayoutDashboard,
  ShieldCheck,
  Upload,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard, hint: "Workspace summary" },
  { name: "Upload API", href: "/dashboard/upload-api", icon: Upload, hint: "Generate and review tests" },
  { name: "Upload Model", href: "/dashboard/upload-model", icon: Cpu, hint: "Deploy model assets" },
  { name: "Monitoring", href: "/dashboard/monitoring", icon: Activity, hint: "Health and telemetry" },
  { name: "Kanban", href: "/dashboard/kanban", icon: Kanban, hint: "Lifecycle board" },
]

const quickInsights = [
  { label: "Validation", value: "Stable", tone: "text-success" },
  { label: "Ops posture", value: "Focused", tone: "text-info" },
]

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "hidden border-r border-border/70 bg-surface/75 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col",
        collapsed ? "lg:w-24" : "lg:w-80",
      )}
    >
      <div className="border-b border-border/70 px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="relative shrink-0 rounded-3xl border border-border/70 bg-background p-1 shadow-sm">
              <img
                src="/Gemini_Generated_Image_l0hl0hl0hl0hl0hl.png"
                alt="DeployZen"
                className="h-11 w-11 rounded-2xl"
              />
              <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-success" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight">DeployZen</p>
                <p className="text-xs leading-5 text-muted-foreground">Testing, deployment, and review operations</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((value) => !value)}
            className="h-9 w-9 rounded-full border border-border/70 bg-background/80 shadow-sm hover:bg-surface-secondary"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {!collapsed && (
          <div className="mt-5 rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary/10 p-2.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Operator workspace</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Keep uploads, validation, and deployment states aligned from one calm control surface.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {quickInsights.map((insight) => (
                <div
                  key={insight.label}
                  className="flex items-center justify-between rounded-2xl border border-border/50 bg-surface px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{insight.label}</span>
                  <span className={cn("font-medium", insight.tone)}>{insight.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "group flex items-center rounded-3xl border px-3 py-3 transition-all",
                    collapsed ? "justify-center" : "gap-3",
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
                    <item.icon className="h-4 w-4" />
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", isActive ? "text-foreground" : "text-foreground/90")}>
                        {item.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
                    </div>
                  )}
                  {!collapsed && isActive && <ArrowUpRight className="h-4 w-4 text-primary" />}
                </div>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="border-t border-border/70 px-4 py-5">
        <div className={cn("rounded-3xl border border-border/60 bg-background/80 p-4", collapsed && "p-3")}>
          {collapsed ? (
            <div className="flex justify-center">
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-success/10 p-2.5">
                <ShieldCheck className="h-4 w-4 text-success" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Health-first posture</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Recent shell updates favor clearer status, cleaner hierarchy, and more trustworthy system feedback.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
