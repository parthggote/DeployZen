"use client"

import { useState, useMemo } from "react"
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface FileTreeEntry {
  path: string
  type: "file" | "dir"
  size?: number
  findingCount: number
}

interface TreeNode {
  name: string
  path: string
  type: "file" | "dir"
  findingCount: number
  size?: number
  children: TreeNode[]
}

interface RepoFileExplorerProps {
  fileTree: FileTreeEntry[]
  selectedFile: string | null
  loadingFile: boolean
  onFileSelect: (path: string) => void
}

/**
 * Converts a flat file list into a nested tree structure
 * @param {FileTreeEntry[]} entries - Flat file entries from scan
 * @returns {TreeNode[]} Nested tree nodes
 */
function buildTree(entries: FileTreeEntry[]): TreeNode[] {
  const root: TreeNode = {
    name: "",
    path: "",
    type: "dir",
    findingCount: 0,
    children: [],
  }

  const dirMap = new Map<string, TreeNode>()
  dirMap.set("", root)

  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  for (const entry of sorted) {
    const parts = entry.path.split("/")
    const name = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join("/")

    let parent = dirMap.get(parentPath)
    if (!parent) {
      const parentParts = parentPath.split("/")
      let currentPath = ""
      let currentNode = root

      for (const part of parentParts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        let existing = dirMap.get(currentPath)
        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            type: "dir",
            findingCount: 0,
            children: [],
          }
          currentNode.children.push(existing)
          dirMap.set(currentPath, existing)
        }
        currentNode = existing
      }
      parent = currentNode
    }

    const node: TreeNode = {
      name,
      path: entry.path,
      type: entry.type,
      findingCount: entry.findingCount,
      size: entry.size,
      children: [],
    }

    if (entry.type === "dir") {
      dirMap.set(entry.path, node)
    }

    parent.children.push(node)
  }

  return root.children
}

/**
 * Recursively computes total finding count for a directory node
 * @param {TreeNode} node - Tree node to compute for
 * @returns {number} Total findings in node and all descendants
 */
function computeDirFindings(node: TreeNode): number {
  if (node.type === "file") return node.findingCount

  let total = 0
  for (const child of node.children) {
    total += computeDirFindings(child)
  }
  node.findingCount = total
  return total
}

interface TreeItemProps {
  node: TreeNode
  depth: number
  selectedFile: string | null
  loadingFile: boolean
  expandedDirs: Set<string>
  toggleDir: (path: string) => void
  onFileSelect: (path: string) => void
}

/**
 * Renders a single tree node (file or folder) with recursive children
 * @param {TreeItemProps} props - Tree item props
 */
function TreeItem({
  node,
  depth,
  selectedFile,
  loadingFile,
  expandedDirs,
  toggleDir,
  onFileSelect,
}: TreeItemProps) {
  const isDir = node.type === "dir"
  const isExpanded = expandedDirs.has(node.path)
  const isSelected = selectedFile === node.path
  const hasFindings = node.findingCount > 0

  const sortedChildren = [...node.children].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div>
      <button
        type="button"
        onClick={() => (isDir ? toggleDir(node.path) : onFileSelect(node.path))}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors",
          isSelected
            ? "bg-primary/10 text-foreground"
            : "text-foreground/80 hover:bg-background/80"
        )}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {isDir ? (
          <>
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )}
            />
            {isExpanded ? (
              <FolderOpen className="icon-xs shrink-0 text-primary/70" />
            ) : (
              <Folder className="icon-xs shrink-0 text-muted-foreground" />
            )}
          </>
        ) : (
          <>
            <span className="w-3" />
            {isSelected && loadingFile ? (
              <Loader2 className="icon-xs shrink-0 animate-spin text-primary" />
            ) : (
              <File className="icon-xs shrink-0 text-muted-foreground" />
            )}
          </>
        )}

        <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>

        {hasFindings && (
          <Badge
            className={cn(
              "ml-auto text-[9px] px-1 py-0 leading-tight",
              node.findingCount > 0 && node.children.some?.((c) =>
                c.type === "file" && c.findingCount > 0
              )
                ? "bg-error/15 text-error hover:bg-error/15"
                : "bg-warning/15 text-warning hover:bg-warning/15"
            )}
          >
            {node.findingCount}
          </Badge>
        )}
      </button>

      {isDir && isExpanded && (
        <div>
          {sortedChildren.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              loadingFile={loadingFile}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Collapsible file tree explorer with finding count badges
 * @param {RepoFileExplorerProps} props - Component props
 */
export function RepoFileExplorer({
  fileTree,
  selectedFile,
  loadingFile,
  onFileSelect,
}: RepoFileExplorerProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const tree = useMemo(() => {
    const built = buildTree(fileTree)
    for (const node of built) {
      computeDirFindings(node)
    }
    return built
  }, [fileTree])

  /**
   * Toggles a directory's expanded/collapsed state
   * @param {string} path - Directory path to toggle
   */
  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  if (fileTree.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-muted-foreground">No files in scan</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-0.5 py-1 pr-2">
        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            selectedFile={selectedFile}
            loadingFile={loadingFile}
            expandedDirs={expandedDirs}
            toggleDir={toggleDir}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
