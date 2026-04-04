"use client"

import { useState } from "react"
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock,
  Eye,
  FileCode,
  FileText,
  Filter,
  Info,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"

import { DragDropZone } from "@/components/drag-drop-zone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

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
  const [showSourcePreview, setShowSourcePreview] = useState(true)
  const [executionMode, setExecutionMode] = useState<string | null>(null)

  async function handleSelectedFiles(files: File[]) {
    const file = files[0]
    setSelectedFile(file)
    if (!file) return setSourceCode("")
    try {
      setSourceCode(await file.text())
    } catch {
      setSourceCode("")
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return alert("Please select a file first")
    try {
      const formData = new FormData()
      formData.append("apiFile", selectedFile)
      formData.append("description", description)
      const response = await fetch("/api/apis", { method: "POST", body: formData })
      if (!response.ok) {
        const error = await response.json()
        return alert(`Upload failed: ${error.error}`)
      }
      const result = await response.json()
      setUploadedApi({
        id: result.apiId,
        name: selectedFile.name.replace(/\.[^/.]+$/, ""),
        description,
        filePath: "",
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        testCases: [],
        status: "uploaded",
        createdAt: new Date().toISOString(),
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        content: sourceCode,
      })
      setExecutionMode(null)
      alert("API uploaded successfully!")
    } catch {
      alert("Upload failed. Please try again.")
    }
  }

  const handleGenerateTests = async () => {
    if (!uploadedApi) return alert("Please upload an API first")
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
        return alert(`Test generation failed: ${error.error}`)
      }
      const result = await response.json()
      setUploadedApi((prev) =>
        prev
          ? { ...prev, testCases: result.testCases, status: "testing", totalTests: result.testCases.length, passedTests: 0, failedTests: 0 }
          : null,
      )
      setExpandedTest(result.testCases[0]?.id || null)
    } catch {
      alert("Test generation failed. Please try again.")
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }

  const handleExecuteTests = async (testIds?: string[]) => {
    if (!uploadedApi || uploadedApi.testCases.length === 0) return alert("No tests to execute")
    setIsExecuting(true)
    setExecutionProgress(0)
    try {
      const progressInterval = setInterval(() => {
        setExecutionProgress((prev) => (prev >= 90 ? 90 : prev + 5))
      }, 100)
      const response = await fetch("/api/apis/execute-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiId: uploadedApi.id,
          testIds: testIds?.length ? testIds : uploadedApi.testCases.map((test) => test.id),
        }),
      })
      clearInterval(progressInterval)
      setExecutionProgress(100)
      if (!response.ok) {
        const error = await response.json()
        return alert(`Test execution failed: ${error.error}`)
      }
      const result = await response.json()
      setUploadedApi((prev) =>
        prev
          ? {
              ...prev,
              testCases: prev.testCases.map((test) => result.results.find((item: TestCase) => item.id === test.id) || test),
              status: "completed",
              passedTests: result.summary.passed,
              failedTests: result.summary.failed,
              lastTested: new Date().toISOString(),
            }
          : null,
      )
      setExecutionMode(result.mode || null)
    } catch {
      alert("Test execution failed. Please try again.")
    } finally {
      setIsExecuting(false)
      setExecutionProgress(0)
    }
  }

  const handleRunFailedOnly = async () => {
    if (!uploadedApi) return
    const failedIds = uploadedApi.testCases.filter((test) => test.status === "failed").map((test) => test.id)
    if (!failedIds.length) return alert("There are no failed tests to rerun.")
    await handleExecuteTests(failedIds)
  }

  async function handleSuggestionFeedback(testId: string, value: "up" | "down") {
    setFeedbackGiven((current) => ({ ...current, [testId]: true }))
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, value }),
    })
  }

  function handleCopyAnalysis(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

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
    setTimeout(() => setExported(false), 1500)
  }

  function cleanMarkdown(text: string) {
    return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`/g, "")
  }

  function renderSecurityAnalysis(text: string) {
    const iconFor = (line: string) => {
      if (/critical/i.test(line)) return <AlertOctagon className="mr-2 mt-0.5 h-4 w-4 text-error" />
      if (/\bhigh\b/i.test(line)) return <AlertTriangle className="mr-2 mt-0.5 h-4 w-4 text-warning" />
      if (/medium/i.test(line)) return <AlertCircle className="mr-2 mt-0.5 h-4 w-4 text-orange-500" />
      if (/(low|info)/i.test(line)) return <Info className="mr-2 mt-0.5 h-4 w-4 text-info" />
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
      }
    } finally {
      setReanalyzing(false)
    }
  }

  const filteredTests = uploadedApi?.testCases.filter((test) => (testStatusFilter === "all" || test.status === testStatusFilter) && (categoryFilter === "all" || test.category === categoryFilter)) || []

  const statusClass = (status: string) =>
    status === "passed"
      ? "bg-success/10 text-success hover:bg-success/10"
      : status === "failed"
        ? "bg-error/10 text-error hover:bg-error/10"
        : status === "running"
          ? "bg-warning/10 text-warning hover:bg-warning/10"
          : "bg-muted text-muted-foreground hover:bg-muted"

  const priorityClass = (priority: TestPriority) =>
    priority === "high" ? "bg-error/10 text-error hover:bg-error/10" : priority === "medium" ? "bg-warning/10 text-warning hover:bg-warning/10" : "bg-info/10 text-info hover:bg-info/10"

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <Badge variant="outline" className="mb-4 rounded-full border-border/70 bg-background px-3 py-1">API validation workspace</Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Upload source, inspect code, and validate clearer contract coverage</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">The workflow keeps the uploaded code visible, groups core actions together, and makes structured test output easier to scan and trust.</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-gradient-to-br from-background to-surface-secondary shadow-sm">
          <CardContent className="grid gap-4 p-6 md:p-8">
            <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
              <p className="text-sm font-medium text-muted-foreground">Selected file</p>
              <p className="mt-2 break-all text-sm font-semibold">{selectedFile ? `${selectedFile.name} • ${(selectedFile.size / 1024).toFixed(1)} KB` : "No file selected"}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/60 bg-background/80 p-5"><p className="text-sm text-muted-foreground">Generated tests</p><p className="mt-2 text-2xl font-semibold">{uploadedApi?.totalTests ?? 0}</p></div>
              <div className="rounded-3xl border border-border/60 bg-background/80 p-5"><p className="text-sm text-muted-foreground">Execution mode</p><p className="mt-2 text-sm font-semibold">{executionMode || "Not run yet"}</p></div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-surface/80 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl font-semibold"><Upload className="h-5 w-5" />Upload source</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <DragDropZone acceptedTypes=".js,.ts,.py,.json,.yaml,.yml" description="Upload API files (JS, TS, Python, OpenAPI, or Swagger)" onFileSelect={handleSelectedFiles} />
              {selectedFile ? (
                <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center gap-3"><div className="rounded-2xl bg-primary/10 p-2.5"><FileCode className="h-4 w-4 text-primary" /></div><div><div className="font-medium">{selectedFile.name}</div><div className="text-sm text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB ready for analysis</div></div></div>
                  <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setSelectedFile(null); setSourceCode("") }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ) : null}
              <Button onClick={handleFileUpload} disabled={!selectedFile} className="w-full rounded-full"><Upload className="mr-2 h-4 w-4" />Upload API</Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-surface/80 shadow-sm">
            <CardHeader><CardTitle className="text-xl font-semibold">Testing context</CardTitle></CardHeader>
            <CardContent><Textarea placeholder="Describe expected routes, auth requirements, validation rules, seed data, or coverage goals..." className="min-h-[140px] rounded-3xl border-border/70 bg-background/80" value={description} onChange={(event) => setDescription(event.target.value)} /></CardContent>
          </Card>

          <Card className="border-border/70 bg-surface/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-xl font-semibold"><Eye className="h-5 w-5" />Uploaded source</CardTitle><Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowSourcePreview((value) => !value)}>{showSourcePreview ? "Hide code" : "Show code"}</Button></CardHeader>
            <CardContent>
              {showSourcePreview ? (
                sourceCode ? <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-3xl border border-border/70 bg-background/90 p-4 text-xs leading-6 text-muted-foreground">{sourceCode}</pre> : <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 py-10 text-center text-sm text-muted-foreground">Upload a file to inspect the source here.</div>
              ) : <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 py-10 text-center text-sm text-muted-foreground">Source preview is collapsed.</div>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70 bg-surface/80 shadow-sm">
            <CardHeader><CardTitle className="text-xl font-semibold">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={handleGenerateTests} disabled={isGenerating || !uploadedApi} className="rounded-full">{isGenerating ? <><Clock className="mr-2 h-4 w-4 animate-spin" />Generating</> : <><Sparkles className="mr-2 h-4 w-4" />Generate tests</>}</Button>
                <Button onClick={() => handleExecuteTests()} disabled={isExecuting || !uploadedApi || uploadedApi.testCases.length === 0} variant="outline" className="rounded-full border-border/70 bg-background/80">{isExecuting ? <><Clock className="mr-2 h-4 w-4 animate-spin" />Validating</> : <><Play className="mr-2 h-4 w-4" />Run all checks</>}</Button>
              </div>
              {uploadedApi?.testCases.length ? <div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" className="rounded-full border-border/70 bg-background/80" onClick={handleRunFailedOnly} disabled={isExecuting}><RotateCcw className="mr-2 h-4 w-4" />Rerun failed</Button><Button variant="outline" className="rounded-full border-border/70 bg-background/80" onClick={() => handleExecuteTests(filteredTests.map((test) => test.id))} disabled={isExecuting || filteredTests.length === 0}><Filter className="mr-2 h-4 w-4" />Run filtered set</Button></div> : null}
              {uploadedApi ? <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-3xl border border-border/60 bg-background/80 p-4"><p className="text-sm text-muted-foreground">Workspace status</p><p className="mt-2 text-lg font-semibold capitalize">{uploadedApi.status}</p></div><div className="rounded-3xl border border-border/60 bg-background/80 p-4"><p className="text-sm text-muted-foreground">Uploaded file</p><p className="mt-2 break-all text-sm font-semibold">{uploadedApi.fileName}</p></div></div> : null}
            </CardContent>
          </Card>

          {isGenerating ? <Card className="border-border/70 bg-surface/80 shadow-sm"><CardHeader><CardTitle className="text-xl font-semibold">Generating structured test cases</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between text-sm"><span>Parsing routes and coverage goals...</span><span>{generationProgress}%</span></div><Progress value={generationProgress} /><p className="text-sm leading-6 text-muted-foreground">The generator is turning your uploaded source into structured, reviewable contract tests instead of opaque code.</p></CardContent></Card> : null}
          {isExecuting ? <Card className="border-border/70 bg-surface/80 shadow-sm"><CardHeader><CardTitle className="text-xl font-semibold">Validating generated contracts</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between text-sm"><span>Checking generated tests against inferred API routes...</span><span>{executionProgress}%</span></div><Progress value={executionProgress} /><p className="text-sm leading-6 text-muted-foreground">Current execution uses static contract validation derived from the uploaded source.</p></CardContent></Card> : null}

          {uploadedApi?.securityAnalysis ? (
            <Card className="border-border/70 bg-surface/80 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-xl font-semibold"><Shield className="h-5 w-5 text-info" />Security analysis<Button size="icon" variant="ghost" className="ml-auto rounded-full" onClick={() => handleCopyAnalysis(uploadedApi.securityAnalysis!)}>{copied ? <Check className="h-4 w-4 text-success" /> : <Clipboard className="h-4 w-4" />}</Button><Button size="icon" variant="ghost" className="rounded-full" onClick={() => handleExportMarkdown(uploadedApi.securityAnalysis!)}>{exported ? <Check className="h-4 w-4 text-success" /> : <FileText className="h-4 w-4" />}</Button><Button size="icon" variant="ghost" className="rounded-full" onClick={handleReanalyze} disabled={reanalyzing}><RefreshCw className={`h-4 w-4 ${reanalyzing ? "animate-spin" : ""}`} /></Button></CardTitle></CardHeader>
              <CardContent><div className="rounded-3xl border border-border/70 bg-background/80 p-4">{renderSecurityAnalysis(cleanMarkdown(uploadedApi.securityAnalysis))}</div></CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      {uploadedApi?.testCases.length ? (
        <>
          <Card className="border-border/70 bg-surface/80 shadow-sm">
            <CardHeader><CardTitle className="text-xl font-semibold">Validation summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-border/60 bg-background/80 p-5 text-center"><div className="text-3xl font-semibold text-success">{uploadedApi.passedTests}</div><div className="mt-1 text-sm text-muted-foreground">Passed</div></div>
                <div className="rounded-3xl border border-border/60 bg-background/80 p-5 text-center"><div className="text-3xl font-semibold text-error">{uploadedApi.failedTests}</div><div className="mt-1 text-sm text-muted-foreground">Failed</div></div>
                <div className="rounded-3xl border border-border/60 bg-background/80 p-5 text-center"><div className="text-3xl font-semibold">{uploadedApi.totalTests}</div><div className="mt-1 text-sm text-muted-foreground">Total</div></div>
              </div>
              {uploadedApi.lastTested ? <div className="text-center text-sm text-muted-foreground">Last checked: {new Date(uploadedApi.lastTested).toLocaleString()}</div> : null}
              {executionMode ? <div className="rounded-3xl border border-border/70 bg-background/80 p-4 text-sm leading-6 text-muted-foreground">This run used <span className="font-medium text-foreground">{executionMode}</span>, which validates the generated tests against the uploaded API contract and inferred routes.</div> : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-surface/80 shadow-sm">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <CardTitle className="text-xl font-semibold">Generated test cases</CardTitle>
                <div className="flex flex-wrap gap-2">{CATEGORY_OPTIONS.map((option) => <Button key={option.value} variant={categoryFilter === option.value ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setCategoryFilter(option.value)}>{option.label}</Button>)}</div>
              </div>
              <div className="flex flex-wrap gap-2">{STATUS_OPTIONS.map((option) => <Button key={option.value} variant={testStatusFilter === option.value ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setTestStatusFilter(option.value)}>{option.label}</Button>)}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredTests.map((test) => (
                <div key={test.id} className="overflow-hidden rounded-3xl border border-border/70 bg-background/80 shadow-sm">
                  <div className="cursor-pointer p-5 transition-colors hover:bg-surface/70" onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {expandedTest === test.id ? <ChevronDown className="mt-1 h-4 w-4" /> : <ChevronRight className="mt-1 h-4 w-4" />}
                        <div className="space-y-3">
                          <div><div className="font-medium">{test.name}</div><div className="text-sm text-muted-foreground">{test.description}</div></div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">{test.method}</Badge>
                            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">{test.path}</Badge>
                            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">Expected {test.expectedStatus}</Badge>
                            <Badge className={`rounded-full ${priorityClass(test.priority)}`}>{test.priority} priority</Badge>
                            <Badge variant="secondary" className="rounded-full">{test.category}</Badge>
                          </div>
                        </div>
                      </div>
                      <Badge className={`rounded-full ${statusClass(test.status)}`}>{test.status === "passed" ? <CheckCircle className="mr-1 h-3 w-3" /> : test.status === "failed" ? <XCircle className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}{test.status}</Badge>
                    </div>
                  </div>
                  {expandedTest === test.id ? (
                    <div className="space-y-5 border-t border-border/70 bg-surface/60 px-5 py-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div><div className="mb-2 text-sm font-medium">Headers</div><pre className="overflow-x-auto rounded-2xl border border-border/70 bg-background/90 p-3 text-xs">{JSON.stringify(test.headers || {}, null, 2)}</pre></div>
                        <div><div className="mb-2 text-sm font-medium">Body / Query</div><pre className="overflow-x-auto rounded-2xl border border-border/70 bg-background/90 p-3 text-xs">{JSON.stringify({ query: test.query || {}, body: test.body || null }, null, 2)}</pre></div>
                      </div>
                      {test.expectedBodyShape?.length ? <div><div className="mb-2 text-sm font-medium">Expected body shape</div><div className="flex flex-wrap gap-2">{test.expectedBodyShape.map((field) => <Badge key={field} variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">{field}</Badge>)}</div></div> : null}
                      {test.assumptions?.length ? <div><div className="mb-2 text-sm font-medium">Assumptions</div><ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{test.assumptions.map((assumption, index) => <li key={`${test.id}-${index}`}>{assumption}</li>)}</ul></div> : null}
                      <div><div className="mb-2 text-sm font-medium">Generated preview</div><pre className="overflow-x-auto rounded-2xl border border-border/70 bg-background/90 p-3 text-xs text-muted-foreground">{test.testCode}</pre></div>
                      {test.result ? <div><div className="mb-2 text-sm font-medium">Validation result</div><div className="rounded-2xl border border-border/70 bg-background/90 p-3 text-sm whitespace-pre-line text-muted-foreground">{test.result}</div></div> : null}
                      {test.error ? <div><div className="mb-2 text-sm font-medium text-error">Issue found</div><div className="rounded-2xl border border-error/30 bg-error/10 p-3 text-sm text-error">{test.error}</div></div> : null}
                      {test.suggestion ? <div><div className="mb-2 text-sm font-medium text-info">Suggested next step</div><div className="rounded-2xl border border-info/30 bg-info/10 p-3 text-sm whitespace-pre-line text-info">{test.suggestion}</div>{!feedbackGiven[test.id] ? <div className="mt-3 flex items-center gap-2"><Button size="icon" variant="ghost" className="rounded-full" onClick={() => handleSuggestionFeedback(test.id, "up")}><ThumbsUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="rounded-full" onClick={() => handleSuggestionFeedback(test.id, "down")}><ThumbsDown className="h-4 w-4" /></Button><span className="text-xs text-muted-foreground">Was this suggestion helpful?</span></div> : <div className="mt-3 flex items-center gap-1 text-xs text-success"><Check className="h-4 w-4" />Thank you for your feedback!</div>}</div> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-border/70 bg-surface/80 shadow-sm"><CardContent className="py-14 text-center"><FileCode className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><h3 className="text-lg font-medium">No structured tests yet</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Upload an API file, inspect the source, and generate structured test cases to start validating contract coverage.</p></CardContent></Card>
      )}
    </div>
  )
}
