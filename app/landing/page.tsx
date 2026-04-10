"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Cpu,
  CreditCard,
  FileText,
  LayoutGrid,
  LifeBuoy,
  Shield,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react"

import HeroSection from "@/components/HeroSection"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const productPillars = [
  {
    title: "API quality automation",
    description: "Upload API definitions or source files, generate structured test suites, and review failures in one focused workspace.",
    icon: Zap,
    tone: "text-primary",
    surface: "bg-primary/10",
  },
  {
    title: "Model deployment control",
    description: "Track model rollouts, inspect status, and manage runtime lifecycle without jumping between disconnected tools.",
    icon: Cpu,
    tone: "text-info",
    surface: "bg-info/10",
  },
  {
    title: "Operational visibility",
    description: "Keep teams aligned with recent activity, health signals, and lifecycle stages that are clear enough to trust.",
    icon: BarChart3,
    tone: "text-success",
    surface: "bg-success/10",
  },
]

const featureGrid = [
  {
    title: "Structured test generation",
    description: "Generate readable cases with methods, paths, expected responses, and route-aware suggestions instead of opaque blobs of code.",
    icon: FileText,
  },
  {
    title: "Deployment lifecycle tracking",
    description: "Move APIs and models through test, rollout, and recovery workflows with a board your team can understand at a glance.",
    icon: Workflow,
  },
  {
    title: "Security-oriented review",
    description: "Surface risky patterns and contract mismatches early so failures are easier to diagnose before they reach production.",
    icon: Shield,
  },
  {
    title: "One calm control surface",
    description: "Bring uploads, validation, monitoring, and recent activity into a consistent product shell designed for daily use.",
    icon: LayoutGrid,
  },
]

const proofPoints = [
  "Centralized dashboard for APIs and models",
  "Structured test cases with clearer execution results",
  "Kanban and monitoring views that favor honest system state",
]

const navItems = [
  { label: "Features", href: "#features", icon: LayoutGrid },
  { label: "Platform", href: "#platform", icon: CreditCard },
  { label: "Docs", href: "#docs", icon: FileText },
  { label: "Support", href: "#support", icon: LifeBuoy },
]

function LogoIcon({ size = "w-10 h-10", className = "" }: { size?: string; className?: string }) {
  return (
    <img
      src="/Gemini_Generated_Image_l0hl0hl0hl0hl0hl.png"
      alt="DeployZen"
      className={`${size} rounded-2xl ${className}`}
    />
  )
}

export default function LandingPage() {
  const { resolvedTheme } = useTheme()
  const [navbarHeight, setNavbarHeight] = useState(0)
  const navbarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!navbarRef.current) return
    setNavbarHeight(navbarRef.current.offsetHeight)
  }, [])

  const isDark = resolvedTheme === "dark"

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-secondary to-background text-foreground">
      <header
        ref={navbarRef}
        className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="rounded-3xl border border-border/70 bg-surface p-1 shadow-sm">
                <LogoIcon />
              </div>
              <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-success" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">DeployZen</p>
              <p className="text-xs text-muted-foreground">Testing and deployment operations for modern AI teams</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-full border border-border/70 bg-surface/80 p-1 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-secondary hover:text-foreground"
                onClick={(event) => {
                  event.preventDefault()
                  document.getElementById(item.href.replace("#", ""))?.scrollIntoView({ behavior: "smooth" })
                }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" className="hidden sm:inline-flex rounded-full" asChild>
              <Link href="/signin">Sign In</Link>
            </Button>
            <Button className="rounded-full px-5 shadow-sm" asChild>
              <Link href="/signup">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <HeroSection navbarHeight={navbarHeight} />

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-border/70 bg-surface/80 shadow-sm">
            <CardContent className="p-8 md:p-10">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="rounded-full border border-border/70 bg-background px-3 py-1">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Cleaner workflows
                </Badge>
                <Badge variant="secondary" className="rounded-full border border-border/70 bg-background px-3 py-1">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success" />
                  Contract-aware testing
                </Badge>
              </div>
              <div className="space-y-4">
                <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
                  Built to make testing and deployment work feel organized, visible, and trustworthy.
                </h2>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  DeployZen brings API validation, model operations, lifecycle tracking, and monitoring into a single
                  interface with calmer hierarchy and clearer state communication.
                </p>
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {productPillars.map((pillar) => (
                  <div key={pillar.title} className="rounded-3xl border border-border/60 bg-background/70 p-5">
                    <div className={`mb-4 inline-flex rounded-2xl p-3 ${pillar.surface}`}>
                      <pillar.icon className={`h-5 w-5 ${pillar.tone}`} />
                    </div>
                    <h3 className="mb-2 text-base font-semibold">{pillar.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-gradient-to-br from-primary to-info text-primary-foreground shadow-lg">
            <CardContent className="flex h-full flex-col justify-between p-8">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary-foreground/75">Why teams switch</p>
                <h3 className="mt-4 text-3xl font-semibold tracking-tight">Less noise. Better signals.</h3>
                <p className="mt-4 text-sm leading-7 text-primary-foreground/85">
                  Replace stitched-together tooling with a workspace that keeps uploads, tests, deploys, and operational
                  state aligned.
                </p>
              </div>
              <div className="mt-8 space-y-4">
                {proofPoints.map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                    <p className="text-sm leading-6 text-primary-foreground">{point}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">
              Product capabilities
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">A more polished foundation for daily operations</h2>
            <p className="max-w-2xl text-muted-foreground">
              The product surfaces are organized around clarity: better grouping, better status presentation, and less
              visual clutter competing with the work itself.
            </p>
          </div>
          <Button variant="outline" className="rounded-full border-border/70 bg-surface/80" asChild>
            <Link href="/dashboard">Explore the dashboard</Link>
          </Button>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featureGrid.map((feature) => (
            <Card key={feature.title} className="border-border/70 bg-surface/70 shadow-sm transition-transform duration-200 hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="mb-5 inline-flex rounded-2xl border border-border/60 bg-background/80 p-3">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-border/70 bg-surface/80 shadow-sm">
            <CardContent className="p-8">
              <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">
                Platform snapshot
              </Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight">Designed for teams that need clean signal, not dashboard noise.</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                The refresh focuses on stronger spacing, calmer contrast, more consistent shell components, and a more
                professional content rhythm across landing and dashboard views.
              </p>
              <div className="mt-8 grid gap-4">
                <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Cleaner shell</p>
                  <p className="mt-2 text-sm leading-6">A clearer header, better surface hierarchy, and less visual competition between navigation and content.</p>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">More honest states</p>
                  <p className="mt-2 text-sm leading-6">Telemetry and execution views are moving toward truthful product language so teams can trust what they see.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-border/70 shadow-sm ${isDark ? "bg-slate-950/70" : "bg-slate-50"}`}>
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Workspace preview</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight">Focused operating posture</h3>
                </div>
                <Bot className="h-10 w-10 text-primary" />
              </div>

              <div className="mt-8 space-y-4">
                <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">Validation queue</p>
                    <Badge className="rounded-full bg-success/10 text-success hover:bg-success/10">Healthy</Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
                      <span className="text-sm">Payments API contract checks</span>
                      <span className="text-sm font-medium text-success">12 passed</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
                      <span className="text-sm">RAG model deployment review</span>
                      <span className="text-sm font-medium text-info">Monitoring</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
                      <span className="text-sm">Auth service security sweep</span>
                      <span className="text-sm font-medium text-warning">Needs review</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Assets</p>
                    <p className="mt-2 text-2xl font-semibold">18</p>
                    <p className="text-sm text-muted-foreground">APIs and models</p>
                  </div>
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Coverage</p>
                    <p className="mt-2 text-2xl font-semibold">92%</p>
                    <p className="text-sm text-muted-foreground">Structured test coverage</p>
                  </div>
                  <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Alerts</p>
                    <p className="mt-2 text-2xl font-semibold">3</p>
                    <p className="text-sm text-muted-foreground">Need operator review</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="docs" className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <Card className="overflow-hidden border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
            <div>
              <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">
                Documentation and onboarding
              </Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight">Make the first session feel calm, not confusing.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                Better documentation entry points, cleaner feature grouping, and more understandable test output reduce the
                time it takes for someone new to become productive in the workspace.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="rounded-full px-5" asChild>
                <Link href="/dashboard/upload-api">Upload an API</Link>
              </Button>
              <Button variant="outline" className="rounded-full border-border/70 bg-background/80 px-5" asChild>
                <Link href="/dashboard/upload-model">Deploy a model</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer id="support" className="border-t border-border/60 bg-surface/70">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-3xl border border-border/70 bg-background p-1 shadow-sm">
                  <LogoIcon />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight">DeployZen</p>
                  <p className="text-xs text-muted-foreground">A cleaner operations layer for AI product teams</p>
                </div>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Bring API validation, model deployment, security review, and monitoring into a more professional, easier
                to trust workspace.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Product</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>API Testing</div>
                <div>Model Operations</div>
                <div>Monitoring</div>
                <div>Lifecycle Boards</div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Resources</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>Documentation</div>
                <div>Guides</div>
                <div>Release Notes</div>
                <div>Status</div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Support</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>Help Center</div>
                <div>Community</div>
                <div>Contact</div>
                <div>Security</div>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-border/60 pt-6 text-sm text-muted-foreground">
            <p>&copy; 2026 DeployZen. Built for calmer testing and deployment workflows.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
