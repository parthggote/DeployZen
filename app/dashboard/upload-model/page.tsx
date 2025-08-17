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
  mode: "ollama" | "llama.cpp" | "onnx" | "torch" | "huggingface"
  tokens: number
  batchSize: number
  status: "Pending" | "Running" | "Failed" | "Stopped" | "Initializing"
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
    huggingFaceModelId: "",
    mode: "ollama" as "ollama" | "llama.cpp" | "onnx" | "torch" | "huggingface",
    tokens: 2048,
    batchSize: 32,
    threads: 4,
    nPredict: 128,
    streamMode: true,
  })

  const pollingRef = useRef<NodeJS.Timeout | null>(null)

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

  const handleFileUpload = async () => {
    setUploadError(null)
    setUploading(true)

    if (!formData.modelName.trim()) {
      alert("Please provide a model name")
      setUploading(false)
      return
    }

    if (formData.mode !== 'huggingface' && !selectedFile) {
      setUploadError("Please select a file for this deployment mode")
      setUploading(false)
      return
    }

    if (formData.mode === 'huggingface' && !formData.huggingFaceModelId.trim()) {
        alert("Please provide a Hugging Face Model ID")
        setUploading(false)
        return
    }

    setIsDeploying(true)
    setDeploymentProgress(0)
    setDeploymentStatus("Uploading model...")

    try {
      const formDataToSend = new FormData()

      if (formData.mode === 'huggingface') {
        formDataToSend.append("huggingFaceModelId", formData.huggingFaceModelId);
      } else if (selectedFile) {
        formDataToSend.append("modelFile", selectedFile);
      }

      formDataToSend.append("modelName", formData.modelName)
      formDataToSend.append("mode", formData.mode)
      formDataToSend.append("tokens", formData.tokens.toString())
      formDataToSend.append("batchSize", formData.batchSize.toString())
      formDataToSend.append("threads", formData.threads.toString())
      formDataToSend.append("nPredict", formData.nPredict.toString())
      formDataToSend.append("streamMode", formData.streamMode.toString())

      const response = await fetch("/api/activity", {
        method: "POST",
        body: formDataToSend,
      })

      if (response.ok) {
        const result = await response.json()
        await loadModels()
        setShowUploadModal(false)
        resetForm()
        toast({ title: "Model deployment initiated!", description: `Model ${formData.modelName} is being deployed.` })
      } else {
        const error = await response.json()
        alert(`Deployment failed: ${error.error}`)
        toast({ title: "Deployment failed", description: `Deployment failed: ${error.error}` })
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
      huggingFaceModelId: "",
      mode: "ollama",
      tokens: 2048,
      batchSize: 32,
      threads: 4,
      nPredict: 128,
      streamMode: true,
    })
    setSelectedFile(null)
  }

    const deleteModel = async (modelId: string) => {
    if (!confirm("Are you sure you want to delete this model?")) return

    try {
      const response = await fetch(`/api/models/${modelId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await loadModels()
        toast({ title: "Model deleted", description: `Model ${modelId} deleted.` })
      } else {
        const error = await response.json()
        alert(`Delete failed: ${error.error}`)
        toast({ title: "Delete failed", description: `Delete failed: ${error.error}` })
      }
    } catch (error: any) {
      console.error("Delete error:", error)
      alert("Delete failed. Please try again.")
      toast({ title: "Delete failed", description: "Delete failed. Please try again." })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Running": return "bg-success text-success-foreground"
      case "Pending": case "Initializing": return "bg-warning text-warning-foreground"
      case "Failed": return "bg-error text-error-foreground"
      case "Stopped": return "bg-muted text-muted-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Running": return <CheckCircle className="w-3 h-3 mr-1" />
      case "Pending": case "Initializing": return <Clock className="w-3 h-3 mr-1" />
      case "Failed": return <AlertCircle className="w-3 h-3 mr-1" />
      case "Stopped": return <XCircle className="w-3 h-3 mr-1" />
      default: return <Clock className="w-3 h-3 mr-1" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Model Management</h1>
          <p className="text-muted-foreground">Deploy and manage your LLM models.</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={loadActivityLogs}>
            <Eye className="w-4 h-4 mr-2" />
            View Logs
          </Button>

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
                <div className="space-y-2">
                  <Label htmlFor="model-name">Model Name *</Label>
                  <Input
                    id="model-name"
                    placeholder="e.g., my-custom-llama"
                    value={formData.modelName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, modelName: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Deployment Mode</Label>
                  <Select
                    value={formData.mode}
                    onValueChange={(value: any) => setFormData((prev) => ({ ...prev, mode: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama">Ollama (Local)</SelectItem>
                      <SelectItem value="onnx">ONNX Runtime (Local)</SelectItem>
                      <SelectItem value="huggingface">Hugging Face</SelectItem>
                      <SelectItem value="llama.cpp" disabled>llama.cpp (Not Supported)</SelectItem>
                      <SelectItem value="torch" disabled>PyTorch/TorchServe (Not Supported)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.mode === 'huggingface' ? (
                  <div className="space-y-2">
                    <Label htmlFor="hf-model-id">Hugging Face Model ID *</Label>
                    <Input
                      id="hf-model-id"
                      placeholder="e.g., meta-llama/Llama-2-7b-chat-hf"
                      value={formData.huggingFaceModelId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, huggingFaceModelId: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Model File *</Label>
                    <DragDropZone
                      acceptedTypes=".gguf,.bin,.safetensors,.onnx,.pth,.pt"
                      description="Upload .gguf, .bin, .safetensors, .onnx, or .pth/.pt files"
                      onFileSelect={(files) => setSelectedFile(files[0])}
                    />
                    {selectedFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                        </p>
                    )}
                  </div>
                )}


                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setShowUploadModal(false)} disabled={isDeploying}>
                    Cancel
                  </Button>
                  <Button onClick={handleFileUpload} disabled={isDeploying}>
                    {isDeploying ? (
                      <><Clock className="w-4 h-4 mr-2 animate-spin" /> Deploying...</>
                    ) : (
                      <><Cpu className="w-4 h-4 mr-2" /> Deploy Model</>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                          {model.mode} • Created{" "}
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
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteModel(model.id)}
                    >
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
    </div>
  )
}
