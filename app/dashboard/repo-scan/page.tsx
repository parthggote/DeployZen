"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  FileCode,
  Folder,
  GitBranch,
  Github,
  Loader2,
  LogOut,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
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

interface ScanProgress {
  stage: string
  percent: number
  updatedAt: string
  currentDir?: string | null
  scannedDirs?: string[]
  totalDirs?: number
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
  progress: ScanProgress | null
  aiExplanations: Record<string, string>
  chatHistory: ChatMessage[]
  error?: string
}

type View = "home" | "progress" | "results"

/**
 * Repo Scanner page — connect GitHub, scan repos, explore findings with live incremental updates
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

  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [runningScanId, setRunningScanId] = useState<string | null>(null)
  const evtSourceRef = useRef<EventSource | null>(null)

  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)

  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [loadingExplanation, setLoadingExplanation] = useState<number | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null)

  const [newFindingCount, setNewFindingCount] = useState(0)
  const prevFindingCountRef = useRef(0)
  /**
   * Closes the active SSE connection
   */
  const closeStream = useCallback(() => {
    if (evtSourceRef.current) {
      evtSourceRef.current.close()
      evtSourceRef.current = null
    }
  }, [])

  /**
   * Opens an SSE stream for a scan and processes live updates.
   * Replaces polling — the server pushes changes as they happen.
   * @param {string} scanId - Scan ID to stream
   */
  const openScanStream = useCallback((scanId: string) => {
    closeStream()

    const evtSource = new EventSource(`/api/scans/${scanId}/stream`)
    evtSourceRef.current = evtSource

    evtSource.addEventListener("scan_update", (e: MessageEvent) => {
      try {
        const { scan, isTerminal } = JSON.parse(e.data) as {
          scan: FullScan
          isTerminal: boolean
        }

        if (scan.progress) {
          setScanProgress(scan.progress)
        }

        const hasData = (scan.findings?.length || 0) > 0 || (scan.fileTree?.length || 0) > 0

        if (!isTerminal) {
          const incoming = scan.findings?.length || 0
          if (incoming > prevFindingCountRef.current) {
            setNewFindingCount(incoming - prevFindingCountRef.current)
            prevFindingCountRef.current = incoming
            setTimeout(() => setNewFindingCount(0), 2000)
          }

          setFullScan(scan)
          setExplanations(scan.aiExplanations || {})
          setChatHistory(scan.chatHistory || [])
        }

        if (isTerminal) {
          setFullScan(scan)
          setExplanations(scan.aiExplanations || {})
          setChatHistory(scan.chatHistory || [])
          setRunningScanId(null)
          setScanning(false)
          setScanProgress(null)
          prevFindingCountRef.current = 0

          if (scan.status === "failed") {
            setScanError(scan.error || "Scan failed")
            setView("home")
          } else {
            setView("results")
          }

          loadScans()
          evtSource.close()
          evtSourceRef.current = null
        }
      } catch {
        /* malformed event, skip */
      }
    })

    evtSource.addEventListener("error", (e: MessageEvent) => {
      try {
        const { error } = JSON.parse(e.data) as { error: string }
        setScanError(error)
        setScanning(false)
        setView("home")
        evtSource.close()
        evtSourceRef.current = null
      } catch {
        /* network error — EventSource auto-reconnects */
      }
    })
  }, [closeStream])

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

  useEffect(() => {
    return () => closeStream()
  }, [closeStream])

  /**
   * Starts a scan for the selected repository
   */
  async function startScan() {
    if (!selectedRepo) return

    setScanning(true)
    setScanError(null)
    setScanProgress({ stage: "Queued", percent: 2, updatedAt: new Date().toISOString() })
    prevFindingCountRef.current = 0

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

      if (data.success && data.scanId) {
        setRunningScanId(data.scanId)
        setSelectedScanId(data.scanId)
        setFullScan({
          _id: data.scanId,
          repoFullName: selectedRepo.fullName,
          branch: selectedRepo.defaultBranch,
          commitSha: data.commitSha || "-------",
          status: "running",
          startedAt: new Date().toISOString(),
          completedAt: null,
          fileTree: [],
          findings: [],
          summary: null,
          progress: { stage: "Queued", percent: 2, updatedAt: new Date().toISOString() },
          aiExplanations: {},
          chatHistory: [],
        })
        setView("results")
        openScanStream(data.scanId)
      } else {
        setScanError(data.error || "Scan failed")
        setScanning(false)
        setScanProgress(null)
        setView("home")
      }
    } catch {
      setScanError("Failed to start scan")
      setScanning(false)
      setScanProgress(null)
      setView("home")
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
        const scan = data.scan as FullScan

        if (scan.status === "running" || scan.status === "queued") {
          setScanProgress(scan.progress || { stage: "Running...", percent: 10, updatedAt: new Date().toISOString() })
          setRunningScanId(scanId)
          setScanning(true)
          prevFindingCountRef.current = scan.findings?.length || 0

          setFullScan(scan)
          setExplanations(scan.aiExplanations || {})
          setChatHistory(scan.chatHistory || [])
          setView("results")

          openScanStream(scanId)
        } else {
          setFullScan(scan)
          setExplanations(scan.aiExplanations || {})
          setChatHistory(scan.chatHistory || [])
          setView("results")
        }
      }
    } catch {
      /* non-critical */
    } finally {
      setScanLoading(false)
    }
  }

  /**
   * Fetches file content from GitHub at the scan's pinned SHA
   * @param {string} filePath - File path to fetch
   */
  async function fetchFileContent(filePath: string) {
    if (!fullScan) return

    setSelectedFile(filePath)
    setLoadingFile(true)
    setFileContent(null)

    try {
      const res = await fetch(
        `/api/scans/${fullScan._id}/file?path=${encodeURIComponent(filePath)}`
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

  /**
   * Deletes a scan from history
   * @param {string} scanId - Scan ID to remove
   */
  async function deleteScan(scanId: string) {
    try {
      const res = await fetch(`/api/scans/${scanId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setScans((prev) => prev.filter((s) => s._id !== scanId))
        if (selectedScanId === scanId) {
          setSelectedScanId(null)
          setFullScan(null)
          setView("home")
        }
      }
    } catch {
      /* non-critical */
    }
  }

  /**
   * Disconnects the GitHub account and resets auth state
   */
  async function disconnectGithub() {
    try {
      const res = await fetch("/api/auth/github/disconnect", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setGithubConnected(false)
        setSelectedRepo(null)
        setScans([])
      }
    } catch {
      /* non-critical */
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="icon-lg animate-spin text-muted-foreground" />
      </div>
    )
  }

  if ((view === "results" || view === "progress") && fullScan) {
    return <ScanResultsView
      scan={fullScan}
      scanLoading={scanLoading}
      scanning={scanning}
      scanProgress={scanProgress}
      newFindingCount={newFindingCount}
      selectedFile={selectedFile}
      fileContent={fileContent}
      loadingFile={loadingFile}
      explanations={explanations}
      loadingExplanation={loadingExplanation}
      chatHistory={chatHistory}
      selectedFindingIndex={selectedFindingIndex}
      onBack={() => {
        closeStream()
        setScanning(false)
        setScanProgress(null)
        setRunningScanId(null)
        setView("home")
        setFullScan(null)
      }}
      onCancel={() => {
        closeStream()
        setScanning(false)
        setScanProgress(null)
        setRunningScanId(null)
        setView("home")
        setFullScan(null)
      }}
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
            <>
              <Badge className="bg-success/10 text-success hover:bg-success/10 gap-1.5">
                <Github className="h-3 w-3" />
                Connected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl text-muted-foreground hover:text-error hover:border-error/30"
                onClick={disconnectGithub}
              >
                <LogOut className="icon-xs" />
                Disconnect
              </Button>
            </>
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
                    <AlertTriangle className="icon-xs text-error shrink-0" />
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
              onDelete={deleteScan}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ── Scanning verbs (inspired by Claude Code) ── */

const SCAN_VERBS = [
  "Analyzing", "Auditing", "Inspecting", "Probing", "Scrutinizing",
  "Dissecting", "Investigating", "Evaluating", "Examining", "Fortifying",
  "Parsing", "Traversing", "Deciphering", "Processing", "Orchestrating",
  "Synthesizing", "Correlating", "Validating", "Enumerating", "Cataloging",
  "Percolating", "Cogitating", "Calibrating", "Computing", "Crystallizing",
  "Ruminating", "Contemplating", "Untangling", "Decoding", "Rummaging",
]

/* ── Live Scanning Banner ── */

interface ScanningBannerProps {
  progress: ScanProgress | null
  findingCount: number
  newFindingCount: number
  onCancel: () => void
}

/**
 * Compact banner showing live scan progress with a rotating verb
 * @param {ScanningBannerProps} props - Component props
 */
function ScanningBanner({ progress, findingCount, newFindingCount, onCancel }: ScanningBannerProps) {
  const percent = progress?.percent || 0
  const currentDir = progress?.currentDir
  const scannedDirs = progress?.scannedDirs || []
  const totalDirs = progress?.totalDirs || 0

  const [verbIdx, setVerbIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setVerbIdx((v) => v + 1), 3000)
    return () => clearInterval(timer)
  }, [])

  const verb = SCAN_VERBS[verbIdx % SCAN_VERBS.length]

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20">
      {/* Shimmer progress bar */}
      <div className="relative h-1 w-full bg-border/20 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-[shimmer_2s_infinite]" />
      </div>

      <div className="flex items-center justify-between px-4 py-2 bg-primary/[0.03]">
        <div className="flex items-center gap-3 min-w-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
          <span
            key={verb}
            className="text-xs font-medium text-primary animate-in fade-in slide-in-from-bottom-1 duration-500 scan-shimmer-text"
          >
            {verb}...
          </span>
          {currentDir && (
            <span className="text-[11px] text-muted-foreground truncate">
              {currentDir}{totalDirs > 0 ? ` (${scannedDirs.length}/${totalDirs})` : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {newFindingCount > 0 && (
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px] px-1.5 py-0 animate-in fade-in slide-in-from-right-2 duration-300">
              +{newFindingCount}
            </Badge>
          )}
          {findingCount > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {findingCount} found
            </span>
          )}
          <span className="text-[11px] tabular-nums font-medium text-foreground/50">
            {percent}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 rounded-md text-[10px] text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Results View ── */

interface ScanResultsViewProps {
  scan: FullScan
  scanLoading: boolean
  scanning: boolean
  scanProgress: ScanProgress | null
  newFindingCount: number
  selectedFile: string | null
  fileContent: string | null
  loadingFile: boolean
  explanations: Record<string, string>
  loadingExplanation: number | null
  chatHistory: ChatMessage[]
  selectedFindingIndex: number | null
  onBack: () => void
  onCancel: () => void
  onFileSelect: (path: string) => void
  onExplain: (index: number) => void
  onNewChatMessage: (userMsg: ChatMessage, assistantMsg: ChatMessage) => void
  onCloseFile: () => void
}

/**
 * Three-column view displaying file explorer, findings, and AI chat
 * Includes a live scanning banner when a scan is actively running
 * @param {ScanResultsViewProps} props - Component props
 */
function ScanResultsView({
  scan,
  scanLoading,
  scanning,
  scanProgress,
  newFindingCount,
  selectedFile,
  fileContent,
  loadingFile,
  explanations,
  loadingExplanation,
  chatHistory,
  selectedFindingIndex,
  onBack,
  onCancel,
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

  const scannedDirSet = new Set(scanProgress?.scannedDirs || [])
  const hasFiles = scan.fileTree.length > 0
  const hasFindings = scan.findings.length > 0

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Live scanning banner */}
      {scanning && (
        <ScanningBanner
          progress={scanProgress}
          findingCount={scan.findings.length}
          newFindingCount={newFindingCount}
          onCancel={onCancel}
        />
      )}

      {/* Partial-failure warning */}
      {!scanning && scan.status === "completed_with_errors" && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2">
          <AlertTriangle className="icon-xs text-warning shrink-0" />
          <p className="text-xs text-warning">
            {scan.error || "Some directories failed to scan. Results may be incomplete."}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl mt-0.5 shrink-0"
            onClick={onBack}
          >
            <ArrowLeft className="icon-sm" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
                {scan.repoFullName}
              </h1>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {scan.branch}
              </Badge>
              {scanning && (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px] px-1.5 py-0 gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Live
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Commit <code className="rounded bg-surface-tertiary px-1 py-0.5 font-mono text-[10px] text-foreground/70">{scan.commitSha.slice(0, 7)}</code>
              {" · "}
              {scanning
                ? "Scan in progress..."
                : scan.completedAt
                  ? `Scanned ${new Date(scan.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : "Scan in progress"}
            </p>
          </div>
        </div>

        {scan.summary ? (
          <div className="flex items-center gap-px rounded-xl border border-border/50 bg-surface-secondary/50 overflow-hidden shrink-0">
            {scan.summary.critical > 0 && (
              <div className="flex items-center gap-1.5 px-3.5 py-2 border-r border-border/30">
                <span className="h-2 w-2 rounded-full bg-error shadow-[0_0_6px] shadow-error/40" />
                <span className="text-sm font-semibold tabular-nums text-error">{scan.summary.critical}</span>
                <span className="text-[10px] text-muted-foreground">critical</span>
              </div>
            )}
            {scan.summary.warning > 0 && (
              <div className="flex items-center gap-1.5 px-3.5 py-2 border-r border-border/30">
                <span className="h-2 w-2 rounded-full bg-warning" />
                <span className="text-sm font-semibold tabular-nums text-warning">{scan.summary.warning}</span>
                <span className="text-[10px] text-muted-foreground">warnings</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3.5 py-2 border-r border-border/30">
              <span className="h-2 w-2 rounded-full bg-info" />
              <span className="text-sm font-semibold tabular-nums text-info">{scan.summary.info}</span>
              <span className="text-[10px] text-muted-foreground">info</span>
            </div>
            <div className="flex items-center gap-1.5 px-3.5 py-2">
              <span className="text-sm font-semibold tabular-nums text-foreground/60">{scan.summary.filesScanned}</span>
              <span className="text-[10px] text-muted-foreground">files</span>
            </div>
          </div>
        ) : scanning ? (
          <div className="flex items-center gap-px rounded-xl border border-border/50 bg-surface-secondary/50 overflow-hidden shrink-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-1.5 px-3.5 py-2 border-r border-border/30 last:border-r-0">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-5" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* File content viewer */}
      {selectedFile && fileContent !== null && (
        <Card className="rounded-2xl border-border/60 overflow-hidden max-w-full">
          <div className="flex items-center justify-between border-b border-border/40 bg-surface-secondary/50 px-4 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="icon-sm text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground truncate">
                {selectedFile}
              </span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                {selectedFile.split(".").pop()?.toUpperCase()}
              </Badge>
              {(() => {
                const fileFindings = scan.findings.filter((f) => f.filePath === selectedFile)
                return fileFindings.length > 0 ? (
                  <Badge className="bg-error/10 text-error hover:bg-error/10 text-[9px] px-1.5 py-0 shrink-0">
                    {fileFindings.length} {fileFindings.length === 1 ? "issue" : "issues"}
                  </Badge>
                ) : null
              })()}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg shrink-0 hover:bg-error/10 hover:text-error"
              onClick={onCloseFile}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="h-[22rem]">
            {loadingFile ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="icon-md animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="relative">
                <table className="w-full border-collapse font-mono text-[11px] leading-[1.6]">
                  <tbody>
                    {fileContent.split("\n").map((line, i) => {
                      const lineNum = i + 1
                      const hasIssue = scan.findings.some(
                        (f) => f.filePath === selectedFile && lineNum >= f.startLine && lineNum <= f.endLine
                      )
                      return (
                        <tr
                          key={i}
                          className={cn(
                            "group",
                            hasIssue && "bg-error/[0.06]"
                          )}
                        >
                          <td className="sticky left-0 w-[1px] whitespace-nowrap border-r border-border/30 bg-surface-secondary/80 px-3 py-0 text-right text-[10px] text-muted-foreground/50 select-none">
                            {lineNum}
                          </td>
                          {hasIssue && (
                            <td className="w-[1px] px-1 py-0">
                              <AlertTriangle className="h-3 w-3 text-error" />
                            </td>
                          )}
                          <td className={cn("px-4 py-0 whitespace-pre text-foreground/90", !hasIssue && "pl-6")}>
                            {line || " "}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ScrollArea>
        </Card>
      )}

      {/* Three-column resizable layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="h-[calc(100vh-14rem)] rounded-2xl border border-border/50 overflow-hidden"
      >
        {/* File Explorer */}
        <ResizablePanel defaultSize={20} minSize={12} maxSize={35}>
          <div className="flex h-full flex-col bg-surface-secondary/20">
            <div className="flex items-center justify-between border-b border-border/40 bg-surface-secondary/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Folder className="icon-xs text-primary/70" />
                <p className="text-xs font-medium text-foreground">Files</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] tabular-nums font-medium text-foreground/60">
                  {scan.fileTree.filter((f) => f.type === "file").length}
                </span>
                {scanning && scannedDirSet.size > 0 && (
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[9px] px-1.5 py-0 gap-0.5">
                    <Loader2 className="h-2 w-2 animate-spin" />
                    {scannedDirSet.size} dirs
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto px-1 py-1">
              {hasFiles ? (
                <RepoFileExplorer
                  fileTree={scan.fileTree}
                  selectedFile={selectedFile}
                  loadingFile={loadingFile}
                  onFileSelect={onFileSelect}
                />
              ) : scanning ? (
                <div className="space-y-1.5 px-2 py-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <Skeleton className="h-3.5 w-3.5 rounded" />
                      <Skeleton className="h-3" style={{ width: `${45 + (i * 17) % 40}%` }} />
                    </div>
                  ))}
                  <div className="pl-4 space-y-1.5 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <Skeleton className="h-3 w-3 rounded" />
                        <Skeleton className="h-3" style={{ width: `${35 + (i * 23) % 50}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                  <Folder className="h-6 w-6" />
                  <p className="mt-1.5 text-[11px]">No files</p>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-border/30 hover:bg-primary/20 data-[resize-handle-active]:bg-primary/30 transition-colors w-[3px]" />

        {/* Findings Panel */}
        <ResizablePanel defaultSize={50} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border/40 bg-surface-secondary/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="icon-xs text-warning" />
                <p className="text-xs font-medium text-foreground">
                  Findings
                  {scanning && (
                    <span className="ml-1 text-primary font-normal">(live)</span>
                  )}
                </p>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 tabular-nums">
                  {scan.findings.length}
                </Badge>
                {scanning && newFindingCount > 0 && (
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[9px] px-1.5 py-0 animate-in fade-in duration-300">
                    +{newFindingCount}
                  </Badge>
                )}
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
            <div className="flex-1 overflow-auto px-2 py-1">
              {hasFindings ? (
                <ScanFindingsPanel
                  findings={scan.findings}
                  explanations={explanations}
                  loadingExplanation={loadingExplanation}
                  selectedFile={selectedFile}
                  onExplain={onExplain}
                  onFileClick={onFileSelect}
                />
              ) : scanning ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/40 p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-14 rounded-full" />
                        <Skeleton className="h-3.5 w-24" />
                      </div>
                      <Skeleton className="h-3 w-[80%]" />
                      <Skeleton className="h-3 w-[55%]" />
                      <div className="flex items-center gap-2 pt-1">
                        <Skeleton className="h-3 w-3 rounded" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                  <Shield className="h-6 w-6" />
                  <p className="mt-1.5 text-[11px]">No findings</p>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-border/30 hover:bg-primary/20 data-[resize-handle-active]:bg-primary/30 transition-colors w-[3px]" />

        {/* AI Chat Panel */}
        <ResizablePanel defaultSize={30} minSize={18} maxSize={45}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border/40 bg-surface-secondary/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="icon-xs text-primary" />
                <p className="text-xs font-medium text-foreground">Security Assistant</p>
              </div>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                {scanning ? "Waiting..." : "Ready"}
              </Badge>
            </div>
            <ScanChatPanel
              scanId={scan._id}
              chatHistory={chatHistory}
              onNewMessage={onNewChatMessage}
              selectedFindingIndex={selectedFindingIndex}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
