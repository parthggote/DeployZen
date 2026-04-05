"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileCode,
  FolderSearch,
  GitBranch,
  Github,
  Loader2,
  LogOut,
  Play,
  RefreshCw,
  Shield,
  X,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)

  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [loadingExplanation, setLoadingExplanation] = useState<number | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [selectedFindingIndex, setSelectedFindingIndex] = useState<number | null>(null)

  const [newFindingCount, setNewFindingCount] = useState(0)
  const prevFindingCountRef = useRef(0)
  const viewRef = useRef<View>(view)
  viewRef.current = view

  /**
   * Stops the polling interval for scan progress
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  /**
   * Polls the scan status and updates progress/findings incrementally
   * Transitions from progress view to live results as soon as findings arrive
   * @param {string} scanId - The scan ID to poll
   */
  const pollScanStatus = useCallback(async (scanId: string) => {
    try {
      const res = await fetch(`/api/scans/${scanId}`)
      const data = await res.json()

      if (!data.success || !data.scan) return

      const scan = data.scan as FullScan

      if (scan.progress) {
        setScanProgress(scan.progress)
      }

      const hasLiveFindings = scan.findings && scan.findings.length > 0
      const hasFileTree = scan.fileTree && scan.fileTree.length > 0

      if (scan.status === "running" && (hasLiveFindings || hasFileTree)) {
        const incoming = scan.findings?.length || 0
        if (incoming > prevFindingCountRef.current) {
          setNewFindingCount(incoming - prevFindingCountRef.current)
          prevFindingCountRef.current = incoming

          setTimeout(() => setNewFindingCount(0), 2000)
        }

        setFullScan(scan)
        setExplanations(scan.aiExplanations || {})
        setChatHistory(scan.chatHistory || [])

        if (viewRef.current === "progress") {
          setView("results")
        }
      }

      if (scan.status === "completed") {
        stopPolling()
        setFullScan(scan)
        setExplanations(scan.aiExplanations || {})
        setChatHistory(scan.chatHistory || [])
        setRunningScanId(null)
        setScanning(false)
        setScanProgress(null)
        prevFindingCountRef.current = 0
        setView("results")
        loadScans()
      } else if (scan.status === "failed") {
        stopPolling()
        setRunningScanId(null)
        setScanning(false)
        setScanProgress(null)
        prevFindingCountRef.current = 0
        setScanError(scan.error || "Scan failed")
        setView("home")
        loadScans()
      }
    } catch {
      /* polling failure is non-critical, next poll will retry */
    }
  }, [stopPolling])

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
    return () => stopPolling()
  }, [stopPolling])

  /**
   * Starts a scan for the selected repository
   */
  async function startScan() {
    if (!selectedRepo) return

    setScanning(true)
    setScanError(null)
    setScanProgress({ stage: "Initializing...", percent: 5, updatedAt: new Date().toISOString() })
    setFullScan(null)
    prevFindingCountRef.current = 0
    setView("progress")

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

        pollingRef.current = setInterval(() => {
          pollScanStatus(data.scanId)
        }, 2000)

        pollScanStatus(data.scanId)
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

        if (scan.status === "running") {
          setScanProgress(scan.progress || { stage: "Running...", percent: 30, updatedAt: new Date().toISOString() })
          setRunningScanId(scanId)
          setScanning(true)
          prevFindingCountRef.current = scan.findings?.length || 0

          if (scan.findings?.length > 0 || scan.fileTree?.length > 0) {
            setFullScan(scan)
            setExplanations(scan.aiExplanations || {})
            setChatHistory(scan.chatHistory || [])
            setView("results")
          } else {
            setView("progress")
          }

          pollingRef.current = setInterval(() => {
            pollScanStatus(scanId)
          }, 2000)
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

  if (view === "progress") {
    return (
      <ScanProgressView
        repoName={selectedRepo?.fullName || ""}
        progress={scanProgress}
        error={scanError}
        onCancel={() => {
          stopPolling()
          setScanning(false)
          setScanProgress(null)
          setRunningScanId(null)
          setView("home")
        }}
      />
    )
  }

  if (view === "results" && fullScan) {
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
        stopPolling()
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

/* ── Progress View (initial stages before findings arrive) ── */

interface ScanProgressViewProps {
  repoName: string
  progress: ScanProgress | null
  error: string | null
  onCancel: () => void
}

/**
 * Full-page progress view showing live scan stages before any findings arrive
 * @param {ScanProgressViewProps} props - Component props
 */
function ScanProgressView({ repoName, progress, error, onCancel }: ScanProgressViewProps) {
  const stage = progress?.stage || "Initializing..."
  const percent = progress?.percent || 5
  const isFailed = stage === "Failed" || !!error

  const stages = [
    "Initializing...",
    "Connecting to worker...",
    "Cloning repository...",
    "Running security scan...",
  ]

  const currentStageIndex = stages.findIndex((s) => stage.startsWith(s.replace("...", "")))
  const isScanning = stage.startsWith("Scanning:") || stage.startsWith("Running")

  return (
    <div className="flex items-center justify-center py-16">
      <Card className="w-full max-w-lg rounded-2xl border-border/60">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              {isFailed ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10">
                  <XCircle className="h-8 w-8 text-error" />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Shield className="h-8 w-8 text-primary animate-pulse" />
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {isFailed ? "Scan Failed" : "Scanning Repository"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{repoName}</p>
            </div>

            {!isFailed && (
              <div className="space-y-2">
                <Progress value={percent} className="h-2" />
                <p className="text-xs text-muted-foreground">{percent}%</p>
              </div>
            )}

            <div className="space-y-2">
              {isFailed ? (
                <div className="rounded-xl border border-error/30 bg-error/5 px-4 py-3">
                  <p className="text-sm text-error">{error || "An error occurred during scanning"}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {stages.map((s, i) => {
                    const isActive = isScanning
                      ? s === "Running security scan..."
                      : s === stage || (currentStageIndex === -1 && i === stages.length - 1)
                    const isDone = isScanning
                      ? i < stages.length - 1
                      : i < currentStageIndex
                    const isPending = !isDone && !isActive

                    return (
                      <div
                        key={s}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all",
                          isActive && "bg-primary/5"
                        )}
                      >
                        {isDone ? (
                          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
                        ) : isActive ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                        ) : (
                          <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/60" />
                        )}
                        <span
                          className={cn(
                            "text-xs",
                            isDone && "text-muted-foreground line-through",
                            isActive && "text-foreground font-medium",
                            isPending && "text-muted-foreground/50"
                          )}
                        >
                          {s.replace("...", "")}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {isScanning && stage.startsWith("Scanning:") && (
              <div className="rounded-xl bg-surface-secondary px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  <FolderSearch className="inline h-3 w-3 mr-1" />
                  {stage}
                </p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={onCancel}
            >
              {isFailed ? "Back" : "Cancel"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ── Live Scanning Banner ── */

interface ScanningBannerProps {
  repoName: string
  progress: ScanProgress | null
  findingCount: number
  newFindingCount: number
}

/**
 * Compact banner showing live scan progress at the top of the results view
 * @param {ScanningBannerProps} props - Component props
 */
function ScanningBanner({ repoName, progress, findingCount, newFindingCount }: ScanningBannerProps) {
  const percent = progress?.percent || 0
  const scannedDirs = progress?.scannedDirs || []
  const totalDirs = progress?.totalDirs || 0
  const currentDir = progress?.currentDir

  const dirProgress = totalDirs > 0
    ? `${scannedDirs.length}/${totalDirs} directories`
    : progress?.stage || "Scanning..."

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5">
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="h-full bg-primary animate-pulse"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="relative px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  Scanning: {repoName}
                </p>
                {currentDir && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                    <FolderSearch className="h-2.5 w-2.5" />
                    {currentDir}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dirProgress}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {newFindingCount > 0 && (
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-xs animate-in fade-in slide-in-from-right-2 duration-300">
                +{newFindingCount} new
              </Badge>
            )}
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">{findingCount}</p>
              <p className="text-[10px] text-muted-foreground">findings</p>
            </div>
            <div className="w-24">
              <Progress value={percent} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground text-right mt-0.5">{percent}%</p>
            </div>
          </div>
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

  return (
    <div className="space-y-4">
      {/* Live scanning banner */}
      {scanning && (
        <ScanningBanner
          repoName={scan.repoFullName}
          progress={scanProgress}
          findingCount={scan.findings.length}
          newFindingCount={newFindingCount}
        />
      )}

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
              {scanning && (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px] px-1.5 py-0 gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Live
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Commit {scan.commitSha.slice(0, 7)} · {scanning
                ? "Scan in progress..."
                : scan.completedAt
                  ? `Scanned ${new Date(scan.completedAt).toLocaleDateString()}`
                  : "Scan in progress"}
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
              {scanning && scannedDirSet.size > 0 && (
                <span className="ml-1 text-primary">
                  · {scannedDirSet.size} dirs scanned
                </span>
              )}
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
                <p className="text-xs font-medium text-foreground">
                  Findings
                  {scanning && (
                    <span className="ml-1.5 text-primary font-normal">(live)</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {scan.findings.length} issues found
                  {scanning && newFindingCount > 0 && (
                    <span className="ml-1 text-primary animate-in fade-in duration-300">
                      · +{newFindingCount} new
                    </span>
                  )}
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
              {scanning ? "Available once scan completes" : "AI-powered analysis"}
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
