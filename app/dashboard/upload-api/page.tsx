"use client"

import { useState, useCallback } from "react"
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle,
  Clipboard,
  Clock,
  FileCode,
  FileText,
  Filter,
  Info,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XCircle,
} from "lucide-react"

import { DragDropZone } from "@/components/drag-drop-zone"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { getTestStatusStyle, getTestPriorityStyle } from "@/lib/status-styles"

type TestStatus = "pending" | "passed" | "failed" | "running"
type TestCategory = "happy-path" | "validation" | "auth" | "security" | "edge-case"
type TestPriority = "high" | "medium" | "low"

interface TestCase {
  id: string
  name: string
  description: string
  testCode: string
  status: TestStatus
  result?: string
  error?: string
  suggestion?: string
  category: TestCategory
  priority: TestPriority
  method: string
  path: string
  expectedStatus: number
  expectedBodyShape?: string[]
  assumptions?: string[]
  headers?: Record<string, string>
  query?: Record<string, string>
  body?: Record<string, unknown> | null
}

interface ApiData {
  id: string
  name: string
  description?: string
  filePath: string
  fileName: string
  fileSize: number
  testCases: TestCase[]
  status: "uploaded" | "testing" | "completed"
  createdAt: string
  lastTested?: string
  totalTests: number
  passedTests: number
  failedTests: number
  securityAnalysis?: string
  content: string
}

const CATEGORY_OPTIONS: Array<{ label: string; value: TestCategory | "all" }> = [
  { label: "All", value: "all" },
  { label: "Happy Path", value: "happy-path" },
  { label: "Validation", value: "validation" },
  { label: "Auth", value: "auth" },
  { label: "Security", value: "security" },
  { label: "Edge", value: "edge-case" },
]

const STATUS_OPTIONS: Array<{ label: string; value: TestStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Passed", value: "passed" },
  { label: "Failed", value: "failed" },
]

export default function UploadAPIPage() {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [expandedTest, setExpandedTest] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sourceCode, setSourceCode] = useState("")
  const [description, setDescription] = useState("")
  const [uploadedApi, setUploadedApi] = useState<ApiData | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [exported, setExported] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({})
  const [reanalyzing, setReanalyzing] = useState(false)
  const [testStatusFilter, setTestStatusFilter] = useState<TestStatus | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<TestCategory | "all">("all")
  const [executionMode, setExecutionMode] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  /**
   * Uploads a file to the backend and reads its source content
   * @param {File} file - The selected file to upload
   */
  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const text = await file.text()
      setSourceCode(text)

      const formData = new FormData()
      formData.append("apiFile", file)
      formData.append("description", description)
      const response = await fetch("/api/apis", { method: "POST", body: formData })

      if (!response.ok) {
        const error = await response.json()
        toast({
          title: "Upload failed",
          description: error.error || "The API file could not be uploaded.",
          variant: "destructive",
        })
        return
      }

      const result = await response.json()
      setUploadedApi({
        id: result.apiId,
        name: file.name.replace(/\.[^/.]+$/, ""),
        description,
        filePath: "",
        fileName: file.name,
        fileSize: file.size,
        testCases: [],
        status: "uploaded",
        createdAt: new Date().toISOString(),
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        content: text,
      })
      setExecutionMode(null)
      toast({
        title: "API uploaded",
        description: `${file.name} is ready for test generation.`,
      })
    } catch {
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }, [description, toast])

  /**
   * Handles file selection from drag-drop zone and auto-uploads
   * @param {File[]} files - Array of selected files
   */
  async function handleSelectedFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    setSelectedFile(file)
    await uploadFile(file)
  }

  /**
   * Clears the current file and resets the workspace
   */
  function handleClearFile() {
    setSelectedFile(null)
    setSourceCode("")
    setUploadedApi(null)
    setExecutionMode(null)
  }

  /**
   * Generates structured test cases from the uploaded API source
   */
  const handleGenerateTests = async () => {
    if (!uploadedApi) {
      toast({ title: "Upload an API first", description: "Add a source file before generating tests.", variant: "destructive" })
      return
    }
    setIsGenerating(true)
    setGenerationProgress(0)
    try {
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => (prev >= 90 ? 90 : prev + 10))
      }, 200)
      const response = await fetch("/api/apis/generate-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: uploadedApi.id }),
      })
      clearInterval(progressInterval)
      setGenerationProgress(100)
      if (!response.ok) {
        const error = await response.json()
        toast({ title: "Generation failed", description: error.error || "Structured tests could not be generated.", variant: "destructive" })
        return
      }
      const result = await response.json()
      setUploadedApi((prev) =>
        prev ? { ...prev, testCases: result.testCases, status: "testing", totalTests: result.testCases.length, passedTests: 0, failedTests: 0 } : null,
      )
      setExpandedTest(result.testCases[0]?.id || null)
      toast({ title: "Tests generated", description: `${result.testCases.length} structured checks are ready to review.` })
    } catch {
      toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" })
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }

  /**
   * Executes test cases against the uploaded API
   * @param {string[]} [testIds] - Optional subset of test IDs to run
   */
  const handleExecuteTests = async (testIds?: string[]) => {
    if (!uploadedApi || uploadedApi.testCases.length === 0) {
      toast({ title: "No tests to run", description: "Generate tests before starting validation.", variant: "destructive" })
      return
    }
    setIsExecuting(true)
    setExecutionProgress(0)
    try {
      const progressInterval = setInterval(() => {
        setExecutionProgress((prev) => (prev >= 90 ? 90 : prev + 5))
      }, 100)
      const response = await fetch("/api/apis/execute-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: uploadedApi.id, testIds: testIds?.length ? testIds : uploadedApi.testCases.map((t) => t.id) }),
      })
      clearInterval(progressInterval)
      setExecutionProgress(100)
      if (!response.ok) {
        const error = await response.json()
        toast({ title: "Validation failed", description: error.error || "The generated tests could not be validated.", variant: "destructive" })
        return
      }
      const result = await response.json()
      setUploadedApi((prev) =>
        prev
          ? {
              ...prev,
              testCases: prev.testCases.map((t) => result.results.find((item: TestCase) => item.id === t.id) || t),
              status: "completed",
              passedTests: result.summary.passed,
              failedTests: result.summary.failed,
              lastTested: new Date().toISOString(),
            }
          : null,
      )
      setExecutionMode(result.mode || null)
      toast({ title: "Validation completed", description: `${result.summary.passed} passed, ${result.summary.failed} failed.` })
    } catch {
      toast({ title: "Validation failed", description: "Please try again.", variant: "destructive" })
    } finally {
      setIsExecuting(false)
      setExecutionProgress(0)
    }
  }

  /**
   * Reruns only the failed test cases
   */
  const handleRunFailedOnly = async () => {
    if (!uploadedApi) return
    const failedIds = uploadedApi.testCases.filter((t) => t.status === "failed").map((t) => t.id)
    if (!failedIds.length) {
      toast({ title: "Nothing to rerun", description: "There are no failed tests right now." })
      return
    }
    await handleExecuteTests(failedIds)
  }

  /**
   * Sends thumbs up/down feedback on a test suggestion
   * @param {string} testId - Test case ID
   * @param {"up"|"down"} value - Feedback direction
   */
  async function handleSuggestionFeedback(testId: string, value: "up" | "down") {
    setFeedbackGiven((current) => ({ ...current, [testId]: true }))
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, value }),
    })
  }

  /**
   * Copies security analysis text to clipboard
   * @param {string} text - Analysis text to copy
   */
  function handleCopyAnalysis(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({ title: "Analysis copied", description: "Security findings were copied to the clipboard." })
    setTimeout(() => setCopied(false), 1500)
  }

  /**
   * Exports security analysis as a downloadable Markdown file
   * @param {string} text - Analysis text to export
   */
  function handleExportMarkdown(text: string) {
    const blob = new Blob([text], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "security-analysis.md"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    setExported(true)
    toast({ title: "Markdown exported", description: "Security findings were downloaded as Markdown." })
    setTimeout(() => setExported(false), 1500)
  }

  /**
   * Strips markdown bold and backtick formatting from text
   * @param {string} text - Raw markdown text
   * @returns {string} Cleaned plain text
   */
  function cleanMarkdown(text: string) {
    return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`/g, "")
  }

  /**
   * Renders security analysis text with severity-level icons
   * @param {string} text - Cleaned analysis text
   * @returns {JSX.Element} Rendered analysis block
   */
  function renderSecurityAnalysis(text: string) {
    const iconFor = (line: string) => {
      if (/critical/i.test(line)) return <AlertOctagon className="mr-2 mt-0.5 icon-sm text-error" />
      if (/\bhigh\b/i.test(line)) return <AlertTriangle className="mr-2 mt-0.5 icon-sm text-warning" />
      if (/medium/i.test(line)) return <AlertCircle className="mr-2 mt-0.5 icon-sm text-warning" />
      if (/(low|info)/i.test(line)) return <Info className="mr-2 mt-0.5 icon-sm text-info" />
      return null
    }
    return (
      <div className="space-y-3">
        {text.split(/\n\s*\n/).map((block, index) => (
          <div key={index} className="space-y-2">
            {block.split("\n").filter(Boolean).map((line, lineIndex) => (
              <div key={lineIndex} className="flex items-start text-sm">
                {iconFor(line)}
                <span>{line.replace(/^[-*]\s+/, "")}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  /**
   * Reruns the security analysis for the current API
   */
  async function handleReanalyze() {
    if (!uploadedApi) return
    setReanalyzing(true)
    try {
      const response = await fetch("/api/apis/security-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: uploadedApi.id }),
      })
      const data = await response.json()
      if (data.success && data.securityAnalysis) {
        setUploadedApi((prev) => (prev ? { ...prev, securityAnalysis: data.securityAnalysis } : prev))
        toast({ title: "Analysis updated", description: "Latest security findings are ready." })
      }
    } finally {
      setReanalyzing(false)
    }
  }

  const filteredTests =
    uploadedApi?.testCases.filter(
      (t) => (testStatusFilter === "all" || t.status === testStatusFilter) && (categoryFilter === "all" || t.category === categoryFilter),
    ) || []

  return (
    <div className="space-y-6">
      {/* ── Compact header ── */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem]">Validate API contracts</h1>
          <p className="text-sm text-muted-foreground">
            Upload source, generate checks, and review outcomes.
          </p>
        </div>
        {uploadedApi && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 rounded-full border border-border/60 bg-surface/80 px-4 py-2 text-sm">
              <span className="text-muted-foreground">{uploadedApi.totalTests} tests</span>
              <span className="font-medium text-success">{uploadedApi.passedTests} passed</span>
              {uploadedApi.failedTests > 0 && <span className="font-medium text-error">{uploadedApi.failedTests} failed</span>}
            </div>
            <Badge variant="secondary" className="rounded-full capitalize">{uploadedApi.status}</Badge>
          </div>
        )}
      </section>

      {/* ── Upload + Source side-by-side ── */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* Left: Upload zone + description */}
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <DragDropZone
              acceptedTypes=".js,.ts,.py,.json,.yaml,.yml"
              description="Drop an API file or click to browse"
              onFileSelect={handleSelectedFiles}
            />

            {selectedFile && (
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2">
                    <FileCode className="icon-sm text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                      {uploading ? " · Uploading..." : " · Uploaded"}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={handleClearFile}>
                  <Trash2 className="icon-sm" />
                </Button>
              </div>
            )}

            <Textarea
              placeholder="Optional notes: expected routes, auth requirements, coverage goals..."
              className="min-h-[100px] rounded-2xl border-border/70 bg-background/80"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Right: Source code preview */}
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Source preview</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceCode ? (
              <ScrollArea className="h-[16rem] rounded-2xl border border-border/70 bg-background/90">
                <pre className="whitespace-pre-wrap p-4 text-xs leading-6 text-muted-foreground">{sourceCode}</pre>
              </ScrollArea>
            ) : (
              <div className="flex h-[16rem] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/70 text-sm text-muted-foreground">
                Upload a file to see source here.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Actions row ── */}
      <section className="flex flex-wrap items-center gap-3">
        <Button onClick={handleGenerateTests} disabled={isGenerating || !uploadedApi} className="rounded-full">
          {isGenerating ? <><Clock className="mr-2 icon-sm animate-spin" />Generating</> : <><Sparkles className="mr-2 icon-sm" />Generate tests</>}
        </Button>
        <Button onClick={() => handleExecuteTests()} disabled={isExecuting || !uploadedApi || uploadedApi.testCases.length === 0} variant="outline" className="rounded-full border-border/70 bg-background/80">
          {isExecuting ? <><Clock className="mr-2 icon-sm animate-spin" />Validating</> : <><Play className="mr-2 icon-sm" />Run all checks</>}
        </Button>
        {uploadedApi && uploadedApi.testCases.length > 0 && (
          <>
            <Button variant="outline" className="rounded-full border-border/70 bg-background/80" onClick={handleRunFailedOnly} disabled={isExecuting}>
              <RotateCcw className="mr-2 icon-sm" />Rerun failed
            </Button>
            <Button variant="outline" className="rounded-full border-border/70 bg-background/80" onClick={() => handleExecuteTests(filteredTests.map((t) => t.id))} disabled={isExecuting || filteredTests.length === 0}>
              <Filter className="mr-2 icon-sm" />Run filtered
            </Button>
          </>
        )}
      </section>

      {/* ── Progress indicators ── */}
      {isGenerating && (
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between text-sm">
              <span>Parsing routes...</span>
              <span>{generationProgress}%</span>
            </div>
            <Progress value={generationProgress} />
          </CardContent>
        </Card>
      )}

      {isExecuting && (
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between text-sm">
              <span>Validating contracts...</span>
              <span>{executionProgress}%</span>
            </div>
            <Progress value={executionProgress} />
          </CardContent>
        </Card>
      )}

      {/* ── Security analysis (fixed-height scroll) ── */}
      {uploadedApi?.securityAnalysis && (
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Security analysis</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleCopyAnalysis(uploadedApi.securityAnalysis!)}>
                {copied ? <Check className="mr-1.5 icon-xs text-success" /> : <Clipboard className="mr-1.5 icon-xs" />}
                Copy
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => handleExportMarkdown(uploadedApi.securityAnalysis!)}>
                {exported ? <Check className="mr-1.5 icon-xs text-success" /> : <FileText className="mr-1.5 icon-xs" />}
                Export
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={handleReanalyze} disabled={reanalyzing}>
                <RefreshCw className={`mr-1.5 icon-xs ${reanalyzing ? "animate-spin" : ""}`} />
                Re-run
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[18rem] rounded-2xl border border-border/70 bg-background/80">
              <div className="p-4">{renderSecurityAnalysis(cleanMarkdown(uploadedApi.securityAnalysis))}</div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ── Validation summary ── */}
      {uploadedApi && uploadedApi.testCases.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 text-center">
            <div className="text-3xl font-semibold text-success">{uploadedApi.passedTests}</div>
            <div className="mt-1 text-sm text-muted-foreground">Passed</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 text-center">
            <div className="text-3xl font-semibold text-error">{uploadedApi.failedTests}</div>
            <div className="mt-1 text-sm text-muted-foreground">Failed</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 text-center">
            <div className="text-3xl font-semibold">{uploadedApi.totalTests}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total</div>
          </div>
        </section>
      )}

      {/* ── Test cases with filters + fixed-height scroll ── */}
      {uploadedApi && uploadedApi.testCases.length > 0 ? (
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <CardTitle className="text-base font-medium">Generated test cases</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.map((opt) => (
                  <Button key={opt.value} variant={categoryFilter === opt.value ? "default" : "outline"} size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setCategoryFilter(opt.value)}>
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <Button key={opt.value} variant={testStatusFilter === opt.value ? "default" : "outline"} size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setTestStatusFilter(opt.value)}>
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {filteredTests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 py-10 text-center text-sm text-muted-foreground">
                No test cases match the current filters.
              </div>
            ) : (
              <ScrollArea className="h-[36rem]">
                <div className="space-y-3 pr-4">
                  {filteredTests.map((test) => {
                    const isOpen = expandedTest === test.id
                    return (
                      <div key={test.id} className="overflow-hidden rounded-2xl border border-border/70 bg-background/80 shadow-sm">
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-secondary/50"
                          onClick={() => setExpandedTest(isOpen ? null : test.id)}
                        >
                          <div className="space-y-2">
                            <p className="text-sm font-medium">{test.name}</p>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[10px]">{test.method}</Badge>
                              <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[10px]">{test.path}</Badge>
                              <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[10px]">Expected {test.expectedStatus}</Badge>
                              <Badge className={`rounded-full px-2 py-0.5 text-[10px] ${getTestPriorityStyle(test.priority)}`}>{test.priority}</Badge>
                              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">{test.category}</Badge>
                            </div>
                          </div>
                          <Badge className={`shrink-0 rounded-full ${getTestStatusStyle(test.status)}`}>
                            {test.status === "passed" ? <CheckCircle className="mr-1 icon-xs" /> : test.status === "failed" ? <XCircle className="mr-1 icon-xs" /> : <Clock className="mr-1 icon-xs" />}
                            {test.status}
                          </Badge>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border/60 px-5 pb-5 pt-4">
                            <ScrollArea className="h-[20rem]">
                              <div className="space-y-4 pr-4">
                                <p className="text-sm text-muted-foreground">{test.description}</p>

                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium">Headers</p>
                                    <pre className="overflow-x-auto rounded-xl border border-border/70 bg-background/90 p-3 text-xs">{JSON.stringify(test.headers || {}, null, 2)}</pre>
                                  </div>
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium">Body / Query</p>
                                    <pre className="overflow-x-auto rounded-xl border border-border/70 bg-background/90 p-3 text-xs">{JSON.stringify({ query: test.query || {}, body: test.body || null }, null, 2)}</pre>
                                  </div>
                                </div>

                                {test.expectedBodyShape?.length ? (
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium">Expected body shape</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {test.expectedBodyShape.map((field) => (
                                        <Badge key={field} variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[10px]">{field}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {test.assumptions?.length ? (
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium">Assumptions</p>
                                    <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                      {test.assumptions.map((a, i) => <li key={`${test.id}-${i}`}>{a}</li>)}
                                    </ul>
                                  </div>
                                ) : null}

                                <div>
                                  <p className="mb-1.5 text-xs font-medium">Generated preview</p>
                                  <pre className="overflow-x-auto rounded-xl border border-border/70 bg-background/90 p-3 text-xs text-muted-foreground">{test.testCode}</pre>
                                </div>

                                {test.result && (
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium">Validation result</p>
                                    <div className="whitespace-pre-line rounded-xl border border-border/70 bg-background/90 p-3 text-xs text-muted-foreground">{test.result}</div>
                                  </div>
                                )}

                                {test.error && (
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium text-error">Issue found</p>
                                    <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error">{test.error}</div>
                                  </div>
                                )}

                                {test.suggestion && (
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium text-info">Suggested next step</p>
                                    <div className="whitespace-pre-line rounded-xl border border-info/30 bg-info/10 p-3 text-xs text-info">{test.suggestion}</div>
                                    {!feedbackGiven[test.id] ? (
                                      <div className="mt-2 flex items-center gap-2">
                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => handleSuggestionFeedback(test.id, "up")}><ThumbsUp className="icon-xs" /></Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => handleSuggestionFeedback(test.id, "down")}><ThumbsDown className="icon-xs" /></Button>
                                        <span className="text-[10px] text-muted-foreground">Helpful?</span>
                                      </div>
                                    ) : (
                                      <div className="mt-2 flex items-center gap-1 text-[10px] text-success"><Check className="icon-xs" />Thanks for the feedback!</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      ) : !uploadedApi ? (
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="py-14 text-center">
            <FileCode className="mx-auto mb-4 icon-lg text-muted-foreground" />
            <h3 className="text-lg font-medium">No structured tests yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Upload an API file to start validating contract coverage.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Execution mode footnote ── */}
      {executionMode && uploadedApi?.lastTested && (
        <div className="text-center text-xs text-muted-foreground">
          Last checked {new Date(uploadedApi.lastTested).toLocaleString()} using <span className="font-medium text-foreground">{executionMode}</span>
        </div>
      )}
    </div>
  )
}
