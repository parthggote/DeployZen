"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
  FileCode,
  Trash2,
  Shield,
  Clipboard,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Check,
  RefreshCw,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Info,
  Filter,
  RotateCcw,
  Eye,
  Sparkles,
} from "lucide-react"
import { DragDropZone } from "@/components/drag-drop-zone"

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
  executionTime?: number
  timestamp?: string
  suggestion?: string
  category: TestCategory
  priority: TestPriority
  method: string
  path: string
  expectedStatus: number
  expectedBodyShape?: string[]
  tags?: string[]
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
  const [feedbackGiven, setFeedbackGiven] = useState<{ [testId: string]: boolean }>({})
  const [reanalyzing, setReanalyzing] = useState(false)
  const [testStatusFilter, setTestStatusFilter] = useState<TestStatus | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<TestCategory | "all">("all")
  const [showSourcePreview, setShowSourcePreview] = useState(true)
  const [executionMode, setExecutionMode] = useState<string | null>(null)

  async function handleSelectedFiles(files: File[]) {
    const file = files[0]
    setSelectedFile(file)
    if (!file) {
      setSourceCode("")
      return
    }
    try {
      setSourceCode(await file.text())
    } catch (error) {
      console.error("Failed to read selected file:", error)
      setSourceCode("")
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file first")
      return
    }

    try {
      const formData = new FormData()
      formData.append("apiFile", selectedFile)
      formData.append("description", description)

      const response = await fetch("/api/apis", { method: "POST", body: formData })

      if (!response.ok) {
        const error = await response.json()
        alert(`Upload failed: ${error.error}`)
        return
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
    } catch (error) {
      console.error("Upload error:", error)
      alert("Upload failed. Please try again.")
    }
  }

  const handleGenerateTests = async () => {
    if (!uploadedApi) {
      alert("Please upload an API first")
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
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
        alert(`Test generation failed: ${error.error}`)
        return
      }

      const result = await response.json()
      setUploadedApi((prev) => prev ? {
        ...prev,
        testCases: result.testCases,
        status: "testing",
        totalTests: result.testCases.length,
        passedTests: 0,
        failedTests: 0,
      } : null)
      setExpandedTest(result.testCases[0]?.id || null)
      alert(`Generated ${result.testCases.length} structured test cases!`)
    } catch (error) {
      console.error("Test generation error:", error)
      alert("Test generation failed. Please try again.")
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }

  const handleExecuteTests = async (testIds?: string[]) => {
    if (!uploadedApi || uploadedApi.testCases.length === 0) {
      alert("No tests to execute")
      return
    }

    setIsExecuting(true)
    setExecutionProgress(0)

    try {
      const progressInterval = setInterval(() => {
        setExecutionProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 5
        })
      }, 100)

      const response = await fetch("/api/apis/execute-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiId: uploadedApi.id,
          testIds: testIds && testIds.length > 0 ? testIds : uploadedApi.testCases.map((test) => test.id),
        }),
      })

      clearInterval(progressInterval)
      setExecutionProgress(100)

      if (!response.ok) {
        const error = await response.json()
        alert(`Test execution failed: ${error.error}`)
        return
      }

      const result = await response.json()
      setUploadedApi((prev) => prev ? {
        ...prev,
        testCases: prev.testCases.map((test) => result.results.find((item: TestCase) => item.id === test.id) || test),
        status: "completed",
        passedTests: result.summary.passed,
        failedTests: result.summary.failed,
        lastTested: new Date().toISOString(),
      } : null)
      setExecutionMode(result.mode || null)
      alert(`Validation completed! ${result.summary.passed} passed, ${result.summary.failed} failed`)
    } catch (error) {
      console.error("Test execution error:", error)
      alert("Test execution failed. Please try again.")
    } finally {
      setIsExecuting(false)
      setExecutionProgress(0)
    }
  }

  const handleRunFailedOnly = async () => {
    if (!uploadedApi) return
    const failedIds = uploadedApi.testCases.filter((test) => test.status === "failed").map((test) => test.id)
    if (failedIds.length === 0) {
      alert("There are no failed tests to rerun.")
      return
    }
    await handleExecuteTests(failedIds)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed": return "bg-success text-success-foreground"
      case "failed": return "bg-error text-error-foreground"
      case "running": return "bg-warning text-warning-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed": return <CheckCircle className="w-3 h-3 mr-1" />
      case "failed": return <XCircle className="w-3 h-3 mr-1" />
      default: return <Clock className="w-3 h-3 mr-1" />
    }
  }

  const getPriorityColor = (priority: TestPriority) => {
    switch (priority) {
      case "high": return "bg-error/10 text-error"
      case "medium": return "bg-warning/10 text-warning"
      default: return "bg-info/10 text-info"
    }
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

  function highlightSeverityLine(line: string) {
    let icon = null
    if (/critical/i.test(line)) icon = <AlertOctagon className="inline w-4 h-4 text-error mr-2" />
    else if (/\bhigh\b/i.test(line)) icon = <AlertTriangle className="inline w-4 h-4 text-warning mr-2" />
    else if (/medium/i.test(line)) icon = <AlertCircle className="inline w-4 h-4 text-orange-500 mr-2" />
    else if (/(low|info)/i.test(line)) icon = <Info className="inline w-4 h-4 text-info mr-2" />
    return (
      <div className="flex items-start text-foreground">
        {icon}
        <span className="whitespace-pre-wrap leading-relaxed">{line}</span>
      </div>
    )
  }

  function renderSecurityAnalysis(text: string) {
    const blocks = text.split(/\n\s*\n/)
    return (
      <div className="space-y-3">
        {blocks.map((block, index) => {
          const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
          const isList = lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line))
          if (!isList) {
            return (
              <div key={index} className="space-y-1">
                {lines.map((line, lineIndex) => <div key={lineIndex} className="text-sm">{highlightSeverityLine(line)}</div>)}
              </div>
            )
          }
          return (
            <ul key={index} className="list-disc pl-5 space-y-1">
              {lines.map((line, lineIndex) => <li key={lineIndex} className="text-sm">{highlightSeverityLine(line.replace(/^[-*]\s+/, ""))}</li>)}
            </ul>
          )
        })}
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
        setUploadedApi((prev) => prev ? { ...prev, securityAnalysis: data.securityAnalysis } : prev)
      }
    } finally {
      setReanalyzing(false)
    }
  }

  const filteredTests = uploadedApi?.testCases.filter((test) => {
    const matchesStatus = testStatusFilter === "all" || test.status === testStatusFilter
    const matchesCategory = categoryFilter === "all" || test.category === categoryFilter
    return matchesStatus && matchesCategory
  }) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload API</h1>
        <p className="text-muted-foreground">
          Upload your API source, inspect the code, generate structured contract tests, and validate them with clearer feedback.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                API Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DragDropZone
                acceptedTypes=".js,.ts,.py,.json,.yaml,.yml"
                description="Upload API files (JS, TS, Python, OpenAPI/Swagger)"
                onFileSelect={handleSelectedFiles}
              />

              {selectedFile && (
                <div className="p-3 bg-surface-secondary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileCode className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{selectedFile.name}</div>
                        <div className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedFile(null); setSourceCode("") }} className="h-8 w-8">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <Button onClick={handleFileUpload} disabled={!selectedFile} className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                Upload API
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Testing Context</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Describe expected routes, auth requirements, validation rules, sample data, or other testing goals..."
                className="min-h-[120px]"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Uploaded Source
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowSourcePreview((value) => !value)}>
                {showSourcePreview ? "Hide code" : "Show code"}
              </Button>
            </CardHeader>
            <CardContent>
              {showSourcePreview ? (
                sourceCode ? (
                  <pre className="max-h-[420px] overflow-auto rounded-lg border bg-surface p-4 text-xs leading-6 text-muted-foreground whitespace-pre-wrap">
                    {sourceCode}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground">Upload a file to inspect the source here.</div>
                )
              ) : (
                <div className="text-sm text-muted-foreground">Source preview collapsed.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={handleGenerateTests} disabled={isGenerating || !uploadedApi} className="w-full" size="lg">
              {isGenerating ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Structured Tests
                </>
              )}
            </Button>

            <Button
              onClick={() => handleExecuteTests()}
              disabled={isExecuting || !uploadedApi || uploadedApi.testCases.length === 0}
              className="w-full"
              size="lg"
              variant="outline"
            >
              {isExecuting ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run All Checks
                </>
              )}
            </Button>
          </div>

          {uploadedApi?.testCases.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleRunFailedOnly} disabled={isExecuting}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Rerun Failed
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExecuteTests(filteredTests.map((test) => test.id))}
                disabled={isExecuting || filteredTests.length === 0}
              >
                <Filter className="w-4 h-4 mr-2" />
                Run Filtered Set
              </Button>
            </div>
          ) : null}

          {isGenerating && (
            <Card>
              <CardHeader>
                <CardTitle>Generating Structured Test Cases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Parsing routes and coverage goals...</span>
                    <span>{generationProgress}%</span>
                  </div>
                  <Progress value={generationProgress} />
                </div>
                <div className="text-sm text-muted-foreground">
                  The generator is turning your uploaded source into structured, reviewable contract tests instead of opaque code blocks.
                </div>
              </CardContent>
            </Card>
          )}

          {isExecuting && (
            <Card>
              <CardHeader>
                <CardTitle>Validating Test Contracts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Checking generated tests against inferred API routes...</span>
                    <span>{executionProgress}%</span>
                  </div>
                  <Progress value={executionProgress} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Current execution uses static contract validation derived from the uploaded source.
                </div>
              </CardContent>
            </Card>
          )}

          {uploadedApi && (
            <Card>
              <CardHeader>
                <CardTitle>API Workspace Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">File</div>
                  <div className="font-medium break-all">{uploadedApi.fileName}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium capitalize">{uploadedApi.status}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Generated tests</div>
                  <div className="font-medium">{uploadedApi.totalTests}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Execution mode</div>
                  <div className="font-medium">{executionMode || "Not run yet"}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {uploadedApi?.securityAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-info" />
                  Security Analysis
                  <Button size="icon" variant="ghost" className="ml-2" title="Copy to clipboard" onClick={() => uploadedApi.securityAnalysis && handleCopyAnalysis(uploadedApi.securityAnalysis)}>
                    {copied ? <Check className="w-4 h-4 text-success" /> : <Clipboard className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="ml-1" title="Export as Markdown" onClick={() => uploadedApi.securityAnalysis && handleExportMarkdown(uploadedApi.securityAnalysis)}>
                    {exported ? <Check className="w-4 h-4 text-success" /> : <FileText className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="ml-1" title="Re-analyze security" onClick={handleReanalyze} disabled={reanalyzing}>
                    {reanalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-foreground">{renderSecurityAnalysis(cleanMarkdown(uploadedApi.securityAnalysis))}</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {uploadedApi?.testCases.length ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Validation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-success">{uploadedApi.passedTests}</div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-error">{uploadedApi.failedTests}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{uploadedApi.totalTests}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
              {uploadedApi.lastTested && (
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  Last checked: {new Date(uploadedApi.lastTested).toLocaleString()}
                </div>
              )}
              {executionMode && (
                <div className="mt-4 rounded-lg border bg-surface-secondary/40 p-3 text-sm text-muted-foreground">
                  This run used <span className="font-medium text-foreground">{executionMode}</span>, which validates the generated tests against the uploaded API contract and inferred routes.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Generated Test Cases</CardTitle>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={categoryFilter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoryFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={testStatusFilter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTestStatusFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredTests.map((test) => (
                  <div key={test.id} className="border rounded-lg">
                    <div
                      className="p-4 cursor-pointer hover:bg-surface-secondary/50 transition-colors"
                      onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start space-x-3">
                          {expandedTest === test.id ? (
                            <ChevronDown className="w-4 h-4 mt-1" />
                          ) : (
                            <ChevronRight className="w-4 h-4 mt-1" />
                          )}
                          <div className="space-y-2">
                            <div className="font-medium">{test.name}</div>
                            <div className="text-sm text-muted-foreground">{test.description}</div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{test.method}</Badge>
                              <Badge variant="outline">{test.path}</Badge>
                              <Badge variant="outline">Expected {test.expectedStatus}</Badge>
                              <Badge className={getPriorityColor(test.priority)}>{test.priority} priority</Badge>
                              <Badge variant="secondary">{test.category}</Badge>
                            </div>
                          </div>
                        </div>
                        <Badge className={getStatusColor(test.status)}>
                          {getStatusIcon(test.status)}
                          {test.status}
                        </Badge>
                      </div>
                    </div>

                    {expandedTest === test.id && (
                      <div className="px-4 pb-4 border-t bg-surface-secondary/30">
                        <div className="pt-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="font-medium mb-1">Headers</div>
                              <pre className="rounded border bg-surface p-3 text-xs overflow-x-auto">
                                {JSON.stringify(test.headers || {}, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <div className="font-medium mb-1">Body / Query</div>
                              <pre className="rounded border bg-surface p-3 text-xs overflow-x-auto">
                                {JSON.stringify({ query: test.query || {}, body: test.body || null }, null, 2)}
                              </pre>
                            </div>
                          </div>

                          {test.expectedBodyShape?.length ? (
                            <div>
                              <div className="text-sm font-medium mb-2">Expected body shape</div>
                              <div className="flex flex-wrap gap-2">
                                {test.expectedBodyShape.map((field) => (
                                  <Badge key={field} variant="outline">{field}</Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {test.assumptions?.length ? (
                            <div>
                              <div className="text-sm font-medium mb-2">Assumptions</div>
                              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                {test.assumptions.map((assumption, index) => (
                                  <li key={`${test.id}-assumption-${index}`}>{assumption}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          <div>
                            <div className="text-sm font-medium mb-2">Generated preview</div>
                            <pre className="text-xs text-muted-foreground font-mono bg-surface p-3 rounded border overflow-x-auto">
                              {test.testCode}
                            </pre>
                          </div>

                          {test.result && (
                            <div>
                              <div className="text-sm font-medium mb-2">Validation result</div>
                              <div className="text-sm text-muted-foreground bg-surface p-3 rounded border whitespace-pre-line">
                                {test.result}
                              </div>
                            </div>
                          )}

                          {test.error && (
                            <div>
                              <div className="text-sm font-medium mb-2 text-error">Issue found</div>
                              <div className="text-sm text-error bg-error/10 p-3 rounded border">
                                {test.error}
                              </div>
                            </div>
                          )}

                          {test.suggestion && (
                            <div>
                              <div className="text-sm font-medium mb-2 text-info">Suggested next step</div>
                              <div className="text-sm text-info bg-info/10 p-3 rounded border whitespace-pre-line">
                                {test.suggestion}
                              </div>
                              {!feedbackGiven[test.id] ? (
                                <div className="flex gap-2 mt-2">
                                  <Button size="icon" variant="ghost" title="Helpful" onClick={() => handleSuggestionFeedback(test.id, "up")}>
                                    <ThumbsUp className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" title="Not helpful" onClick={() => handleSuggestionFeedback(test.id, "down")}>
                                    <ThumbsDown className="w-4 h-4" />
                                  </Button>
                                  <span className="text-xs text-muted-foreground ml-2">Was this suggestion helpful?</span>
                                </div>
                              ) : (
                                <div className="text-xs text-success mt-2 flex items-center gap-1">
                                  <Check className="w-4 h-4" />
                                  Thank you for your feedback!
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <FileCode className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No structured tests yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload an API file, inspect the code, and generate structured test cases to start validating coverage.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
