"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Upload,
  Cpu,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  HardDrive,
  Trash2,
  TestTube,
  Eye,
  Download,
  Globe,
  Plug,
  Clipboard,
  XCircle,
  Key,
} from "lucide-react"
import { DragDropZone } from "@/components/drag-drop-zone"
import { useToast } from "@/hooks/use-toast"

interface ModelData {
  id: string
  modelName: string
  filePath: string
  mode: "ollama" | "llama.cpp" | "onnx" | "torch"
  tokens: number
  batchSize: number
  status: "Pending" | "Running" | "Failed" | "Stopped"
  port?: number
  createdAt: string
  lastActivity?: string
  version?: number
  size?: number
}

interface TestResult {
  prompt: string
  response: string
  latency: number
  timestamp: string
}

export default function UploadModelPage() {
  const [uploadMethod, setUploadMethod] = useState<"file" | "url">("file")
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentProgress, setDeploymentProgress] = useState(0)
  const [deploymentStatus, setDeploymentStatus] = useState("")
  const [models, setModels] = useState<ModelData[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult }>({})
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showLogsModal, setShowLogsModal] = useState(false)
  const [activityLogs, setActivityLogs] = useState("")
  const { toast } = useToast()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [hardwareSuggestion, setHardwareSuggestion] = useState<null | {
    vram: string
    ram: string
    storage: string
    cloud: string
    warning?: string
  }>(null)
  const [endpointModal, setEndpointModal] = useState<{ open: boolean; modelId?: string; data?: { baseUrl: string; samplePaths: string[]; mode: string; modelName: string } }>({ open: false })
  const [testingMap, setTestingMap] = useState<Record<string, "idle" | "loading" | "running" | "failed">>({})
  const [apiKeysModal, setApiKeysModal] = useState<{ open: boolean; modelId?: string; modelName?: string; keys?: Array<{ keyId: string; prefix: string; createdAt: string; revokedAt?: string | null }>; createdKey?: { apiKey: string; keyId: string; prefix: string; createdAt: string } | null }>({ open: false })

  // Form state
  const [formData, setFormData] = useState({
    modelName: "",
    huggingFaceUrl: "",
    mode: "ollama" as "ollama" | "llama.cpp" | "onnx" | "torch",
    tokens: 2048,
    batchSize: 32,
    threads: 4,
    nPredict: 128,
    streamMode: true,
  })

  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Load models on component mount
  useEffect(() => {
    loadModels()
    loadActivityLogs()

    const startPolling = () => {
      if (pollingRef.current) return
      pollingRef.current = setInterval(() => {
        if (document.hidden) return
        loadModels()
      }, 10000)
    }

    const stopPolling = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }

    startPolling()

    const onVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        loadModels()
        startPolling()
      }
    }

    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      stopPolling()
    }
  }, [])

  const loadModels = async () => {
    try {
      const response = await fetch("/api/models")
      const data = await response.json()

      if (data.success) {
        setModels(data.models || [])
      } else {
        console.error("Failed to load models:", data.error)
        setModels([])
      }
    } catch (error) {
      console.error("Failed to load models:", error)
      setModels([])
    }
  }

  const loadActivityLogs = async () => {
    try {
      const response = await fetch("/api/models/logs")
      const data = await response.json()

      if (data.success) {
        setActivityLogs(data.logs || "No activity logs available.")
      } else {
        console.error("Failed to load logs:", data.error)
        setActivityLogs("Failed to load activity logs. Please try again.")
      }
    } catch (error) {
      console.error("Failed to load logs:", error)
      setActivityLogs("Error loading activity logs. Please check your connection and try again.")
    }
  }

  // Estimate hardware requirements based on file size (in bytes)
  function estimateHardware(file: File | null) {
    if (!file) return null
    const sizeGB = file.size / (1024 ** 3)
    let vram = "4 GB+", ram = "8 GB+", storage = ""
    let cloud = "Any (AWS S3, GCP, Azure, etc.)"
    let warning = undefined
    if (sizeGB < 2) {
      vram = "6 GB+ (consumer GPU)"
      ram = "8–16 GB"
      storage = `${(file.size / (1024 ** 2)).toFixed(1)} MB`
    } else if (sizeGB < 7) {
      vram = "12 GB+ (mid/high-end GPU)"
      ram = "16–32 GB"
      storage = `${sizeGB.toFixed(2)} GB`
    } else {
      vram = "24 GB+ (A100, H100, or cloud GPU)"
      ram = "32 GB+"
      storage = `${sizeGB.toFixed(2)} GB`
      cloud = "Recommended: AWS S3, GCP, Azure Blob, or HuggingFace Hub"
      warning = "Model is very large. Consumer hardware may not be sufficient."
    }
    return { vram, ram, storage, cloud, warning }
  }

  // When file is selected, estimate hardware
  useEffect(() => {
    setHardwareSuggestion(estimateHardware(selectedFile))
  }, [selectedFile])

  const handleFileUpload = async () => {
    setUploadError(null)
    setUploading(true)
    if (!selectedFile) {
      setUploadError("Please select a file first")
      setUploading(false)
      return
    }

    if (!formData.modelName.trim()) {
      alert("Please provide a model name")
      setUploading(false)
      return
    }

    setIsDeploying(true)
    setDeploymentProgress(0)
    setDeploymentStatus("Uploading model...")

    try {
      const formDataToSend = new FormData()

      if (uploadMethod === "file" && selectedFile) {
        formDataToSend.append("modelFile", selectedFile)
      } else {
        formDataToSend.append("huggingFaceUrl", formData.huggingFaceUrl)
      }

      formDataToSend.append("modelName", formData.modelName)
      formDataToSend.append("mode", formData.mode)
      formDataToSend.append("tokens", formData.tokens.toString())
      formDataToSend.append("batchSize", formData.batchSize.toString())
      formDataToSend.append("threads", formData.threads.toString())
      formDataToSend.append("nPredict", formData.nPredict.toString())
      formDataToSend.append("streamMode", formData.streamMode.toString())

      const response = await fetch("/api/models/deploy", {
        method: "POST",
        body: formDataToSend,
      })

      if (response.ok) {
        const result = await response.json()

        // Simulate deployment progress
        const progressSteps = [
          { progress: 25, status: "Processing model file..." },
          { progress: 50, status: "Configuring deployment..." },
          { progress: 75, status: "Starting model service..." },
          { progress: 100, status: "Deployment complete!" },
        ]

        for (const step of progressSteps) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          setDeploymentProgress(step.progress)
          setDeploymentStatus(step.status)
        }

        await loadModels()
        setShowUploadModal(false)
        resetForm()
        toast({ title: "Model deployed!", description: `Model ${formData.modelName} deployed.` })
      } else {
        const error = await response.json()
        alert(`Deployment failed: ${error.message}`)
        toast({ title: "Deployment failed", description: `Deployment failed: ${error.message}` })
      }
    } catch (error) {
      console.error("Deployment error:", error)
      alert("Deployment failed. Please try again.")
      toast({ title: "Deployment failed", description: "Deployment failed. Please try again." })
    } finally {
      setIsDeploying(false)
      setDeploymentProgress(0)
      setDeploymentStatus("")
      setUploading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      modelName: "",
      huggingFaceUrl: "",
      mode: "ollama",
      tokens: 2048,
      batchSize: 32,
      threads: 4,
      nPredict: 128,
      streamMode: true,
    })
    setSelectedFile(null)
  }

  const testModel = async (modelId: string) => {
    try {
      const startTime = Date.now()
      const response = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          prompt: "Say hello and introduce yourself briefly.",
        }),
      })

      const endTime = Date.now()
      const latency = endTime - startTime

      if (response.ok) {
        const result = await response.json()
        setTestResults((prev) => ({
          ...prev,
          [modelId]: {
            prompt: "Say hello and introduce yourself briefly.",
            response: result.response,
            latency,
            timestamp: new Date().toISOString(),
          },
        }))
      } else {
        const error = await response.json()
        alert(`Test failed: ${error.message}`)
      }
    } catch (error) {
      console.error("Test error:", error)
      alert("Test failed. Please try again.")
    }
  }

  const deleteModel = async (modelId: string) => {
    if (!confirm("Are you sure you want to delete this model?")) return

    try {
      const response = await fetch(`/api/models/${modelId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await loadModels()
        // Remove test results for deleted model
        setTestResults((prev) => {
          const newResults = { ...prev }
          delete newResults[modelId]
          return newResults
        })
        toast({ title: "Model deleted", description: `Model ${modelId} deleted.` })
      } else {
        const error = await response.json()
        alert(`Delete failed: ${error.message}`)
        toast({ title: "Delete failed", description: `Delete failed: ${error.message}` })
      }
    } catch (error) {
      console.error("Delete error:", error)
      alert("Delete failed. Please try again.")
      toast({ title: "Delete failed", description: "Delete failed. Please try again." })
    }
  }

  async function handleTestModel(modelId: string) {
    setTestingMap((m) => ({ ...m, [modelId]: "loading" }))
    try {
      const res = await fetch(`/api/models/${modelId}/test`)
      const data = await res.json()
      if (res.ok && data.status === "running") {
        setTestingMap((m) => ({ ...m, [modelId]: "running" }))
        toast({ title: "Model is running", description: `Health check passed` })
      } else {
        setTestingMap((m) => ({ ...m, [modelId]: "failed" }))
        toast({ title: "Model check failed", description: data.error || "Health check failed" })
      }
    } catch (e: any) {
      setTestingMap((m) => ({ ...m, [modelId]: "failed" }))
      toast({ title: "Model check failed", description: e?.message || "Health check failed" })
    }
  }

  async function handleShowEndpoint(modelId: string) {
    try {
      const res = await fetch(`/api/models/${modelId}/endpoint`)
      const data = await res.json()
      if (res.ok && data.success) {
        setEndpointModal({ open: true, modelId, data: { baseUrl: data.baseUrl, samplePaths: data.samplePaths, mode: data.mode, modelName: data.modelName } })
      } else {
        toast({ title: "Endpoint unavailable", description: data.error || "Model is not running" })
      }
    } catch (e: any) {
      toast({ title: "Endpoint error", description: e?.message || "Failed to fetch endpoint" })
    }
  }

  async function handleOpenApiKeys(modelId: string, modelName: string) {
    try {
      const res = await fetch(`/api/models/${modelId}/keys`)
      const data = await res.json()
      if (res.ok && data.success) {
        setApiKeysModal({ open: true, modelId, modelName, keys: data.keys, createdKey: null })
      } else {
        toast({ title: "Failed to load keys", description: data.error || "" })
      }
    } catch (e: any) {
      toast({ title: "Failed to load keys", description: e?.message || "" })
    }
  }

  async function handleGenerateApiKey() {
    if (!apiKeysModal.modelId) return
    try {
      const res = await fetch(`/api/models/${apiKeysModal.modelId}/keys`, { method: "POST" })
      const data = await res.json()
      if (res.ok && data.success) {
        // refresh list
        const listRes = await fetch(`/api/models/${apiKeysModal.modelId}/keys`)
        const listData = await listRes.json()
        setApiKeysModal((s) => ({ ...s, keys: listData.keys || s.keys, createdKey: { apiKey: data.apiKey, keyId: data.keyId, prefix: data.prefix, createdAt: data.createdAt } }))
        toast({ title: "API key created", description: `Prefix ${data.prefix}` })
      } else {
        toast({ title: "Failed to create key", description: data.error || "" })
      }
    } catch (e: any) {
      toast({ title: "Failed to create key", description: e?.message || "" })
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied", description: text })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Running":
        return "bg-success text-success-foreground"
      case "Pending":
        return "bg-warning text-warning-foreground"
      case "Failed":
        return "bg-error text-error-foreground"
      case "Stopped":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Running":
        return <CheckCircle className="w-3 h-3 mr-1" />
      case "Pending":
        return <Clock className="w-3 h-3 mr-1" />
      case "Failed":
        return <AlertCircle className="w-3 h-3 mr-1" />
      case "Stopped":
        return <Clock className="w-3 h-3 mr-1" />
      default:
        return <Clock className="w-3 h-3 mr-1" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Model Management</h1>
          <p className="text-muted-foreground">Deploy and manage your LLM models with Ollama or llama.cpp.</p>
        </div>
        <div className="flex space-x-3">
          <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                View Logs
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Activity Logs</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <pre className="bg-surface-secondary p-4 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                  {activityLogs || "No activity logs available."}
                </pre>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Deploy New Model
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Deploy New Model</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4">
                {/* Upload Method Selection */}
                <div className="flex space-x-4">
                  <Button
                    variant={uploadMethod === "file" ? "default" : "outline"}
                    onClick={() => setUploadMethod("file")}
                    className="flex-1"
                  >
                    <HardDrive className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>
                  <Button
                    variant={uploadMethod === "url" ? "default" : "outline"}
                    onClick={() => setUploadMethod("url")}
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    HuggingFace URL
                  </Button>
                </div>

                {/* Model Name */}
                <div className="space-y-2">
                  <Label htmlFor="model-name">Model Name *</Label>
                  <Input
                    id="model-name"
                    placeholder="e.g., my-custom-llama"
                    value={formData.modelName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, modelName: e.target.value }))}
                  />
                </div>

                {/* File Upload or URL */}
                {uploadMethod === "file" ? (
                  <div className="space-y-2">
                    <Label>Model File</Label>
                    <DragDropZone
                      acceptedTypes=".gguf,.bin,.safetensors,.onnx,.pth,.pt"
                      description="Upload .gguf, .bin, .safetensors, .onnx, or .pth/.pt files"
                      onFileSelect={(files) => setSelectedFile(files[0])}
                    />
                    {selectedFile && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                        </p>
                        {hardwareSuggestion && (
                          <div className="bg-muted/40 rounded-md p-3">
                            <div className="font-semibold mb-1 text-sm">Hardware Suggestions for this Model</div>
                            <ul className="text-xs list-disc pl-5 space-y-1">
                              <li><b>GPU VRAM:</b> {hardwareSuggestion.vram}</li>
                              <li><b>RAM:</b> {hardwareSuggestion.ram}</li>
                              <li><b>Storage:</b> {hardwareSuggestion.storage}</li>
                              <li><b>Cloud Storage:</b> {hardwareSuggestion.cloud}</li>
                              {hardwareSuggestion.warning && (
                                <li className="text-warning font-medium">{hardwareSuggestion.warning}</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="hf-url">HuggingFace Model URL</Label>
                    <Input
                      id="hf-url"
                      placeholder="https://huggingface.co/microsoft/DialoGPT-medium"
                      value={formData.huggingFaceUrl}
                      onChange={(e) => setFormData((prev) => ({ ...prev, huggingFaceUrl: e.target.value }))}
                    />
                    {formData.huggingFaceUrl && (
                      <div className="bg-muted/40 rounded-md p-3">
                        <div className="font-semibold mb-1 text-sm">Hardware Guidance</div>
                        <div className="text-xs text-muted-foreground">
                          Exact requirements depend on the model size on HuggingFace. As a guideline:
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            <li>Small models (&lt;2 GB): ~6 GB VRAM, 8–16 GB RAM</li>
                            <li>Medium (2–7 GB): ~12 GB VRAM, 16–32 GB RAM</li>
                            <li>Large (&gt;7 GB): 24 GB+ VRAM or cloud GPU, 32 GB+ RAM</li>
                          </ul>
                          Mode: {formData.mode === "onnx" ? "ONNX Runtime" : formData.mode === "torch" ? "PyTorch/TorchServe" : formData.mode}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Deployment Mode */}
                <div className="space-y-2">
                  <Label>Deployment Mode</Label>
                  <Select
                    value={formData.mode}
                    onValueChange={(value: "ollama" | "llama.cpp" | "onnx" | "torch") => setFormData((prev) => ({ ...prev, mode: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama">Ollama (Recommended)</SelectItem>
                      <SelectItem value="llama.cpp">llama.cpp (Advanced)</SelectItem>
                      <SelectItem value="onnx">ONNX Runtime</SelectItem>
                      <SelectItem value="torch">PyTorch (TorchServe)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-tokens">Max Tokens</Label>
                    <Input
                      id="max-tokens"
                      type="number"
                      value={formData.tokens}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tokens: Number.parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batch-size">Batch Size</Label>
                    <Input
                      id="batch-size"
                      type="number"
                      value={formData.batchSize}
                      onChange={(e) => setFormData((prev) => ({ ...prev, batchSize: Number.parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                {formData.mode === "llama.cpp" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="threads">Threads</Label>
                      <Input
                        id="threads"
                        type="number"
                        value={formData.threads}
                        onChange={(e) => setFormData((prev) => ({ ...prev, threads: Number.parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="n-predict">N-Predict</Label>
                      <Input
                        id="n-predict"
                        type="number"
                        value={formData.nPredict}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, nPredict: Number.parseInt(e.target.value) }))
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Stream Mode</Label>
                    <div className="text-sm text-muted-foreground">Enable real-time response streaming</div>
                  </div>
                  <Switch
                    checked={formData.streamMode}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, streamMode: checked }))}
                  />
                </div>

                {/* Deployment Progress */}
                {isDeploying && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{deploymentStatus}</span>
                      <span>{deploymentProgress}%</span>
                    </div>
                    <Progress value={deploymentProgress} />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setShowUploadModal(false)} disabled={isDeploying}>
                    Cancel
                  </Button>
                  <Button onClick={handleFileUpload} disabled={isDeploying}>
                    {isDeploying ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Cpu className="w-4 h-4 mr-2" />
                        Deploy Model
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-4">
        {uploadError && <div className="text-error text-sm mb-2">{uploadError}</div>}
        {selectedFile && hardwareSuggestion && (
          <div className="bg-muted/40 rounded-md p-4 mb-2">
            <div className="font-semibold mb-1">Hardware Suggestions for this Model:</div>
            <ul className="text-sm list-disc pl-5">
              <li><b>GPU VRAM:</b> {hardwareSuggestion.vram}</li>
              <li><b>RAM:</b> {hardwareSuggestion.ram}</li>
              <li><b>Storage:</b> {hardwareSuggestion.storage}</li>
              <li><b>Cloud Storage:</b> {hardwareSuggestion.cloud}</li>
              {hardwareSuggestion.warning && <li className="text-warning font-semibold">{hardwareSuggestion.warning}</li>}
            </ul>
          </div>
        )}
      </div>

      {/* Models List */}
      <Card>
        <CardHeader>
          <CardTitle>Deployed Models</CardTitle>
        </CardHeader>
        <CardContent>
          {uploading ? (
            <div className="text-muted-foreground text-sm">Loading models...</div>
          ) : models.length === 0 ? (
            <div className="text-muted-foreground text-sm">No models uploaded yet.</div>
          ) : (
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-surface-secondary rounded-lg flex items-center justify-center">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium">{model.modelName}</div>
                        <div className="text-sm text-muted-foreground">
                          {model.mode} • {model.tokens} tokens • Created{" "}
                          {new Date(model.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(model.status)}>
                        {getStatusIcon(model.status)}
                        {model.status}
                      </Badge>
                      {model.port && <Badge variant="outline">Port {model.port}</Badge>}
                      {model.filePath && !model.filePath.startsWith("http") && (
                        <a
                          href={`/api/models/${model.id}/download`}
                          download
                          className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                          title="Download model file"
                        >
                          <Download className="w-4 h-4" /> Download
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Test Results */}
                  {testResults[model.id] && (
                    <div className="mb-3 p-3 bg-surface-secondary rounded-lg">
                      <div className="text-sm font-medium mb-1">Last Test Result:</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Latency: {testResults[model.id].latency}ms •{" "}
                        {new Date(testResults[model.id].timestamp).toLocaleString()}
                      </div>
                      <div className="text-sm bg-surface p-2 rounded border">
                        <strong>Response:</strong> {testResults[model.id].response}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testModel(model.id)}
                      disabled={model.status !== "Running"}
                    >
                      <TestTube className="w-4 h-4 mr-1" />
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShowEndpoint(model.id)}
                      disabled={model.status !== "Running"}
                    >
                      <Globe className="w-4 h-4 mr-1" />
                      Show Endpoint
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenApiKeys(model.id, model.modelName)}
                    >
                      <Key className="w-4 h-4 mr-1" />
                      API Keys
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteModel(model.id)}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endpoint Modal */}
      <Dialog open={endpointModal.open} onOpenChange={(v) => setEndpointModal((s) => ({ ...s, open: v }))}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Model Endpoint</DialogTitle>
          </DialogHeader>
          {endpointModal.data && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground">Model</div>
                <div className="font-medium">{endpointModal.data.modelName} <span className="uppercase text-xs ml-2 px-2 py-0.5 bg-muted rounded">{endpointModal.data.mode}</span></div>
              </div>
              <div>
                <div className="text-muted-foreground">Base URL</div>
                <div className="flex items-center gap-2">
                  <code className="bg-surface px-2 py-1 rounded border">{endpointModal.data.baseUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(endpointModal.data!.baseUrl)}><Clipboard className="w-3 h-3 mr-1" /> Copy</Button>
                </div>
              </div>
              {endpointModal.data.samplePaths?.length > 0 && (
                <div>
                  <div className="text-muted-foreground">Sample Paths</div>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {endpointModal.data.samplePaths.map((p, idx) => (
                      <li key={idx}><code className="bg-surface px-1 py-0.5 rounded border">{p}</code></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* API Keys Modal */}
      <Dialog open={apiKeysModal.open} onOpenChange={(v) => setApiKeysModal((s) => ({ ...s, open: v }))}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>API Keys {apiKeysModal.modelName ? `for ${apiKeysModal.modelName}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {apiKeysModal.createdKey && (
              <div className="p-3 border rounded bg-surface-secondary">
                <div className="font-medium mb-1">New API Key (copy now, shown only once)</div>
                <div className="flex items-center gap-2">
                  <code className="bg-surface px-2 py-1 rounded border break-all">{apiKeysModal.createdKey.apiKey}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(apiKeysModal.createdKey!.apiKey)}><Clipboard className="w-3 h-3 mr-1" /> Copy</Button>
                </div>
                <div className="text-xs text-warning mt-1">Keep this key secure. It won't be shown again.</div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="font-medium">Existing Keys</div>
              <Button size="sm" onClick={handleGenerateApiKey}>Generate API Key</Button>
            </div>
            {apiKeysModal.keys && apiKeysModal.keys.length > 0 ? (
              <div className="space-y-2">
                {apiKeysModal.keys.map((k) => (
                  <div key={k.keyId} className="flex items-center justify-between border rounded p-2">
                    <div>
                      <div className="font-mono text-xs">{k.masked}</div>
                      <div className="text-xs text-muted-foreground">Created {new Date(k.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {k.revokedAt ? (
                        <span className="text-xs text-muted-foreground">Revoked</span>
                      ) : (
                        <>
                          <span className="text-xs text-success">Active</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/models/${apiKeysModal.modelId}/keys/${k.keyId}`, { method: "DELETE" })
                                const data = await res.json().catch(() => ({}))
                                if (!res.ok) {
                                  toast({ title: "Revoke failed", description: data.error || "" })
                                } else {
                                  const listRes = await fetch(`/api/models/${apiKeysModal.modelId}/keys`)
                                  const listData = await listRes.json()
                                  setApiKeysModal((s) => ({ ...s, keys: listData.keys || s.keys }))
                                  toast({ title: "Key revoked", description: k.prefix })
                                }
                              } catch (e: any) {
                                toast({ title: "Revoke failed", description: e?.message || "" })
                              }
                            }}
                          >
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No keys yet.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
