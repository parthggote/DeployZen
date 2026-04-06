"use client"

import React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Catches render errors in child components and displays a recovery UI
 * instead of crashing the entire dashboard.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  /**
   * Resets the error state so the children can attempt to re-render
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-surface/80 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-error/10">
            <AlertTriangle className="h-6 w-6 text-error" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold font-display">
              {this.props.fallbackTitle || "Something went wrong"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md">
              {this.state.error?.message || "An unexpected error occurred while rendering this section."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={this.handleReset}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
