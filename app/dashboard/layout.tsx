import type React from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { BackendWarmup } from "@/components/backend-warmup"
import { ErrorBoundary } from "@/components/error-boundary"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="noise-overlay min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-surface-secondary/40 to-background">
      <BackendWarmup />
      <TooltipProvider delayDuration={120}>
        <div className="flex min-h-screen">
          <DashboardSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <DashboardHeader />
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              <div className="mx-auto max-w-7xl">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </div>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
}
