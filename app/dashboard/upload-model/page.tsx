"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Cpu,
  Download,
  Eye,
  HardDrive,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"

import { DragDropZone } from "@/components/drag-drop-zone"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

const deploymentModes = [
  {
    value: "ollama",
    label: "Ollama (Local)",
    helper: "Local runtime deployment.",
  },
  {
    value: "onnx",
    label: "ONNX Runtime (Local)",
    helper: "Optimized local ONNX runtime.",
  },
  {
    value: "huggingface",
    label: "Hugging Face",
    helper: "Hosted model reference.",
  },
]

export default function UploadModelPage() {
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentProgress, setDeploymentProgress] = useState(0)
  const [deploymentStatus, setDeploymentStatus] = useState("")
  const [models, setModels] = useState<ModelData[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showLogsModal, setShowLogsModal] = useState(false)
  const [activityLogs, setActivityLogs] = useState("")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [modelToDelete, setModelToDelete] = useState<ModelData | null>(null)
  const { toast } = useToast()

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

    const startPolling = () => {
      if (pollingRef.current) return
      pollingRef.current = setInterval(() => {
        if (!document.hidden) loadModels()
      }, 10000)
    }

    const stopPolling = () => {
      if (!pollingRef.current) return
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        loadModels()
        startPolling()
      }
    }

    startPolling()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  const loadModels = async () => {
    try {
      const response = await fetch("/api/models")
      const data = await response.json()
      if (data.success) {
        setModels(data.models || [])
      } else {
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
        setActivityLogs("Failed to load activity logs. Please try again.")
      }
    } catch (error) {
      console.error("Failed to load logs:", error)
      setActivityLogs("Error loading activity logs. Please check your connection and try again.")
    }
  }

  const openLogsModal = async () => {
    setShowLogsModal(true)
    await loadActivityLogs()
  }

  const handleFileUpload = async () => {
    setUploadError(null)
    setUploading(true)

    if (!formData.modelName.trim()) {
      setUploadError("Please provide a model name before starting deployment.")
      setUploading(false)
      return
    }

    if (formData.mode !== "huggingface" && !selectedFile) {
      setUploadError("Please select a model file for this deployment mode.")
      setUploading(false)
      return
    }

    if (formData.mode === "huggingface" && !formData.huggingFaceModelId.trim()) {
      setUploadError("Please provide a Hugging Face model ID.")
      setUploading(false)
      return
    }

    setIsDeploying(true)
    setDeploymentProgress(25)
    setDeploymentStatus("Preparing deployment package")

    try {
      const payload = new FormData()

      if (formData.mode === "huggingface") {
        payload.append("huggingFaceModelId", formData.huggingFaceModelId)
      } else if (selectedFile) {
        payload.append("modelFile", selectedFile)
      }

      payload.append("modelName", formData.modelName)
      payload.append("mode", formData.mode)
      payload.append("tokens", formData.tokens.toString())
      payload.append("batchSize", formData.batchSize.toString())
      payload.append("threads", formData.threads.toString())
      payload.append("nPredict", formData.nPredict.toString())
      payload.append("streamMode", formData.streamMode.toString())

      setDeploymentProgress(60)
      setDeploymentStatus("Sending deployment request")

      const response = await fetch("/api/activity", {
        method: "POST",
        body: payload,
      })

      if (!response.ok) {
        const error = await response.json()
        setUploadError(error.error || "Deployment failed.")
        toast({ title: "Deployment failed", description: error.error || "Deployment failed." })
        return
      }

      setDeploymentProgress(100)
      setDeploymentStatus("Deployment request accepted")
      await loadModels()
      setShowUploadModal(false)
      resetForm()
      toast({
        title: "Model deployment initiated",
        description: `Model ${formData.modelName} is being deployed.`,
      })
    } catch (error) {
      console.error("Deployment error:", error)
      setUploadError("Deployment failed. Please try again.")
      toast({ title: "Deployment failed", description: "Deployment failed. Please try again." })
    } finally {
      setTimeout(() => {
        setIsDeploying(false)
        setDeploymentProgress(0)
        setDeploymentStatus("")
      }, 500)
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
    setUploadError(null)
  }

  const deleteModel = async (modelId: string) => {
    try {
      const response = await fetch(`/api/models/${modelId}`, { method: "DELETE" })
      if (!response.ok) {
        const error = await response.json()
        toast({ title: "Delete failed", description: error.error || "Delete failed." })
        return
      }
      await loadModels()
      setModelToDelete(null)
      toast({ title: "Model deleted", description: `Model ${modelId} deleted.` })
    } catch (error) {
      console.error("Delete error:", error)
      toast({ title: "Delete failed", description: "Delete failed. Please try again." })
    }
  }

  const getStatusBadge = (status: ModelData["status"]) => {
    switch (status) {
      case "Running":
        return "bg-success/10 text-success hover:bg-success/10"
      case "Pending":
      case "Initializing":
        return "bg-warning/10 text-warning hover:bg-warning/10"
      case "Failed":
        return "bg-error/10 text-error hover:bg-error/10"
      default:
        return "bg-muted text-muted-foreground hover:bg-muted"
    }
  }

  const getStatusIcon = (status: ModelData["status"]) => {
    switch (status) {
      case "Running":
        return <CheckCircle className="mr-1 h-3 w-3" />
      case "Pending":
      case "Initializing":
        return <Clock className="mr-1 h-3 w-3" />
      case "Failed":
        return <AlertCircle className="mr-1 h-3 w-3" />
      case "Stopped":
        return <XCircle className="mr-1 h-3 w-3" />
      default:
        return <Clock className="mr-1 h-3 w-3" />
    }
  }

  const runningModels = models.filter((model) => model.status === "Running").length
  const pendingModels = models.filter((model) => model.status === "Pending" || model.status === "Initializing").length
  const selectedModeMeta = deploymentModes.find((mode) => mode.value === formData.mode)

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-4">
                <Badge variant="outline" className="w-fit rounded-full border-border/70 bg-background px-3 py-1">
                  Model operations
                </Badge>
                <div className="space-y-2">
                  <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[2rem]">Model deployments</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Deploy runtimes, review status, and manage artifacts from one workspace.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="rounded-full border-border/70 bg-background/80" onClick={openLogsModal}>
                  <Eye className="mr-2 h-4 w-4" />
                  View logs
                </Button>
                <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full px-5">
                      <Upload className="mr-2 h-4 w-4" />
                      Deploy new model
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl border-border/70 bg-background">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-medium tracking-tight">Create a new deployment</DialogTitle>
                    </DialogHeader>
                    <Accordion type="multiple" defaultValue={["basics", "artifact"]} className="w-full pt-2">
                      <AccordionItem value="basics" className="border-border/60">
                        <AccordionTrigger className="py-4 hover:no-underline">
                          <div>
                            <p className="text-base font-semibold">Deployment basics</p>
                            <p className="text-sm font-normal text-muted-foreground">Name and runtime mode.</p>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="model-name">Model name</Label>
                              <Input
                                id="model-name"
                                placeholder="e.g. support-llama-v2"
                                value={formData.modelName}
                                onChange={(event) => setFormData((prev) => ({ ...prev, modelName: event.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Deployment mode</Label>
                              <Select
                                value={formData.mode}
                                onValueChange={(value: ModelData["mode"]) => setFormData((prev) => ({ ...prev, mode: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                  <SelectItem value="onnx">ONNX Runtime (Local)</SelectItem>
                                  <SelectItem value="huggingface">Hugging Face</SelectItem>
                                  <SelectItem value="llama.cpp" disabled>
                                    llama.cpp (Not supported)
                                  </SelectItem>
                                  <SelectItem value="torch" disabled>
                                    PyTorch/TorchServe (Not supported)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {selectedModeMeta ? <p className="text-xs leading-5 text-muted-foreground">{selectedModeMeta.helper}</p> : null}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="artifact" className="border-border/60">
                        <AccordionTrigger className="py-4 hover:no-underline">
                          <div>
                            <p className="text-base font-semibold">Artifact and source</p>
                            <p className="text-sm font-normal text-muted-foreground">Artifact or hosted model reference.</p>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {formData.mode === "huggingface" ? (
                            <div className="space-y-2">
                              <Label htmlFor="hf-model-id">Hugging Face model ID</Label>
                              <Input
                                id="hf-model-id"
                                placeholder="e.g. meta-llama/Llama-2-7b-chat-hf"
                                value={formData.huggingFaceModelId}
                                onChange={(event) => setFormData((prev) => ({ ...prev, huggingFaceModelId: event.target.value }))}
                              />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <Label>Model artifact</Label>
                              <DragDropZone
                                acceptedTypes=".gguf,.bin,.safetensors,.onnx,.pth,.pt"
                                description="Upload .gguf, .bin, .safetensors, .onnx, or .pth/.pt files"
                                onFileSelect={(files) => setSelectedFile(files[0])}
                              />
                              {selectedFile ? (
                                <div className="rounded-2xl border border-border/70 bg-surface/70 p-4 text-sm">
                                  <div className="font-medium">{selectedFile.name}</div>
                                  <div className="text-muted-foreground">
                                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB ready for upload
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {isDeploying ? (
                      <div className="rounded-3xl border border-border/70 bg-surface/70 p-5">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span>{deploymentStatus || "Starting deployment"}</span>
                          <span>{deploymentProgress}%</span>
                        </div>
                        <Progress value={deploymentProgress} />
                      </div>
                    ) : null}

                    {uploadError ? (
                      <div className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">{uploadError}</div>
                    ) : null}

                    <div className="flex justify-end gap-3">
                      <Button variant="outline" className="rounded-full" onClick={() => setShowUploadModal(false)} disabled={isDeploying}>
                        Cancel
                      </Button>
                      <Button className="rounded-full px-5" onClick={handleFileUpload} disabled={isDeploying}>
                        {isDeploying ? (
                          <>
                            <Clock className="mr-2 h-4 w-4 animate-spin" />
                            Deploying
                          </>
                        ) : (
                          <>
                            <Cpu className="mr-2 h-4 w-4" />
                            Start deployment
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-gradient-to-br from-background to-surface-secondary shadow-sm">
          <CardContent className="grid h-full gap-4 p-6 md:p-8">
            <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
              <p className="text-sm font-medium text-muted-foreground">Deployed models</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{models.length}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                <p className="text-sm font-medium text-muted-foreground">Running</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-success">{runningModels}</p>
              </div>
              <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-warning">{pendingModels}</p>
              </div>
            </div>
            <div className="rounded-3xl border border-border/60 bg-background/80 p-5">
              <p className="text-sm font-medium">Workspace note</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Long deployment lists stay collapsed by default.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70 bg-surface/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Current deployments</CardTitle>
        </CardHeader>
        <CardContent>
          {uploading ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 py-10 text-center text-sm text-muted-foreground">
              Loading models...
            </div>
          ) : models.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 py-12 text-center">
              <Cpu className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No models deployed yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">Start a deployment to populate this workspace.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[38rem] pr-4">
              <Accordion type="multiple" defaultValue={models.slice(0, 1).map((model) => model.id)} className="w-full">
                {models.map((model) => (
                  <AccordionItem
                    key={model.id}
                    value={model.id}
                    className="mb-3 overflow-hidden rounded-3xl border border-border/70 bg-background/80 px-5 shadow-sm"
                  >
                    <AccordionTrigger className="py-5 text-left hover:no-underline">
                      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="rounded-2xl bg-info/10 p-3">
                            <Cpu className="h-5 w-5 text-info" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold">{model.modelName}</p>
                            <p className="text-sm font-normal text-muted-foreground">
                              {model.mode} / Created {new Date(model.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={`rounded-full ${getStatusBadge(model.status)}`}>
                            {getStatusIcon(model.status)}
                            {model.status}
                          </Badge>
                          {model.port ? (
                            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-3 py-1">
                              Port {model.port}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1">
                      <div className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tokens</p>
                            <p className="mt-2 text-lg font-semibold">{model.tokens}</p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Batch size</p>
                            <p className="mt-2 text-lg font-semibold">{model.batchSize}</p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Storage</p>
                            <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
                              <HardDrive className="h-4 w-4 text-muted-foreground" />
                              {model.size ? `${(model.size / 1024 / 1024).toFixed(0)} MB` : "Unknown"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setModelToDelete(model)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                          {model.filePath && !model.filePath.startsWith("http") ? (
                            <a
                              href={`/api/models/${model.id}/download`}
                              download
                              className="inline-flex items-center rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-surface"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download artifact
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
        <DialogContent className="max-w-4xl rounded-3xl border-border/70 bg-background">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium tracking-tight">Activity logs</DialogTitle>
          </DialogHeader>
          <div className="rounded-3xl border border-border/70 bg-surface/70 p-4">
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {activityLogs || "Loading logs..."}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!modelToDelete}
        onOpenChange={(open) => {
          if (!open) setModelToDelete(null)
        }}
      >
        <AlertDialogContent className="rounded-3xl border-border/70 bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold tracking-tight">Delete deployment</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm leading-6 text-muted-foreground">
            Remove <span className="font-medium text-foreground">{modelToDelete?.modelName}</span> from the workspace?
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-error text-white hover:bg-error/90"
              onClick={() => {
                if (modelToDelete) void deleteModel(modelToDelete.id)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
