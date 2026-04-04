"use client"

import type React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Upload } from "lucide-react"

interface DragDropZoneProps {
  acceptedTypes?: string
  description?: string
  onFileSelect?: (files: File[]) => void
}

/**
 * Compact drag-and-drop file picker zone
 * @param {DragDropZoneProps} props - Zone configuration
 */
export function DragDropZone({
  acceptedTypes = ".json,.yaml,.yml",
  description = "Drop a file here or click to browse",
  onFileSelect,
}: DragDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  /**
   * @param {React.DragEvent} e - Drag event
   */
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  /**
   * @param {React.DragEvent} e - Drag leave event
   */
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  /**
   * @param {React.DragEvent} e - Drop event with files
   */
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    onFileSelect?.(files)
  }

  /**
   * @param {React.ChangeEvent<HTMLInputElement>} e - File input change event
   */
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      onFileSelect?.(Array.from(e.target.files))
    }
  }

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-colors",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-border/70 hover:border-muted-foreground/50",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Upload className="icon-md shrink-0 text-muted-foreground" />
      <div className="text-left">
        <p className="text-sm font-medium">{description}</p>
        <p className="text-xs text-muted-foreground">Accepts {acceptedTypes}</p>
      </div>
      <input
        type="file"
        className="hidden"
        accept={acceptedTypes}
        onChange={handleFileSelect}
      />
    </label>
  )
}
