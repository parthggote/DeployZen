"use client"

import { useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  FileCode,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface SemgrepFinding {
  ruleId: string
  severity: "ERROR" | "WARNING" | "INFO"
  message: string
  filePath: string
  startLine: number
  endLine: number
  snippet: string
  category: string
}

interface ScanFindingsPanelProps {
  findings: SemgrepFinding[]
  explanations: Record<string, string>
  loadingExplanation: number | null
  selectedFile: string | null
  onExplain: (findingIndex: number) => void
  onFileClick: (path: string) => void
}

/**
 * Returns the appropriate icon and color for a finding severity level
 * @param {string} severity - Finding severity
 * @returns {{ Icon: React.ComponentType, colorClass: string, bgClass: string }}
 */
function severityStyle(severity: string) {
  switch (severity) {
    case "ERROR":
      return {
        Icon: AlertCircle,
        colorClass: "text-error",
        bgClass: "bg-error/10 text-error hover:bg-error/10",
        label: "Critical",
      }
    case "WARNING":
      return {
        Icon: AlertTriangle,
        colorClass: "text-warning",
        bgClass: "bg-warning/10 text-warning hover:bg-warning/10",
        label: "Warning",
      }
    default:
      return {
        Icon: Info,
        colorClass: "text-info",
        bgClass: "bg-info/10 text-info hover:bg-info/10",
        label: "Info",
      }
  }
}

/**
 * Groups findings by their file path
 * @param {SemgrepFinding[]} findings - Flat array of findings
 * @returns {Map<string, {finding: SemgrepFinding, index: number}[]>} Grouped map
 */
function groupByFile(findings: SemgrepFinding[]) {
  const groups = new Map<string, { finding: SemgrepFinding; index: number }[]>()

  findings.forEach((finding, index) => {
    const list = groups.get(finding.filePath) || []
    list.push({ finding, index })
    groups.set(finding.filePath, list)
  })

  return groups
}

/**
 * Scrollable panel displaying findings grouped by file with expand/collapse
 * @param {ScanFindingsPanelProps} props - Component props
 */
export function ScanFindingsPanel({
  findings,
  explanations,
  loadingExplanation,
  selectedFile,
  onExplain,
  onFileClick,
}: ScanFindingsPanelProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set())

  const grouped = groupByFile(findings)

  /**
   * Toggles a file group's expansion state
   * @param {string} filePath - File path to toggle
   */
  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }

  /**
   * Toggles a finding's detail expansion
   * @param {number} index - Finding index to toggle
   */
  const toggleFinding = (index: number) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10">
          <Info className="icon-md text-success" />
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">No findings</p>
        <p className="text-xs text-muted-foreground">This scan found no security issues</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-14rem)]">
      <div className="space-y-2 pr-3">
        {Array.from(grouped.entries()).map(([filePath, items]) => {
          const isFileExpanded = expandedFiles.has(filePath)
          const isHighlighted = selectedFile === filePath

          const critCount = items.filter((i) => i.finding.severity === "ERROR").length
          const warnCount = items.filter((i) => i.finding.severity === "WARNING").length

          return (
            <div
              key={filePath}
              className={cn(
                "rounded-xl border transition-colors",
                isHighlighted ? "border-primary/20 bg-primary/5" : "border-border/50 bg-surface-secondary/50"
              )}
            >
              <button
                type="button"
                onClick={() => toggleFile(filePath)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <ChevronDown
                  className={cn(
                    "icon-xs shrink-0 text-muted-foreground transition-transform",
                    !isFileExpanded && "-rotate-90"
                  )}
                />
                <FileCode className="icon-xs shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {filePath}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {critCount > 0 && (
                    <Badge className="bg-error/10 text-error hover:bg-error/10 text-[9px] px-1 py-0">
                      {critCount}
                    </Badge>
                  )}
                  {warnCount > 0 && (
                    <Badge className="bg-warning/10 text-warning hover:bg-warning/10 text-[9px] px-1 py-0">
                      {warnCount}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">
                    {items.length}
                  </Badge>
                </div>
              </button>

              {isFileExpanded && (
                <div className="border-t border-border/30 px-3 py-1.5 space-y-1.5">
                  {items.map(({ finding, index }) => {
                    const { Icon, bgClass, label } = severityStyle(finding.severity)
                    const isFindingExpanded = expandedFindings.has(index)
                    const explanation = explanations[String(index)]
                    const isExplaining = loadingExplanation === index

                    return (
                      <div
                        key={index}
                        className="rounded-lg border border-border/30 bg-background/60"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFinding(index)}
                          className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
                        >
                          <Icon className={cn("icon-xs shrink-0 mt-0.5", severityStyle(finding.severity).colorClass)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-foreground leading-snug">
                              {finding.message}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Badge className={cn(bgClass, "text-[9px] px-1 py-0")}>{label}</Badge>
                              <span>L{finding.startLine}–{finding.endLine}</span>
                              <span className="truncate">{finding.ruleId}</span>
                            </div>
                          </div>
                          <ChevronDown
                            className={cn(
                              "icon-xs shrink-0 text-muted-foreground transition-transform mt-0.5",
                              !isFindingExpanded && "-rotate-90"
                            )}
                          />
                        </button>

                        {isFindingExpanded && (
                          <div className="border-t border-border/20 px-2.5 py-2 space-y-2">
                            {finding.snippet && (
                              <pre className="overflow-x-auto rounded-lg bg-surface-tertiary p-2 text-[11px] leading-relaxed text-foreground/90 font-mono">
                                {finding.snippet}
                              </pre>
                            )}

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5 rounded-lg"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onFileClick(finding.filePath)
                                }}
                              >
                                <FileCode className="h-3 w-3" />
                                View file
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5 rounded-lg"
                                disabled={isExplaining || !!explanation}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onExplain(index)
                                }}
                              >
                                {isExplaining ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                {explanation ? "Explained" : "Explain"}
                              </Button>
                            </div>

                            {explanation && (
                              <div className="rounded-lg border border-primary/15 bg-primary/5 p-2.5">
                                <p className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                                  {explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
