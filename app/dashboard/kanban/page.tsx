"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle, Clock, GripVertical, Plus, RefreshCw, XCircle } from "lucide-react"
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd"

import { KanbanCard } from "@/components/kanban-card"
import { useToast } from "@/hooks/use-toast"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type KanbanColumnId = "to-test" | "in-progress" | "deployed" | "failed"
type KanbanItemType = "api" | "model"

interface ModelDetails {
  name: string
  status: string
  latency: number | null
  tokensPerSec: number | null
  requestsPerSec: number | null
  gpu: string
  memory: string
}

interface KanbanItem {
  id: string
  title: string
  type: KanbanItemType
  description: string
  status: string
  lastUpdated: string
  modelDetails?: ModelDetails
}

interface KanbanColumn {
  id: KanbanColumnId
  title: string
  description: string
  items: KanbanItem[]
}

const COLUMN_ORDER: Array<{ id: KanbanColumnId; title: string; description: string }> = [
  { id: "to-test", title: "To test", description: "New work waiting for coverage or initial validation." },
  { id: "in-progress", title: "In progress", description: "Actively being reviewed, tested, or deployed." },
  { id: "deployed", title: "Deployed", description: "Assets that have cleared the current workflow." },
  { id: "failed", title: "Failed", description: "Work that needs follow-up before moving forward." },
]

const EMPTY_FORM = {
  title: "",
  type: "api" as KanbanItemType,
  description: "",
  status: "to-test" as KanbanColumnId,
}

export default function KanbanPage() {
  const { toast } = useToast()
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<KanbanItem | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleteItem, setDeleteItem] = useState<KanbanItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void fetchKanban()
  }, [])

  async function fetchKanban() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/kanban")
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to load kanban board")
      }

      const items = (data.items || []) as KanbanItem[]
      setColumns(
        COLUMN_ORDER.map((column) => ({
          ...column,
          items: items.filter((item) => item.status === column.id),
        })),
      )
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unknown error"
      setError(message)
      toast({
        title: "Board unavailable",
        description: message,
        variant: "destructive",
      })
      setColumns(COLUMN_ORDER.map((column) => ({ ...column, items: [] })))
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetchKanban()
    setRefreshing(false)
  }

  async function handleAddItem(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (!form.title.trim()) {
      setFormError("Title is required.")
      return
    }

    setAdding(true)

    try {
      const response = await fetch("/api/kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          lastUpdated: "just now",
        }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to add item")
      }

      setShowAddModal(false)
      setForm(EMPTY_FORM)
      await fetchKanban()
      toast({
        title: "Item added",
        description: `${form.title} was added to the board.`,
      })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unknown error"
      setFormError(message)
      toast({
        title: "Add failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  function handleEditClick(item: KanbanItem) {
    setEditItem(item)
    setEditForm({
      title: item.title,
      type: item.type,
      description: item.description,
      status: item.status as KanbanColumnId,
    })
    setEditError(null)
  }

  async function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault()
    setEditError(null)

    if (!editItem) return

    if (!editForm.title.trim()) {
      setEditError("Title is required.")
      return
    }

    setEditing(true)

    try {
      const response = await fetch(`/api/kanban/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          lastUpdated: "just now",
        }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to update item")
      }

      setEditItem(null)
      await fetchKanban()
      toast({
        title: "Item updated",
        description: `${editForm.title} was updated.`,
      })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unknown error"
      setEditError(message)
      toast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setEditing(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteItem) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/kanban/${deleteItem.id}`, { method: "DELETE" })
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to delete item")
      }

      setDeleteItem(null)
      await fetchKanban()
      toast({
        title: "Item deleted",
        description: "The board item was removed.",
      })
    } catch {
      // Keep the confirmation dialog open so the user can retry or cancel.
      toast({
        title: "Delete failed",
        description: "The board item could not be removed.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  async function handleDragEnd(result: DropResult) {
    const { source, destination } = result

    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return
    }

    const sourceColumn = columns.find((column) => column.id === source.droppableId)
    const item = sourceColumn?.items[source.index]

    if (!item) return

    try {
      await fetch(`/api/kanban/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          status: destination.droppableId,
          lastUpdated: "just now",
        }),
      })

      await fetchKanban()
    } catch {
      // Leave the board unchanged if the update fails.
    }
  }

  function getColumnTone(columnId: KanbanColumnId) {
    switch (columnId) {
      case "to-test":
        return "border-t-muted"
      case "in-progress":
        return "border-t-warning"
      case "deployed":
        return "border-t-success"
      case "failed":
        return "border-t-error"
      default:
        return "border-t-muted"
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "to-test":
      case "pending":
        return <Clock className="icon-sm text-muted-foreground" />
      case "in-progress":
      case "testing":
        return <AlertCircle className="icon-sm text-warning" />
      case "deployed":
        return <CheckCircle className="icon-sm text-success" />
      case "failed":
        return <XCircle className="icon-sm text-error" />
      default:
        return <Clock className="icon-sm text-muted-foreground" />
    }
  }

  const totalItems = columns.reduce((sum, column) => sum + column.items.length, 0)
  const deployedItems = columns.find((column) => column.id === "deployed")?.items.length ?? 0
  const failedItems = columns.find((column) => column.id === "failed")?.items.length ?? 0
  const modelItems = columns.flatMap((column) => column.items).filter((item) => item.type === "model").length

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem]">Release board</h1>
          <p className="text-sm text-muted-foreground">
            Drag items across stages to track API and model work.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 rounded-full border border-border/60 bg-surface/80 px-4 py-2 text-sm">
            <span className="text-muted-foreground">{totalItems} items</span>
            <span className="text-success font-medium">{deployedItems} deployed</span>
            {failedItems > 0 && <span className="text-error font-medium">{failedItems} failed</span>}
          </div>
          <Button variant="outline" className="rounded-full border-border/70 bg-background/80" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 icon-sm ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-5">
                <Plus className="mr-2 icon-sm" />
                Add item
              </Button>
            </DialogTrigger>
                  <DialogContent className="max-w-2xl rounded-3xl border-border/70 bg-background">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-medium tracking-tight">Create a board item</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddItem} className="space-y-6">
                      <Accordion type="multiple" defaultValue={["details", "stage"]} className="w-full">
                        <AccordionItem value="details" className="border-border/60">
                          <AccordionTrigger className="py-4 hover:no-underline">
                            <div>
                              <p className="text-base font-semibold">Item details</p>
                              <p className="text-sm font-normal text-muted-foreground">Define the asset and describe the work to be done</p>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="grid gap-5 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                  id="title"
                                  value={form.title}
                                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                                  placeholder="e.g. Payments regression pass"
                                  autoFocus
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select
                                  value={form.type}
                                  onValueChange={(value: KanbanItemType) => setForm((current) => ({ ...current, type: value }))}
                                >
                                  <SelectTrigger id="type">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="api">API</SelectItem>
                                    <SelectItem value="model">Model</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                  id="description"
                                  value={form.description}
                                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                  rows={3}
                                  className="rounded-3xl"
                                  placeholder="Add a short summary of the work, blockers, or rollout notes."
                                />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="stage" className="border-border/60">
                          <AccordionTrigger className="py-4 hover:no-underline">
                            <div>
                              <p className="text-base font-semibold">Workflow stage</p>
                              <p className="text-sm font-normal text-muted-foreground">Choose where this item should land on the board</p>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2">
                              <Label htmlFor="status">Stage</Label>
                              <Select
                                value={form.status}
                                onValueChange={(value: KanbanColumnId) => setForm((current) => ({ ...current, status: value }))}
                              >
                                <SelectTrigger id="status">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COLUMN_ORDER.map((column) => (
                                    <SelectItem key={column.id} value={column.id}>
                                      {column.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>

                      {formError ? <div className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">{formError}</div> : null}

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowAddModal(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-full px-5" disabled={adding}>
                          {adding ? "Adding..." : "Add item"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
          </Dialog>
        </div>
      </section>

      {loading ? (
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">Loading board items...</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-border/70 bg-surface/80 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="mx-auto max-w-md rounded-3xl border border-error/30 bg-error/10 p-6 text-error">
              {error}
            </div>
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <section className="grid gap-6 xl:grid-cols-4">
            {columns.map((column) => (
              <Droppable droppableId={column.id} key={column.id}>
                {(provided, snapshot) => (
                  <Card
                    className={`flex h-[70vh] min-h-[34rem] flex-col border-border/70 border-t-4 ${getColumnTone(column.id)} bg-surface/80 shadow-sm ${
                      snapshot.isDraggingOver ? "ring-2 ring-primary/25" : ""
                    }`}
                  >
                    <CardHeader className="space-y-3 pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="space-y-1">
                          <CardTitle className="text-base font-medium">{column.title}</CardTitle>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{column.description}</TooltipContent>
                        </Tooltip>
                        <Badge variant="secondary" className="rounded-full border border-border/60 bg-background px-3 py-1">
                          {column.items.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
                      >
                        {column.items.length === 0 ? (
                          <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-border/70 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                            No items in this stage yet.
                          </div>
                        ) : (
                          column.items.map((item, index) => (
                            <Draggable draggableId={item.id} index={index} key={item.id}>
                              {(draggableProvided, draggableSnapshot) => (
                                <div
                                  ref={draggableProvided.innerRef}
                                  {...draggableProvided.draggableProps}
                                  className={draggableSnapshot.isDragging ? "rotate-[0.4deg] shadow-lg" : ""}
                                >
                                  <div {...draggableProvided.dragHandleProps} className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
                                    <GripVertical className="icon-xs" />
                                    Drag to move
                                  </div>
                                  <KanbanCard
                                    item={item}
                                    statusIcon={getStatusIcon(item.status)}
                                    onEdit={handleEditClick}
                                    onDelete={setDeleteItem}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>

                      <Button
                        variant="outline"
                        className="rounded-full border-border/70 bg-background/80"
                        onClick={() => {
                          setShowAddModal(true)
                          setForm((current) => ({ ...current, status: column.id }))
                        }}
                      >
                        <Plus className="mr-2 icon-sm" />
                        Add to {column.title.toLowerCase()}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </Droppable>
            ))}
          </section>
        </DragDropContext>
      )}

      <Dialog
        open={!!editItem}
        onOpenChange={(open) => {
          if (!open) setEditItem(null)
        }}
      >
        <DialogContent className="max-w-2xl rounded-3xl border-border/70 bg-background">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium tracking-tight">Edit board item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-6">
            <Accordion type="multiple" defaultValue={["details", "stage"]} className="w-full">
              <AccordionItem value="details" className="border-border/60">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div>
                    <p className="text-base font-semibold">Item details</p>
                    <p className="text-sm font-normal text-muted-foreground">Update the asset name, type, or summary</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">Title</Label>
                      <Input
                        id="edit-title"
                        value={editForm.title}
                        onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-type">Type</Label>
                      <Select
                        value={editForm.type}
                        onValueChange={(value: KanbanItemType) => setEditForm((current) => ({ ...current, type: value }))}
                      >
                        <SelectTrigger id="edit-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="api">API</SelectItem>
                          <SelectItem value="model">Model</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editForm.description}
                        onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                        rows={3}
                        className="rounded-3xl"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="stage" className="border-border/60">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div>
                    <p className="text-base font-semibold">Workflow stage</p>
                    <p className="text-sm font-normal text-muted-foreground">Move the item to a different lane</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Stage</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value: KanbanColumnId) => setEditForm((current) => ({ ...current, status: value }))}
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_ORDER.map((column) => (
                          <SelectItem key={column.id} value={column.id}>
                            {column.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {editError ? <div className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">{editError}</div> : null}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditItem(null)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-5" disabled={editing}>
                {editing ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null)
        }}
      >
        <AlertDialogContent className="rounded-3xl border-border/70 bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-medium tracking-tight">Delete board item</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm leading-6 text-muted-foreground">
            Delete <span className="font-medium text-foreground">{deleteItem?.title}</span>? This removes the item from the workflow board.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-error text-white hover:bg-error/90" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
