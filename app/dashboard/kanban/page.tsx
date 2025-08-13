"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Plus, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { KanbanCard } from "@/components/kanban-card"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

const COLUMN_ORDER = [
  { id: "to-test", title: "To Test" },
  { id: "in-progress", title: "In Progress" },
  { id: "deployed", title: "Deployed" },
  { id: "failed", title: "Failed" },
]

export default function KanbanPage() {
  const [columns, setColumns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    title: "",
          type: "api",
    description: "",
    status: "to-test",
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [editForm, setEditForm] = useState(form)
  const [editError, setEditError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleteItem, setDeleteItem] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchKanban()
  }, [])

  async function fetchKanban() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/kanban")
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Failed to fetch kanban data")
      // Group items by column id
      const grouped = COLUMN_ORDER.map(col => ({
        id: col.id,
        title: col.title,
        items: (data.items || []).filter((item: any) => item.status === col.id),
      }))
      setColumns(grouped)
    } catch (e: any) {
      setError(e.message || "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim()) {
      setFormError("Title is required.")
      return
    }
    setAdding(true)
    try {
      const res = await fetch("/api/kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          lastUpdated: "just now",
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Failed to add item")
      setShowAddModal(false)
      setForm({ title: "", type: "api", description: "", status: "to-test" })
      fetchKanban()
    } catch (e: any) {
      setFormError(e.message || "Unknown error")
    } finally {
      setAdding(false)
    }
  }

  function handleEditClick(item: any) {
    setEditItem(item)
    setEditForm({
      title: item.title,
      type: item.type,
      description: item.description,
      status: item.status,
    })
    setEditError(null)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEditError(null)
    if (!editForm.title.trim()) {
      setEditError("Title is required.")
      return
    }
    setEditing(true)
    try {
      const res = await fetch(`/api/kanban/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          lastUpdated: "just now",
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Failed to update item")
      setEditItem(null)
      fetchKanban()
    } catch (e: any) {
      setEditError(e.message || "Unknown error")
    } finally {
      setEditing(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteItem) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/kanban/${deleteItem.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Failed to delete item")
      setDeleteItem(null)
      fetchKanban()
    } catch (e: any) {
      // Optionally show error
    } finally {
      setDeleting(false)
    }
  }

  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return
    }
    // Find the item
    const sourceCol = columns.find((col: any) => col.id === source.droppableId)
    const item = sourceCol?.items[source.index]
    if (!item) return
    // Update status
    try {
      await fetch(`/api/kanban/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, status: destination.droppableId, lastUpdated: "just now" }),
      })
      fetchKanban()
    } catch {}
  }

  const getColumnColor = (columnId: string) => {
    switch (columnId) {
      case "to-test":
        return "border-t-4 border-t-muted"
      case "in-progress":
        return "border-t-4 border-t-warning"
      case "deployed":
        return "border-t-4 border-t-success"
      case "failed":
        return "border-t-4 border-t-error"
      default:
        return "border-t-4 border-t-muted"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "to-test":
      case "pending":
        return <Clock className="w-4 h-4 text-muted-foreground" />
      case "in-progress":
      case "testing":
        return <AlertCircle className="w-4 h-4 text-warning" />
      case "deployed":
        return <CheckCircle className="w-4 h-4 text-success" />
      case "failed":
        return <XCircle className="w-4 h-4 text-error" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kanban Board</h1>
          <p className="text-muted-foreground">Manage your APIs and models through their lifecycle stages.</p>
        </div>
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Kanban Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={val => setForm(f => ({ ...f, type: val as "api" | "model" }))}
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
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={val => setForm(f => ({ ...f, status: val }))}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMN_ORDER.map(col => (
                      <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              {formError && <div className="text-error text-sm">{formError}</div>}
              <div className="flex justify-end">
                <Button type="submit" disabled={adding}>{adding ? "Adding..." : "Add Item"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading kanban board...</div>
      ) : error ? (
        <div className="text-center py-12 text-error">{error}</div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => (
              <Droppable droppableId={column.id} key={column.id}>
                {(provided, snapshot) => (
                  <Card
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`${getColumnColor(column.id)} bg-surface-secondary/30 ${snapshot.isDraggingOver ? "ring-2 ring-primary/40" : ""}`}
                  >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{column.title}</CardTitle>
                <Badge variant="secondary">{column.items.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
                      {column.items.map((item: any, idx: number) => (
                        <Draggable draggableId={item.id} index={idx} key={item.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`mb-2 ${snapshot.isDragging ? "ring-2 ring-primary/60" : ""}`}
                            >
                              <KanbanCard
                                item={item}
                                statusIcon={getStatusIcon(item.status)}
                                onEdit={handleEditClick}
                                onDelete={setDeleteItem}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
              <Button
                variant="ghost"
                className="w-full border-2 border-dashed border-muted-foreground/25 h-20 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                        onClick={() => {
                          setShowAddModal(true)
                          setForm(f => ({ ...f, status: column.id }))
                        }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add {column.title === "To Test" ? "API/Model" : "Item"}
              </Button>
            </CardContent>
          </Card>
                )}
              </Droppable>
        ))}
      </div>
        </DragDropContext>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Kanban Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="edit-type">Type</Label>
              <Select
                value={editForm.type}
                onValueChange={val => setEditForm(f => ({ ...f, type: val as "api" | "model" }))}
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
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={val => setEditForm(f => ({ ...f, status: val }))}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMN_ORDER.map(col => (
                    <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            {editError && <div className="text-error text-sm">{editError}</div>}
            <div className="flex justify-end">
              <Button type="submit" disabled={editing}>{editing ? "Saving..." : "Save Changes"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItem} onOpenChange={v => { if (!v) setDeleteItem(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Kanban Item</AlertDialogTitle>
          </AlertDialogHeader>
          <div>Are you sure you want to delete <b>{deleteItem?.title}</b>? This action cannot be undone.</div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting} className="bg-error text-white hover:bg-error/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
