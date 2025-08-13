"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Upload, Zap, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight, Play, FileCode, Trash2, Shield, Clipboard, FileText, ThumbsUp, ThumbsDown, Check, RefreshCw, AlertTriangle, AlertOctagon, AlertCircle, Info } from "lucide-react"
import { DragDropZone } from "@/components/drag-drop-zone"

interface TestCase {
  id: string
  name: string
  description: string
  testCode: string
  status: "pending" | "passed" | "failed" | "running"
  result?: string
  error?: string
  executionTime?: number
  timestamp?: string
  suggestion?: string
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
}

export default function UploadAPIPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [expandedTest, setExpandedTest] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [uploadedApi, setUploadedApi] = useState<ApiData | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [exported, setExported] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<{ [testId: string]: boolean }>({})
  const [reanalyzing, setReanalyzing] = useState(false)

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file first")
      return
    }

    try {
      const formData = new FormData()
      formData.append("apiFile", selectedFile)
      formData.append("description", description)

      const response = await fetch("/api/apis", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
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
          securityAnalysis: result.securityAnalysis, // <-- ensure this is set
        })
        alert("API uploaded successfully!")
      } else {
        const error = await response.json()
        alert(`Upload failed: ${error.error}`)
      }
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
      // Simulate progress
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
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

      if (response.ok) {
        const result = await response.json()
        setUploadedApi(prev => prev ? {
          ...prev,
          testCases: result.testCases,
          status: "testing",
          totalTests: result.testCases.length,
        } : null)
        setHasGenerated(true)
        alert(`Generated ${result.testCases.length} test cases!`)
      } else {
        const error = await response.json()
        alert(`Test generation failed: ${error.error}`)
      }
    } catch (error) {
      console.error("Test generation error:", error)
      alert("Test generation failed. Please try again.")
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }

  const handleExecuteTests = async () => {
    if (!uploadedApi || uploadedApi.testCases.length === 0) {
      alert("No tests to execute")
      return
    }

    setIsExecuting(true)
    setExecutionProgress(0)

    try {
      const progressInterval = setInterval(() => {
        setExecutionProgress(prev => {
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
          testIds: uploadedApi.testCases.map(test => test.id)
        }),
      })

      clearInterval(progressInterval)
      setExecutionProgress(100)

      if (response.ok) {
        const result = await response.json()
        setUploadedApi(prev => prev ? {
          ...prev,
          testCases: result.results,
          status: "completed",
          passedTests: result.summary.passed,
          failedTests: result.summary.failed,
          lastTested: new Date().toISOString(),
        } : null)
        alert(`Tests executed! ${result.summary.passed} passed, ${result.summary.failed} failed`)
      } else {
        const error = await response.json()
        alert(`Test execution failed: ${error.error}`)
      }
    } catch (error) {
      console.error("Test execution error:", error)
      alert("Test execution failed. Please try again.")
    } finally {
      setIsExecuting(false)
      setExecutionProgress(0)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed":
        return "bg-success text-success-foreground"
      case "failed":
        return "bg-error text-error-foreground"
      case "running":
        return "bg-warning text-warning-foreground"
      case "pending":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle className="w-3 h-3 mr-1" />
      case "failed":
        return <XCircle className="w-3 h-3 mr-1" />
      case "running":
        return <Clock className="w-3 h-3 mr-1" />
      case "pending":
        return <Clock className="w-3 h-3 mr-1" />
      default:
        return <Clock className="w-3 h-3 mr-1" />
    }
  }

  async function handleSuggestionFeedback(testId: string, value: "up" | "down") {
    setFeedbackGiven(f => ({ ...f, [testId]: true }))
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, value })
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
    const a = document.createElement("a")
    a.href = url
    a.download = "security-analysis.md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setExported(true)
    setTimeout(() => setExported(false), 1500)
  }

  function cleanMarkdown(text: string) {
    // Remove bold/inline code markers for a cleaner look
    return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`/g, "")
  }

  function highlightSeverityLine(line: string) {
    let icon: JSX.Element | null = null
    let color = "text-foreground"
    if (/critical/i.test(line)) {
      icon = <AlertOctagon className="inline w-4 h-4 text-error mr-2" />; color = "text-foreground"
    } else if (/\bhigh\b/i.test(line)) {
      icon = <AlertTriangle className="inline w-4 h-4 text-warning mr-2" />; color = "text-foreground"
    } else if (/medium/i.test(line)) {
      icon = <AlertCircle className="inline w-4 h-4 text-orange-500 mr-2" />; color = "text-foreground"
    } else if (/(low|info)/i.test(line)) {
      icon = <Info className="inline w-4 h-4 text-info mr-2" />; color = "text-foreground"
    }
    return (
      <div className={`flex items-start ${color}`}>
        {icon}
        <span className="whitespace-pre-wrap leading-relaxed">{line}</span>
      </div>
    )
  }

  function renderSecurityAnalysis(text: string) {
    const blocks = text.split(/\n\s*\n/)
    return (
      <div className="space-y-3">
        {blocks.map((block, idx) => {
          const lines = block.split("\n").map(l => l.trim()).filter(Boolean)
          const isList = lines.length > 0 && lines.every(l => /^[-*]\s+/.test(l))
          if (isList) {
            const items = lines.map(l => l.replace(/^[-*]\s+/, ""))
            return (
              <ul key={idx} className="list-disc pl-5 space-y-1">
                {items.map((it, i) => (
                  <li key={i} className="text-sm">{highlightSeverityLine(it)}</li>
                ))}
              </ul>
            )
          }
          // Paragraph block
          return (
            <div key={idx} className="space-y-1">
              {lines.map((l, i) => (
                <div key={i} className="text-sm">{highlightSeverityLine(l)}</div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  async function handleReanalyze() {
    if (!uploadedApi) return
    setReanalyzing(true)
    try {
      const res = await fetch("/api/apis/security-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: uploadedApi.id })
      })
      const data = await res.json()
      if (data.success && data.securityAnalysis) {
        setUploadedApi(prev => prev ? { ...prev, securityAnalysis: data.securityAnalysis } : prev)
      }
    } finally {
      setReanalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload API</h1>
        <p className="text-muted-foreground">
          Upload your API specification and let AI generate comprehensive test cases.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
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
                onFileSelect={(files) => setSelectedFile(files[0])}
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
                    <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="h-8 w-8">
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
              <CardTitle>API Description (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Describe your API's purpose, expected behavior, or specific testing requirements..."
                className="min-h-[100px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button 
              onClick={handleGenerateTests} 
              disabled={isGenerating || !uploadedApi} 
              className="w-full" 
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Generating Tests...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Tests
                </>
              )}
            </Button>

            {uploadedApi && uploadedApi.testCases.length > 0 && (
              <Button 
                onClick={handleExecuteTests} 
                disabled={isExecuting} 
                className="w-full" 
                size="lg"
                variant="outline"
              >
                {isExecuting ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Executing Tests...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Execute Tests
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {/* Generation Progress */}
          {isGenerating && (
            <Card>
              <CardHeader>
                <CardTitle>Generating Test Cases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Analyzing API structure...</span>
                    <span>{generationProgress}%</span>
                  </div>
                  <Progress value={generationProgress} />
                </div>
                <div className="text-sm text-muted-foreground">
                  AI is analyzing your API and generating comprehensive test scenarios.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Execution Progress */}
          {isExecuting && (
            <Card>
              <CardHeader>
                <CardTitle>Executing Tests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Running test cases...</span>
                    <span>{executionProgress}%</span>
                  </div>
                  <Progress value={executionProgress} />
                </div>
                <div className="text-sm text-muted-foreground">
                  Executing generated test cases and collecting results.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Analysis Section */}
          {uploadedApi && uploadedApi.securityAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-info" />
                  Security Analysis
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-2"
                    title="Copy to clipboard"
                    onClick={() => handleCopyAnalysis(uploadedApi.securityAnalysis)}
                  >
                    {copied ? <Check className="w-4 h-4 text-success" /> : <Clipboard className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-1"
                    title="Export as Markdown"
                    onClick={() => handleExportMarkdown(uploadedApi.securityAnalysis)}
                  >
                    {exported ? <Check className="w-4 h-4 text-success" /> : <FileText className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-1"
                    title="Re-analyze security"
                    onClick={handleReanalyze}
                    disabled={reanalyzing}
                  >
                    {reanalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-foreground">
                  {renderSecurityAnalysis(cleanMarkdown(uploadedApi.securityAnalysis))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test Results */}
          {uploadedApi && uploadedApi.testCases.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
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
                      Last tested: {new Date(uploadedApi.lastTested).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Generated Test Cases</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {uploadedApi.testCases.map((test) => (
                      <div key={test.id} className="border rounded-lg">
                        <div
                          className="p-4 cursor-pointer hover:bg-surface-secondary/50 transition-colors"
                          onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {expandedTest === test.id ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              <div>
                                <div className="font-medium">{test.name}</div>
                                <div className="text-sm text-muted-foreground">{test.description}</div>
                                {test.executionTime && (
                                  <div className="text-xs text-muted-foreground">
                                    Execution time: {test.executionTime}ms
                                  </div>
                                )}
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
                            <div className="pt-4 space-y-3">
                              <div>
                                <div className="text-sm font-medium mb-2">Test Code:</div>
                                <pre className="text-xs text-muted-foreground font-mono bg-surface p-3 rounded border overflow-x-auto">
                                  {test.testCode}
                                </pre>
                              </div>
                              {test.result && (
                                <div>
                                  <div className="text-sm font-medium mb-2">Result:</div>
                                  <div className="text-sm text-muted-foreground bg-surface p-3 rounded border">
                                    {test.result}
                                  </div>
                                </div>
                              )}
                              {test.error && (
                                <div>
                                  <div className="text-sm font-medium mb-2 text-error">Error:</div>
                                  <div className="text-sm text-error bg-error/10 p-3 rounded border">
                                    {test.error}
                                  </div>
                                </div>
                              )}
                              {test.suggestion && (
                                <div>
                                  <div className="text-sm font-medium mb-2 text-info">Correction Suggestion:</div>
                                  <div className="text-sm text-info bg-info/10 p-3 rounded border whitespace-pre-line">
                                    {test.suggestion}
                                  </div>
                                  {!feedbackGiven[test.id] ? (
                                    <div className="flex gap-2 mt-2">
                                      <Button size="icon" variant="ghost" title="Helpful" onClick={() => handleSuggestionFeedback(test.id, "up")}> <ThumbsUp className="w-4 h-4" /> </Button>
                                      <Button size="icon" variant="ghost" title="Not helpful" onClick={() => handleSuggestionFeedback(test.id, "down")}> <ThumbsDown className="w-4 h-4" /> </Button>
                                      <span className="text-xs text-muted-foreground ml-2">Was this suggestion helpful?</span>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-success mt-2 flex items-center gap-1"><Check className="w-4 h-4" /> Thank you for your feedback!</div>
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
          )}

          {/* No API Uploaded */}
          {!uploadedApi && !isGenerating && !isExecuting && (
            <Card>
              <CardContent className="text-center py-12">
                <FileCode className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No API uploaded</h3>
                <p className="text-muted-foreground mb-4">Upload an API file to generate and execute test cases.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
