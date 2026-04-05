"use client"

import { useState, useEffect, useCallback } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  FileCode,
  GitBranch,
  Github,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { RepoSelector } from "@/components/repo-selector"
import { ScanHistoryList, type ScanRecord } from "@/components/scan-history-list"
import { RepoFileExplorer } from "@/components/repo-file-explorer"
import { ScanFindingsPanel, type SemgrepFinding } from "@/components/scan-findings-panel"
import { ScanChatPanel } from "@/components/scan-chat-panel"

interface Repo {
  id: number
  name: string
  fullName: string
  private: boolean
  description: string | null
  language: string | null
  defaultBranch: string
  updatedAt: string
  stars: number
  owner: string
}

interface FileTreeEntry {
  path: string
  type: "file" | "dir"
  size?: number
  findingCount: number
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

interface ScanSummary {
  total: number
  critical: number
  warning: number
  info: number
  filesScanned: number
  topCategories: { name: string; count: number }[]
}

interface FullScan {
  _id: string
  repoFullName: string
  branch: string
  commitSha: string
  status: string
  startedAt: string
  completedAt: string | null
  fileTree: FileTreeEntry[]
  findings: SemgrepFinding[]
  summary: ScanSummary | null
  aiExplanations: Record<string, string>
  chatHistory: ChatMessage[]
}

type View = "home" | "results"

/**
 * Repo Scanner page — connect GitHub, scan repos, explore findings
 */
export default function RepoScanPage() {
  const [view, setView] = useState<View>("home")
  const [githubConnected, setGithubConnected] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const [scans, setScans] = useState<ScanRecord[]>([])
  const [scansLoading, setScansLoading] = useState(false)
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null)

  const [fullScan, setFullScan] = useState<FullScan | null>(null)
  const [scanLoading, setScanLoading] = useState(false)

  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)

  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [loadingExplanation, setLoadingExplanation] = useState<number | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null)

  /**
   * Checks whether GitHub OAuth has been completed
   */
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/repos")
      const data = await res.json()
      setGithubConnected(data.success === true)
    } catch {
      setGithubConnected(false)
    } finally {
      setCheckingAuth(false)
    }
  }, [])

  /**
   * Loads scan history from the API
   */
  const loadScans = useCallback(async () => {
    setScansLoading(true)
    try {
      const res = await fetch("/api/scans")
      const data = await res.json()
      if (data.success) setScans(data.scans || [])
    } catch {
      /* non-critical */
    } finally {
      setScansLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
    loadScans()
  }, [checkAuth, loadScans])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("connected") === "true") {
      setGithubConnected(true)
      window.history.replaceState({}, "", "/dashboard/repo-scan")
    }
  }, [])

  /**
   * Starts a scan for the selected repository
   */
  async function startScan() {
    if (!selectedRepo) return

    setScanning(true)
    setScanError(null)

    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: selectedRepo.fullName,
          branch: selectedRepo.defaultBranch,
        }),
      })

      const data = await res.json()

      if (data.success && data.scan) {
        await loadScans()
        await loadFullScan(data.scan._id)
        setView("results")
      } else {
        setScanError(data.error || "Scan failed")
      }
    } catch {
      setScanError("Failed to start scan")
    } finally {
      setScanning(false)
    }
  }

  /**
   * Loads full scan data by ID and switches to results view
   * @param {string} scanId - MongoDB scan document ID
   */
  async function loadFullScan(scanId: string) {
    setScanLoading(true)
    setSelectedScanId(scanId)
    setSelectedFile(null)
    setFileContent(null)
    setSelectedFindingIndex(null)

    try {
      const res = await fetch(`/api/scans/${scanId}`)
      const data = await res.json()

      if (data.success && data.scan) {
        setFullScan(data.scan)
        setExplanations(data.scan.aiExplanations || {})
        setChatHistory(data.scan.chatHistory || [])
        setView("results")
      }
    } catch {
      /* non-critical */
    } finally {
      setScanLoading(false)
    }
  }

  /**
   * Fetches file content from GitHub at the scan's pinned SHA
   * @param {string} path - File path to fetch
   */
  async function fetchFileContent(path: string) {
    if (!fullScan) return

    setSelectedFile(path)
    setLoadingFile(true)
    setFileContent(null)

    try {
      const res = await fetch(
        `/api/scans/${fullScan._id}/file?path=${encodeURIComponent(path)}`
      )
      const data = await res.json()

      if (data.success) {
        setFileContent(data.content)
      }
    } catch {
      setFileContent("// Failed to load file content")
    } finally {
      setLoadingFile(false)
    }
  }

  /**
   * Requests an AI explanation for a specific finding
   * @param {number} findingIndex - Index of the finding to explain
   */
  async function explainFinding(findingIndex: number) {
    if (!fullScan) return

    setLoadingExplanation(findingIndex)
    setSelectedFindingIndex(findingIndex)

    try {
      const res = await fetch(`/api/scans/${fullScan._id}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingIndex }),
      })

      const data = await res.json()

      if (data.success) {
        setExplanations((prev) => ({
          ...prev,
          [String(findingIndex)]: data.explanation,
        }))
      }
    } catch {
      /* non-critical */
    } finally {
      setLoadingExplanation(null)
    }
  }

  /**
   * Handles a new chat message pair from the chat panel
   * @param {ChatMessage} userMsg - User's message
   * @param {ChatMessage} assistantMsg - AI's response
   */
  function handleNewChatMessage(userMsg: ChatMessage, assistantMsg: ChatMessage) {
    setChatHistory((prev) => [...prev, userMsg, assistantMsg])
  }

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="icon-lg animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (view === "results" && fullScan) {
    return <ScanResultsView
      scan={fullScan}
      scanLoading={scanLoading}
      selectedFile={selectedFile}
      fileContent={fileContent}
      loadingFile={loadingFile}
      explanations={explanations}
      loadingExplanation={loadingExplanation}
      chatHistory={chatHistory}
      selectedFindingIndex={selectedFindingIndex}
      onBack={() => { setView("home"); setFullScan(null) }}
      onFileSelect={fetchFileContent}
      onExplain={explainFinding}
      onNewChatMessage={handleNewChatMessage}
      onCloseFile={() => { setSelectedFile(null); setFileContent(null) }}
    />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Repo Scanner
          </h1>
          <p className="text-sm text-muted-foreground">
            Scan GitHub repositories for security vulnerabilities using Semgrep
          </p>
        </div>

        <div className="flex items-center gap-2">
          {githubConnected ? (
            <Badge className="bg-success/10 text-success hover:bg-success/10 gap-1.5">
              <Github className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Button
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => { window.location.href = "/api/auth/github" }}
            >
              <Github className="icon-xs" />
              Connect GitHub
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl"
            onClick={loadScans}
          >
            <RefreshCw className="icon-xs" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Repo selector + Scan trigger */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <GitBranch className="icon-sm text-primary" />
              </div>
              Select Repository
            </CardTitle>
          </CardHeader>
          <CardContent>
            {githubConnected ? (
              <div className="space-y-4">
                <RepoSelector
                  onSelect={setSelectedRepo}
                  selectedRepo={selectedRepo}
                />

                {selectedRepo && (
                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1 gap-2 rounded-xl"
                      onClick={startScan}
                      disabled={scanning}
                    >
                      {scanning ? (
                        <Loader2 className="icon-xs animate-spin" />
                      ) : (
                        <Play className="icon-xs" />
                      )}
                      {scanning ? "Scanning..." : "Start Scan"}
                    </Button>
                  </div>
                )}

                {scanError && (
                  <div className="flex items-center gap-2 rounded-xl border border-error/30 bg-error/5 px-3 py-2">
                    <AlertTriangle className="icon-xs text-error" />
                    <p className="text-xs text-error">{scanError}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Github className="mx-auto icon-lg text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Connect your GitHub account to start scanning
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan history */}
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-secondary">
                <Shield className="icon-sm text-muted-foreground" />
              </div>
              Scan History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScanHistoryList
              scans={scans}
              loading={scansLoading}
              selectedId={selectedScanId}
              onSelect={(id) => loadFullScan(id)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ── Results View ── */

interface ScanResultsViewProps {
  scan: FullScan
  scanLoading: boolean
  selectedFile: string | null
  fileContent: string | null
  loadingFile: boolean
  explanations: Record<string, string>
  loadingExplanation: number | null
  chatHistory: ChatMessage[]
  selectedFindingIndex: number | null
  onBack: () => void
  onFileSelect: (path: string) => void
  onExplain: (index: number) => void
  onNewChatMessage: (userMsg: ChatMessage, assistantMsg: ChatMessage) => void
  onCloseFile: () => void
}

/**
 * Three-column view displaying file explorer, findings, and AI chat
 * @param {ScanResultsViewProps} props - Component props
 */
function ScanResultsView({
  scan,
  scanLoading,
  selectedFile,
  fileContent,
  loadingFile,
  explanations,
  loadingExplanation,
  chatHistory,
  selectedFindingIndex,
  onBack,
  onFileSelect,
  onExplain,
  onNewChatMessage,
  onCloseFile,
}: ScanResultsViewProps) {
  if (scanLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="icon-lg animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl"
            onClick={onBack}
          >
            <ArrowLeft className="icon-sm" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                {scan.repoFullName}
              </h1>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {scan.branch}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Commit {scan.commitSha.slice(0, 7)} · Scanned{" "}
              {scan.completedAt
                ? new Date(scan.completedAt).toLocaleDateString()
                : "in progress"}
            </p>
          </div>
        </div>

        {scan.summary && (
          <div className="flex items-center gap-3 rounded-full border border-border/60 bg-background/80 px-4 py-1.5">
            {scan.summary.critical > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-error" />
                <span className="font-medium text-error">{scan.summary.critical}</span>
                <span className="text-muted-foreground">critical</span>
              </span>
            )}
            {scan.summary.warning > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-warning" />
                <span className="font-medium text-warning">{scan.summary.warning}</span>
                <span className="text-muted-foreground">warnings</span>
              </span>
            )}
            <span className="flex items-center gap-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-info" />
              <span className="font-medium text-info">{scan.summary.info}</span>
              <span className="text-muted-foreground">info</span>
            </span>
            <span className="text-xs text-muted-foreground">
              · {scan.summary.filesScanned} files
            </span>
          </div>
        )}
      </div>

      {/* File content overlay */}
      {selectedFile && fileContent !== null && (
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="icon-sm text-muted-foreground" />
                <span className="text-xs font-medium text-foreground truncate">
                  {selectedFile}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-lg"
                onClick={onCloseFile}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="h-[18rem]">
              {loadingFile ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="icon-md animate-spin text-muted-foreground" />
                </div>
              ) : (
                <pre className="overflow-x-auto rounded-xl bg-surface-tertiary p-3 text-[11px] leading-relaxed text-foreground/90 font-mono">
                  {fileContent}
                </pre>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Three-column layout */}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
        {/* File Explorer */}
        <Card className="rounded-2xl border-border/60 overflow-hidden">
          <div className="border-b border-border/40 px-3 py-2">
            <p className="text-xs font-medium text-foreground">Files</p>
            <p className="text-[10px] text-muted-foreground">
              {scan.fileTree.filter((f) => f.type === "file").length} files
            </p>
          </div>
          <div className="px-1 py-1">
            <RepoFileExplorer
              fileTree={scan.fileTree}
              selectedFile={selectedFile}
              loadingFile={loadingFile}
              onFileSelect={onFileSelect}
            />
          </div>
        </Card>

        {/* Findings Panel */}
        <Card className="rounded-2xl border-border/60 overflow-hidden">
          <div className="border-b border-border/40 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Findings</p>
                <p className="text-[10px] text-muted-foreground">
                  {scan.findings.length} issues found
                </p>
              </div>
              {scan.summary && scan.summary.total > 0 && (
                <div className="flex items-center gap-1">
                  {scan.summary.topCategories?.slice(0, 3).map((cat) => (
                    <Badge
                      key={cat.name}
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0"
                    >
                      {cat.name} ({cat.count})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="px-2 py-1">
            <ScanFindingsPanel
              findings={scan.findings}
              explanations={explanations}
              loadingExplanation={loadingExplanation}
              selectedFile={selectedFile}
              onExplain={onExplain}
              onFileClick={onFileSelect}
            />
          </div>
        </Card>

        {/* AI Chat Panel */}
        <Card className="rounded-2xl border-border/60 overflow-hidden">
          <div className="border-b border-border/40 px-3 py-2">
            <p className="text-xs font-medium text-foreground">Security Assistant</p>
            <p className="text-[10px] text-muted-foreground">
              AI-powered analysis
            </p>
          </div>
          <ScanChatPanel
            scanId={scan._id}
            chatHistory={chatHistory}
            onNewMessage={onNewChatMessage}
            selectedFindingIndex={selectedFindingIndex}
          />
        </Card>
      </div>
    </div>
  )
}
