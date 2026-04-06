"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
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
  referenceUrl?: string | null
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
 * @returns {{ Icon: React.ComponentType, colorClass: string, bgClass: string, borderClass: string, barClass: string, label: string }}
 */
function severityStyle(severity: string) {
  switch (severity) {
    case "ERROR":
      return {
        Icon: AlertCircle,
        colorClass: "text-error",
        bgClass: "bg-error/10 text-error hover:bg-error/10",
        borderClass: "border-error/20",
        barClass: "severity-bar-error",
        label: "Critical",
      }
    case "WARNING":
      return {
        Icon: AlertTriangle,
        colorClass: "text-warning",
        bgClass: "bg-warning/10 text-warning hover:bg-warning/10",
        borderClass: "border-warning/20",
        barClass: "severity-bar-warning",
        label: "Warning",
      }
    default:
      return {
        Icon: Info,
        colorClass: "text-info",
        bgClass: "bg-info/10 text-info hover:bg-info/10",
        borderClass: "border-info/20",
        barClass: "severity-bar-info",
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
 * Renders a snippet with line numbers from the finding context
 * @param {{ snippet: string, startLine: number }} props
 */
function SnippetBlock({ snippet, startLine }: { snippet: string; startLine: number }) {
  const [copied, setCopied] = useState(false)
  const lines = snippet.split("\n")

  return (
    <div className="group relative rounded-lg border border-border/30 bg-surface-tertiary overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/20 bg-surface-secondary/40 px-3 py-1">
        <span className="text-[9px] font-mono text-muted-foreground/60">
          Lines {startLine}–{startLine + lines.length - 1}
        </span>
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground transition-colors"
          onClick={() => {
            navigator.clipboard.writeText(snippet)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          aria-label="Copy snippet"
        >
          {copied ? <Check className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[10px] leading-[1.65]">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-background/30 transition-colors">
                <td className="w-[1px] whitespace-nowrap border-r border-border/20 px-2.5 py-0 text-right text-muted-foreground/40 select-none">
                  {startLine + i}
                </td>
                <td className="px-3 py-0 whitespace-pre text-foreground/85">
                  {line || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const EXPLANATION_MD_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-surface-tertiary px-1 py-0.5 text-[10px] font-mono text-primary/90">{children}</code>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-1.5 ml-3 list-disc space-y-0.5 last:mb-0">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-1.5 ml-3 list-decimal space-y-0.5 last:mb-0">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
      {children}
    </a>
  ),
}

/**
 * Renders an AI explanation with markdown support
 * @param {{ content: string }} props
 */
function ExplanationBlock({ content }: { content: string }) {
  return (
    <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-3 animate-scale-in">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-semibold text-primary font-display">AI Explanation</span>
      </div>
      <div className="text-[11px] leading-relaxed text-foreground/85">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={EXPLANATION_MD_COMPONENTS}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
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
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 glow-success">
          <Info className="icon-md text-success" />
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground font-display">No findings</p>
        <p className="text-xs text-muted-foreground">This scan found no security issues</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
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
                "rounded-xl border transition-all duration-200",
                isHighlighted
                  ? "border-primary/20 bg-primary/5 glow-primary"
                  : "border-border/50 bg-surface-secondary/50 hover:border-border/70"
              )}
            >
              <button
                type="button"
                onClick={() => toggleFile(filePath)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <ChevronDown
                  className={cn(
                    "icon-xs shrink-0 text-muted-foreground transition-transform duration-200",
                    !isFileExpanded && "-rotate-90"
                  )}
                />
                <FileCode className="icon-xs shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground font-mono">
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
                <div className="border-t border-border/30 px-3 py-2 space-y-2 animate-slide-up-fade">
                  {items.map(({ finding, index }) => {
                    const { Icon, bgClass, borderClass, barClass, label } = severityStyle(finding.severity)
                    const isFindingExpanded = expandedFindings.has(index)
                    const explanation = explanations[String(index)]
                    const isExplaining = loadingExplanation === index

                    return (
                      <div
                        key={index}
                        className={cn(
                          "rounded-lg border bg-background/60 transition-all duration-200",
                          isFindingExpanded ? cn(borderClass, barClass) : "border-border/30"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleFinding(index)}
                          className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                        >
                          <Icon className={cn("icon-xs shrink-0 mt-0.5", severityStyle(finding.severity).colorClass)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-foreground leading-snug">
                              {finding.message}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Badge className={cn(bgClass, "text-[9px] px-1.5 py-0")}>{label}</Badge>
                              <span className="font-mono text-foreground/50">
                                L{finding.startLine}–{finding.endLine}
                              </span>
                              <span className="truncate text-muted-foreground/60 font-mono text-[9px]">{finding.ruleId}</span>
                            </div>
                          </div>
                          <ChevronDown
                            className={cn(
                              "icon-xs shrink-0 text-muted-foreground transition-transform duration-200 mt-0.5",
                              !isFindingExpanded && "-rotate-90"
                            )}
                          />
                        </button>

                        {isFindingExpanded && (
                          <div className="border-t border-border/20 px-3 py-2.5 space-y-2.5 animate-slide-up-fade">
                            {finding.snippet && (
                              <SnippetBlock snippet={finding.snippet} startLine={finding.startLine} />
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5 rounded-lg active:scale-[0.97] transition-transform"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onFileClick(finding.filePath)
                                }}
                              >
                                <ExternalLink className="h-3 w-3" />
                                View file
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                  "h-7 text-xs gap-1.5 rounded-lg group/explain active:scale-[0.97] transition-all",
                                  explanation && "border-primary/20 text-primary"
                                )}
                                disabled={isExplaining || !!explanation}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onExplain(index)
                                }}
                              >
                                {isExplaining ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3 group-hover/explain:rotate-12 transition-transform duration-300" />
                                )}
                                {explanation ? "Explained" : "Explain with AI"}
                              </Button>

                              {finding.referenceUrl && (
                                <a
                                  href={finding.referenceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-border"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Learn more
                                </a>
                              )}
                            </div>

                            {explanation && <ExplanationBlock content={explanation} />}
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
