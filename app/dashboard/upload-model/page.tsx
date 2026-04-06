"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Cpu,
  ExternalLink,
  Loader2,
  Play,
  Search,
  Trash2,
  Unplug,
  Zap,
} from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { getModelStatusStyle } from "@/lib/status-styles"
import logger from "@/lib/logger"

interface ModelData {
  id: string
  modelName: string
  huggingFaceModelId: string
  task: string
  status: "Pending" | "Running" | "Loading" | "Failed"
  inferenceProvider?: string
  statusError?: string
  config: { maxTokens: number; temperature: number; topP: number }
  createdAt: string
  lastActivity?: string
  metrics?: { totalRequests: number; avgLatencyMs: number; lastError: string | null }
}

interface HFSearchResult {
  id: string
  modelId: string
  pipeline_tag: string | null
  downloads: number
  likes: number
  lastModified: string
  library_name?: string
  inferenceProviderMapping?: Record<string, unknown>
}

interface HFUser {
  hfUsername: string
  hfConnectedAt: string
}

const PIPELINE_TAGS = [
  { value: "", label: "All tasks" },
  { value: "text-generation", label: "Text Generation" },
  { value: "text-classification", label: "Text Classification" },
  { value: "summarization", label: "Summarization" },
  { value: "translation", label: "Translation" },
  { value: "question-answering", label: "Question Answering" },
  { value: "fill-mask", label: "Fill Mask" },
  { value: "token-classification", label: "Token Classification" },
  { value: "text2text-generation", label: "Text-to-Text" },
  { value: "feature-extraction", label: "Feature Extraction" },
  { value: "image-classification", label: "Image Classification" },
  { value: "zero-shot-classification", label: "Zero-shot Classification" },
]

export default function UploadModelPage() {
  const [models, setModels] = useState<ModelData[]>([])
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [modelToDelete, setModelToDelete] = useState<ModelData | null>(null)
  const [expandedModel, setExpandedModel] = useState<string | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)
  const [hfUser, setHfUser] = useState<HFUser | null>(null)
  const [hfLoading, setHfLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchTask, setSearchTask] = useState("")
  const [searchResults, setSearchResults] = useState<HFSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedHFModel, setSelectedHFModel] = useState<HFSearchResult | null>(null)

  const [deployName, setDeployName] = useState("")
  const [deployHFId, setDeployHFId] = useState("")
  const [deployTask, setDeployTask] = useState("text-generation")

  const [disconnecting, setDisconnecting] = useState(false)
  const [inferModelId, setInferModelId] = useState<string | null>(null)
  const [inferInput, setInferInput] = useState("")
  const [inferResult, setInferResult] = useState<string | null>(null)
  const [inferring, setInferring] = useState(false)
  const [inferLatency, setInferLatency] = useState<number | null>(null)

  const { toast } = useToast()
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Loads all registered models from the API
   */
  const loadModels = useCallback(async () => {
    try {
      const response = await fetch("/api/models")
      const data = await response.json()
      setModels(data.success ? data.models || [] : [])
    } catch (error) {
      logger.error("Failed to load models", { error: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  /**
   * Checks whether a HF account is connected
   */
  const checkHfConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status")
      const data = await res.json()
      if (data.success && data.user?.hfUsername) {
        setHfUser({ hfUsername: data.user.hfUsername, hfConnectedAt: data.user.hfConnectedAt })
      } else {
        setHfUser(null)
      }
    } catch {
      setHfUser(null)
    } finally {
      setHfLoading(false)
    }
  }, [])

  useEffect(() => {
    loadModels()
    checkHfConnection()

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
      if (document.hidden) stopPolling()
      else { loadModels(); startPolling() }
    }

    startPolling()
    document.addEventListener("visibilitychange", handleVisibility)
    return () => { stopPolling(); document.removeEventListener("visibilitychange", handleVisibility) }
  }, [loadModels, checkHfConnection])

  /**
   * Searches HF Hub models with debounce
   * @param {string} q - Search query
   * @param {string} task - Pipeline tag filter
   */
  const searchModels = useCallback(async (q: string, task: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const params = new URLSearchParams({ q })
      if (task) params.set("task", task)
      const res = await fetch(`/api/models/search?${params.toString()}`)
      const data = await res.json()
      setSearchResults(data.success ? data.models || [] : [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  /**
   * Handles search input with debounce
   * @param {string} value - New search query
   */
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => searchModels(value, searchTask), 400)
  }

  /**
   * Handles task filter change
   * @param {string} value - New task filter
   */
  const handleTaskChange = (value: string) => {
    const resolved = value === "__all__" ? "" : value
    setSearchTask(resolved)
    if (searchQuery.trim()) searchModels(searchQuery, resolved)
  }

  /**
   * Selects a search result for deployment
   * @param {HFSearchResult} model - The selected model
   */
  const selectSearchResult = (model: HFSearchResult) => {
    setSelectedHFModel(model)
    setDeployHFId(model.id)
    setDeployTask(model.pipeline_tag || "text-generation")
    setDeployName(model.id.split("/").pop() || model.id)
  }

  /**
   * Submits the deployment form — registers the model
   */
  const handleDeploy = async () => {
    if (!deployName.trim()) { toast({ title: "Name required" }); return }
    if (!deployHFId.trim()) { toast({ title: "HF model ID required" }); return }

    setIsDeploying(true)
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelName: deployName,
          huggingFaceModelId: deployHFId,
          task: deployTask,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast({ title: "Deploy failed", description: data.error })
        return
      }

      toast({ title: "Model registered", description: data.message })
      setShowDeployDialog(false)
      resetDeployForm()
      await loadModels()
    } catch (error) {
      logger.error("Deploy error", { error: error instanceof Error ? error.message : String(error) })
      toast({ title: "Deploy failed", description: "Please try again." })
    } finally {
      setIsDeploying(false)
    }
  }

  /**
   * Resets deploy form state
   */
  const resetDeployForm = () => {
    setDeployName("")
    setDeployHFId("")
    setDeployTask("text-generation")
    setSelectedHFModel(null)
    setSearchQuery("")
    setSearchResults([])
  }

  /**
   * Deletes a model from the workspace
   * @param {string} modelId - Model to remove
   */
  const deleteModel = async (modelId: string) => {
    try {
      const response = await fetch(`/api/models/${modelId}`, { method: "DELETE" })
      if (!response.ok) {
        const error = await response.json()
        toast({ title: "Delete failed", description: error.error })
        return
      }
      await loadModels()
      setModelToDelete(null)
      toast({ title: "Model deleted" })
    } catch (error) {
      logger.error("Delete failed", { error: error instanceof Error ? error.message : String(error) })
      toast({ title: "Delete failed" })
    }
  }

  /**
   * Runs a test inference on a model
   * @param {string} modelId - The model to infer on
   */
  const runInference = async (modelId: string) => {
    if (!inferInput.trim()) return
    setInferring(true)
    setInferResult(null)
    setInferLatency(null)
    try {
      const res = await fetch(`/api/models/${modelId}/infer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: inferInput }),
      })
      const data = await res.json()
      setInferLatency(data.latencyMs || null)

      if (data.isLoading) {
        setInferResult(`Model is loading. Estimated time: ${data.estimatedTime}s. Try again shortly.`)
        return
      }

      if (!data.success) {
        setInferResult(`Error: ${data.error}`)
        return
      }

      if (typeof data.output === "string") {
        setInferResult(data.output)
      } else if (Array.isArray(data.output)) {
        const first = data.output[0]
        if (first?.generated_text) setInferResult(first.generated_text)
        else if (first?.label) setInferResult(`${first.label}: ${(first.score * 100).toFixed(1)}%`)
        else if (first?.summary_text) setInferResult(first.summary_text)
        else setInferResult(JSON.stringify(data.output, null, 2))
      } else {
        setInferResult(JSON.stringify(data.output, null, 2))
      }
    } catch (error) {
      setInferResult(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setInferring(false)
    }
  }

  /**
   * Disconnects the Hugging Face account
   */
  const disconnectHF = async () => {
    setDisconnecting(true)
    try {
      await fetch("/api/auth/huggingface/disconnect", { method: "POST" })
      setHfUser(null)
      toast({ title: "Hugging Face disconnected" })
    } catch {
      toast({ title: "Disconnect failed" })
    } finally {
      setDisconnecting(false)
    }
  }

  /**
   * Returns the appropriate status icon for a model status
   * @param {ModelData["status"]} status - The model status
   * @returns {JSX.Element} Status icon
   */
  const getStatusIcon = (status: ModelData["status"]) => {
    switch (status) {
      case "Running": return <CheckCircle className="mr-1 h-3 w-3" />
      case "Pending": case "Loading": return <Clock className="mr-1 h-3 w-3" />
      case "Failed": return <AlertCircle className="mr-1 h-3 w-3" />
      default: return <Clock className="mr-1 h-3 w-3" />
    }
  }

  /**
   * Formats large numbers compactly (1200 -> "1.2k")
   * @param {number} n - Number to format
   * @returns {string} Formatted string
   */
  const formatCount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return String(n)
  }

  const runningModels = models.filter((m) => m.status === "Running").length
  const pendingModels = models.filter((m) => m.status === "Pending" || m.status === "Loading").length
  const failedModels = models.filter((m) => m.status === "Failed").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-slide-up-fade">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem] font-display">Model deployments</h1>
          <p className="text-sm text-muted-foreground">Register Hugging Face models and test inference.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* HF connection status */}
          {hfLoading ? (
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/80 px-4 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking HF...
            </div>
          ) : hfUser ? (
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/80 px-3 py-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                <CheckCircle className="h-3 w-3 text-success" />
              </div>
              <span className="text-xs font-medium">{hfUser.hfUsername}</span>
              <button onClick={disconnectHF} disabled={disconnecting} className="ml-1 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-error disabled:opacity-50">
                {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="rounded-full border-border/70 bg-background/80 text-sm"
              onClick={() => { window.location.href = "/api/auth/huggingface" }}
            >
              <Zap className="mr-2 h-3.5 w-3.5" />
              Connect Hugging Face
            </Button>
          )}

          {/* Stats pill */}
          <div className="flex items-center gap-4 rounded-full border border-border/60 bg-surface/80 px-4 py-2 text-sm">
            <span className="text-muted-foreground">{models.length} total</span>
            <span className="font-medium text-success">{runningModels} running</span>
            {pendingModels > 0 && <span className="font-medium text-warning">{pendingModels} pending</span>}
            {failedModels > 0 && <span className="font-medium text-error">{failedModels} failed</span>}
          </div>

          {/* Deploy button */}
          <Dialog open={showDeployDialog} onOpenChange={(o) => { setShowDeployDialog(o); if (!o) resetDeployForm() }}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-5" disabled={!hfUser}>
                <Cpu className="mr-2 h-4 w-4" />
                Deploy model
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-border/70 bg-background">
              <DialogHeader>
                <DialogTitle className="text-lg font-medium tracking-tight">Register a model</DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="hub" className="w-full pt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="hub" className="flex-1">From HF Hub</TabsTrigger>
                  <TabsTrigger value="custom" className="flex-1">Custom Model</TabsTrigger>
                </TabsList>

                {/* HF Hub search tab */}
                <TabsContent value="hub" className="space-y-4 pt-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search models..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                      />
                    </div>
                    <Select value={searchTask || "__all__"} onValueChange={handleTaskChange}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All tasks" />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_TAGS.map((t) => (
                          <SelectItem key={t.value} value={t.value || "__all__"}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {searching && (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching HF Hub...
                    </div>
                  )}

                  {!searching && searchResults.length > 0 && (
                    <ScrollArea className="h-[240px]">
                      <div className="space-y-1.5 pr-3">
                        {searchResults.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => selectSearchResult(m)}
                            className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                              selectedHFModel?.id === m.id
                                ? "border-primary/50 bg-primary/5"
                                : "border-border/60 bg-background/80 hover:bg-surface-secondary/50"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium">{m.id}</p>
                                {m.inferenceProviderMapping && Object.keys(m.inferenceProviderMapping).length > 0 ? (
                                  <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-medium text-success">Inference</span>
                                ) : (
                                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">No API</span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                                {m.pipeline_tag && <span>{m.pipeline_tag}</span>}
                                <span>{formatCount(m.downloads)} downloads</span>
                                <span>{formatCount(m.likes)} likes</span>
                              </div>
                            </div>
                            {selectedHFModel?.id === m.id && (
                              <CheckCircle className="ml-2 h-4 w-4 shrink-0 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {!searching && searchQuery && searchResults.length === 0 && (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                      No models found. Try a different query.
                    </div>
                  )}
                </TabsContent>

                {/* Custom model tab */}
                <TabsContent value="custom" className="space-y-4 pt-4">
                  <div className="rounded-xl border border-border/60 bg-surface-secondary/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      Upload your model to{" "}
                      <a
                        href="https://huggingface.co/new"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Hugging Face Hub
                      </a>{" "}
                      first, then enter the model ID below.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-hf-id">Hugging Face Model ID</Label>
                    <Input
                      id="custom-hf-id"
                      placeholder="e.g. username/my-custom-model"
                      value={deployHFId}
                      onChange={(e) => setDeployHFId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-task">Task type</Label>
                    <Select value={deployTask} onValueChange={setDeployTask}>
                      <SelectTrigger id="custom-task">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_TAGS.filter((t) => t.value).map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Deploy config */}
              {deployHFId && (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="deploy-name">Display name</Label>
                    <Input
                      id="deploy-name"
                      placeholder="e.g. my-sentiment-classifier"
                      value={deployName}
                      onChange={(e) => setDeployName(e.target.value)}
                    />
                  </div>
                  <div className="rounded-xl border border-border/60 bg-surface-secondary/50 px-3.5 py-2.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{deployHFId}</span>
                    {deployTask && <> · {deployTask}</>}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" className="rounded-full" onClick={() => setShowDeployDialog(false)} disabled={isDeploying}>
                  Cancel
                </Button>
                <Button className="rounded-full px-5" onClick={handleDeploy} disabled={isDeploying || !deployHFId.trim() || !deployName.trim()}>
                  {isDeploying ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering</>
                  ) : (
                    <><ArrowRight className="mr-2 h-4 w-4" />Register model</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* Model list */}
      <Card className="border-border/70 bg-surface/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground font-display">Registered models</CardTitle>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <div className="flex h-[20rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/70">
              <div className="text-center">
                <Cpu className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <h3 className="font-medium">No models registered</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hfUser
                    ? "Deploy a model to get started."
                    : "Connect your Hugging Face account to get started."}
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[28rem]">
              <div className="space-y-2 pr-3">
                {models.map((model) => {
                  const isOpen = expandedModel === model.id
                  const isInferOpen = inferModelId === model.id
                  return (
                    <div key={model.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/80">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-secondary/50"
                        onClick={() => setExpandedModel(isOpen ? null : model.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-lg bg-info/10 p-1.5 shrink-0">
                            <Cpu className="h-4 w-4 text-info" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{model.modelName}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{model.huggingFaceModelId} · {model.task}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {model.metrics && model.metrics.totalRequests > 0 && (
                            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[10px]">
                              {model.metrics.totalRequests} req
                            </Badge>
                          )}
                          <Badge className={`rounded-full text-[10px] ${getModelStatusStyle(model.status)}`}>
                            {getStatusIcon(model.status)}
                            {model.status}
                          </Badge>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-border/60 px-4 pb-4 pt-3 animate-slide-up-fade">
                          {model.status === "Failed" && model.statusError && (
                            <div className="mb-3 rounded-lg border border-error/20 bg-error/5 px-3 py-2">
                              <p className="text-xs text-error">{model.statusError}</p>
                            </div>
                          )}

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Task</p>
                              <p className="mt-1 text-sm font-semibold">{model.task}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Provider</p>
                              <p className="mt-1 text-sm font-semibold">{model.inferenceProvider || "—"}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-surface-secondary p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Requests</p>
                              <p className="mt-1 text-sm font-semibold font-mono tabular-nums">{model.metrics?.totalRequests || 0}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <a
                              href={`https://huggingface.co/${model.huggingFaceModelId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 items-center rounded-full border border-border/70 bg-background px-3 text-xs font-medium transition-colors hover:bg-surface-secondary"
                            >
                              <ExternalLink className="mr-1.5 h-3 w-3" />View on HF
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full px-3 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setInferModelId(isInferOpen ? null : model.id)
                                setInferInput("")
                                setInferResult(null)
                                setInferLatency(null)
                              }}
                            >
                              <Play className="mr-1.5 h-3 w-3" />Test inference
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full px-3 text-xs text-muted-foreground hover:text-error"
                              onClick={(e) => { e.stopPropagation(); setModelToDelete(model) }}
                            >
                              <Trash2 className="mr-1.5 h-3 w-3" />Delete
                            </Button>
                          </div>

                          {/* Inline inference test panel */}
                          {isInferOpen && (
                            <div className="mt-3 space-y-3 rounded-xl border border-border/60 bg-surface-secondary p-3">
                              <Textarea
                                placeholder="Enter your prompt..."
                                value={inferInput}
                                onChange={(e) => setInferInput(e.target.value)}
                                className="min-h-[80px] resize-none text-sm"
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 rounded-full px-4 text-xs"
                                  onClick={() => runInference(model.id)}
                                  disabled={inferring || !inferInput.trim()}
                                >
                                  {inferring ? (
                                    <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Running</>
                                  ) : (
                                    <><Play className="mr-1.5 h-3 w-3" />Run</>
                                  )}
                                </Button>
                                {inferLatency !== null && (
                                  <Badge variant="outline" className="rounded-full text-[10px]">
                                    {inferLatency}ms
                                  </Badge>
                                )}
                              </div>
                              {inferResult && (
                                <div className="rounded-lg border border-border/60 bg-background p-3">
                                  <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                                    {inferResult}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
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

      {/* Delete confirmation */}
      <AlertDialog open={!!modelToDelete} onOpenChange={(open) => { if (!open) setModelToDelete(null) }}>
        <AlertDialogContent className="rounded-2xl border-border/70 bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-medium tracking-tight">Remove model</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <span className="font-medium text-foreground">{modelToDelete?.modelName}</span> from the workspace?
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-error text-white hover:bg-error/90"
              onClick={(e) => {
                e.preventDefault()
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
