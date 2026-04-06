"use client"

import { useState, useEffect, useCallback } from "react"
import {
  GitBranch,
  Globe,
  Lock,
  Loader2,
  Search,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Repo {
  id: number
  name: string
  fullName: string
  private: boolean
  description: string | null
  language: string | null
  defaultBranch: string
  updatedAt: string
  stars: number
  owner: string
}

interface RepoSelectorProps {
  onSelect: (repo: Repo) => void
  selectedRepo: Repo | null
  listClassName?: string
}

/**
 * Searchable dropdown for selecting a GitHub repository from the user's account
 * @param {RepoSelectorProps} props - Component props
 */
export function RepoSelector({ onSelect, selectedRepo, listClassName }: RepoSelectorProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetches the list of repositories from the API
   */
  const fetchRepos = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/repos")
      const data = await res.json()

      if (!data.success) {
        setError(data.error || "Failed to load repositories")
        return
      }

      setRepos(data.repos)
    } catch {
      setError("Failed to connect to API")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRepos()
  }, [fetchRepos])

  const filtered = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(search.toLowerCase())
  )

  if (error) {
    return (
      <div className="rounded-2xl border border-border/70 bg-surface-secondary p-4 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={fetchRepos}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      <div
        className={cn(
          "h-[16rem] min-h-0 lg:flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] sm:h-[18rem]",
          listClassName
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="icon-md animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? "No matching repositories" : "No repositories found"}
          </p>
        ) : (
          <div className="space-y-1 pr-3">
            {filtered.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => onSelect(repo)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                  selectedRepo?.id === repo.id
                    ? "border-primary/30 bg-primary/5"
                    : "border-transparent hover:border-border/60 hover:bg-background/80"
                )}
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
                  {repo.private ? (
                    <Lock className="icon-xs text-muted-foreground" />
                  ) : (
                    <Globe className="icon-xs text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {repo.fullName}
                    </span>
                    {repo.language && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {repo.language}
                      </Badge>
                    )}
                  </div>
                  {repo.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {repo.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {repo.defaultBranch}
                    </span>
                    {repo.stars > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {repo.stars}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
