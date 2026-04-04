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
import { getModelStatusStyle } from "@/lib/status-styles"
import logger from "@/lib/logger"

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
  { value: "ollama", label: "Ollama (Local)", helper: "Local runtime deployment." },
  { value: "onnx", label: "ONNX Runtime (Local)", helper: "Optimized local ONNX runtime." },
  { value: "huggingface", label: "Hugging Face", helper: "Hosted model reference." },
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
  const [expandedModel, setExpandedModel] = useState<string | null>(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    modelName: "",
    huggingFaceModelId: "",
    mode: "ollama" as ModelData["mode"],
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
      if (document.hidden) { stopPolling() } else { loadModels(); startPolling() }
    }

    startPolling()
    document.addEventListener("visibilitychange", handleVisibility)
    return () => { stopPolling(); document.removeEventListener("visibilitychange", handleVisibility) }
  }, [])

  /**
   * Loads all deployed models from the API
   */
  const loadModels = async () => {
    try {
      const response = await fetch("/api/models")
      const data = await response.json()
      setModels(data.success ? data.models || [] : [])
    } catch (error) {
      logger.error("Failed to load models", { error: error instanceof Error ? error.message : String(error) })
      setModels([])
    }
  }

  /**
   * Loads deployment activity logs from the API
   */
  const loadActivityLogs = async () => {
    try {
      const response = await fetch("/api/models/logs")
      const data = await response.json()
      setActivityLogs(data.success ? data.logs || "No activity logs available." : "Failed to load activity logs.")
    } catch (error) {
      logger.error("Failed to load activity logs", { error: error instanceof Error ? error.message : String(error) })
      setActivityLogs("Error loading activity logs.")
    }
  }

  /**
   * Opens the logs modal and fetches the latest logs
   */
  const openLogsModal = async () => {
    setShowLogsModal(true)
    await loadActivityLogs()
  }

  /**
   * Validates form data and submits a new model deployment
   */
  const handleFileUpload = async () => {
    setUploadError(null)
    setUploading(true)

    if (!formData.modelName.trim()) { setUploadError("Model name is required."); setUploading(false); return }
    if (formData.mode !== "huggingface" && !selectedFile) { setUploadError("Select a model artifact."); setUploading(false); return }
    if (formData.mode === "huggingface" && !formData.huggingFaceModelId.trim()) { setUploadError("Hugging Face model ID is required."); setUploading(false); return }

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

      const response = await fetch("/api/activity", { method: "POST", body: payload })
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
      toast({ title: "Model deployment initiated", description: `Model ${formData.modelName} is being deployed.` })
    } catch (error) {
      logger.error("Deployment failed", { error: error instanceof Error ? error.message : String(error) })
      setUploadError("Deployment failed. Please try again.")
      toast({ title: "Deployment failed", description: "Please try again." })
    } finally {
      setTimeout(() => { setIsDeploying(false); setDeploymentProgress(0); setDeploymentStatus("") }, 500)
      setUploading(false)
    }
  }

  /**
   * Resets the deployment form to default values
   */
  const resetForm = () => {
    setFormData({ modelName: "", huggingFaceModelId: "", mode: "ollama", tokens: 2048, batchSize: 32, threads: 4, nPredict: 128, streamMode: true })
    setSelectedFile(null)
    setUploadError(null)
  }

  /**
   * Deletes a model deployment by ID
   * @param {string} modelId - The model to delete
   */
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
      toast({ title: "Model deleted", description: `Model removed from workspace.` })
    } catch (error) {
      logger.error("Failed to delete model", { error: error instanceof Error ? error.message : String(error) })
      toast({ title: "Delete failed", description: "Please try again." })
    }
  }

  /**
   * Returns the appropriate status icon for a model status
   * @param {ModelData["status"]} status - The model status
   * @returns {JSX.Element} Status icon
   */
  const getStatusIcon = (status: ModelData["status"]) => {
    switch (status) {
      case "Running": return <CheckCircle className="mr-1 icon-xs" />
      case "Pending": case "Initializing": return <Clock className="mr-1 icon-xs" />
      case "Failed": return <AlertCircle className="mr-1 icon-xs" />
      case "Stopped": return <XCircle className="mr-1 icon-xs" />
      default: return <Clock className="mr-1 icon-xs" />
    }
  }

  const runningModels = models.filter((m) => m.status === "Running").length
  const pendingModels = models.filter((m) => m.status === "Pending" || m.status === "Initializing").length
  const failedModels = models.filter((m) => m.status === "Failed").length
  const selectedModeMeta = deploymentModes.find((m) => m.value === formData.mode)

  return (
    <div className="space-y-6">
      {/* ── Compact header ── */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem]">Model deployments</h1>
          <p className="text-sm text-muted-foreground">Deploy runtimes, review status, and manage artifacts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 rounded-full border border-border/60 bg-surface/80 px-4 py-2 text-sm">
            <span className="text-muted-foreground">{models.length} total</span>
            <span className="font-medium text-success">{runningModels} running</span>
            {pendingModels > 0 && <span className="font-medium text-warning">{pendingModels} pending</span>}
            {failedModels > 0 && <span className="font-medium text-error">{failedModels} failed</span>}
          </div>
          <Button variant="outline" className="rounded-full border-border/70 bg-background/80" onClick={openLogsModal}>
            <Eye className="mr-2 icon-sm" />
            Logs
          </Button>
          <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-5">
                <Upload className="mr-2 icon-sm" />
                Deploy model
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl border-border/70 bg-background">
              <DialogHeader>
                <DialogTitle className="text-lg font-medium tracking-tight">Create a new deployment</DialogTitle>
              </DialogHeader>
              <Accordion type="multiple" defaultValue={["basics", "artifact"]} className="w-full pt-2">
                <AccordionItem value="basics" className="border-border/60">
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div>
                      <p className="text-sm font-semibold">Deployment basics</p>
                      <p className="text-xs font-normal text-muted-foreground">Name and runtime mode.</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="model-name">Model name</Label>
                        <Input
                          id="model-name"
                          placeholder="e.g. support-llama-v2"
                          value={formData.modelName}
                          onChange={(e) => setFormData((prev) => ({ ...prev, modelName: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Deployment mode</Label>
                        <Select value={formData.mode} onValueChange={(v: ModelData["mode"]) => setFormData((prev) => ({ ...prev, mode: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ollama">Ollama (Local)</SelectItem>
                            <SelectItem value="onnx">ONNX Runtime (Local)</SelectItem>
                            <SelectItem value="huggingface">Hugging Face</SelectItem>
                            <SelectItem value="llama.cpp" disabled>llama.cpp (Not supported)</SelectItem>
                            <SelectItem value="torch" disabled>PyTorch/TorchServe (Not supported)</SelectItem>
                          </SelectContent>
                        </Select>
                        {selectedModeMeta && <p className="text-xs text-muted-foreground">{selectedModeMeta.helper}</p>}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="artifact" className="border-border/60">
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div>
                      <p className="text-sm font-semibold">Artifact and source</p>
                      <p className="text-xs font-normal text-muted-foreground">Artifact or hosted model reference.</p>
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
                          onChange={(e) => setFormData((prev) => ({ ...prev, huggingFaceModelId: e.target.value }))}
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
                        {selectedFile && (
                          <div className="rounded-xl border border-border/70 bg-surface-secondary px-4 py-3 text-sm">
                            <span className="font-medium">{selectedFile.name}</span>
                            <span className="ml-2 text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {isDeploying && (
                <div className="rounded-xl border border-border/70 bg-surface-secondary p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{deploymentStatus || "Starting deployment"}</span>
                    <span>{deploymentProgress}%</span>
                  </div>
                  <Progress value={deploymentProgress} />
                </div>
              )}

              {uploadError && (
                <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{uploadError}</div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" className="rounded-full" onClick={() => setShowUploadModal(false)} disabled={isDeploying}>Cancel</Button>
                <Button className="rounded-full px-5" onClick={handleFileUpload} disabled={isDeploying}>
                  {isDeploying ? <><Clock className="mr-2 icon-sm animate-spin" />Deploying</> : <><Cpu className="mr-2 icon-sm" />Start deployment</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* ── Model list ── */}
      <Card className="border-border/70 bg-surface/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Current deployments</CardTitle>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <div className="flex h-[20rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/70">
              <div className="text-center">
                <Cpu className="mx-auto mb-3 icon-lg text-muted-foreground/50" />
                <h3 className="font-medium">No models deployed yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Start a deployment to populate this workspace.</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[28rem]">
              <div className="space-y-2 pr-3">
                {models.map((model) => {
                  const isOpen = expandedModel === model.id
                  return (
                    <div key={model.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/80">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-secondary/50"
                        onClick={() => setExpandedModel(isOpen ? null : model.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-info/10 p-1.5">
                            <Cpu className="icon-sm text-info" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{model.modelName}</p>
                            <p className="text-[11px] text-muted-foreground">{model.mode} · {new Date(model.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {model.port && (
                            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[10px]">:{model.port}</Badge>
                          )}
                          <Badge className={`rounded-full text-[10px] ${getModelStatusStyle(model.status)}`}>
                            {getStatusIcon(model.status)}
                            {model.status}
                          </Badge>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-border/60 px-4 pb-4 pt-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tokens</p>
                              <p className="mt-1 text-sm font-semibold">{model.tokens}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Batch size</p>
                              <p className="mt-1 text-sm font-semibold">{model.batchSize}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Storage</p>
                              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                                <HardDrive className="icon-xs text-muted-foreground" />
                                {model.size ? `${(model.size / 1024 / 1024).toFixed(0)} MB` : "Unknown"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 rounded-full px-3 text-xs" onClick={() => setModelToDelete(model)}>
                              <Trash2 className="mr-1.5 icon-xs" />Delete
                            </Button>
                            {model.filePath && !model.filePath.startsWith("http") && (
                              <a
                                href={`/api/models/${model.id}/download`}
                                download
                                className="inline-flex h-7 items-center rounded-full border border-border/70 bg-background px-3 text-xs font-medium transition-colors hover:bg-surface-secondary"
                              >
                                <Download className="mr-1.5 icon-xs" />Download
                              </a>
                            )}
                          </div>
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

      {/* ── Logs modal ── */}
      <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
        <DialogContent className="max-w-3xl rounded-2xl border-border/70 bg-background">
          <DialogHeader>
            <DialogTitle className="text-base font-medium tracking-tight">Activity logs</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[24rem] rounded-xl border border-border/70 bg-surface-secondary">
            <pre className="whitespace-pre-wrap p-4 text-xs leading-6 text-muted-foreground">
              {activityLogs || "Loading logs..."}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!modelToDelete} onOpenChange={(open) => { if (!open) setModelToDelete(null) }}>
        <AlertDialogContent className="rounded-2xl border-border/70 bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-medium tracking-tight">Delete deployment</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <span className="font-medium text-foreground">{modelToDelete?.modelName}</span> from the workspace?
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-error text-white hover:bg-error/90"
              onClick={() => { if (modelToDelete) void deleteModel(modelToDelete.id) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
