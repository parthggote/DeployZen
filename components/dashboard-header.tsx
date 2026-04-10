"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronRight, Settings, LogOut, User } from "lucide-react"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Workspace Home",
  "/dashboard/upload-api": "API Test Lab",
  "/dashboard/upload-model": "Model Deployments",
  "/dashboard/monitoring": "Runtime Monitor",
  "/dashboard/kanban": "Release Board",
  "/dashboard/repo-scan": "Repo Scanner",
}

/**
 * Top header bar with breadcrumbs, theme toggle, and account menu
 */
export function DashboardHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const pageTitle = PAGE_TITLES[pathname] ?? "Dashboard"
  const isSubPage = pathname !== "/dashboard"

  const handleSignOut = async () => {
    await signOut()
    router.push('/landing')
  }

  const userEmail = user?.email || "workspace@deployzen.app"
  const userName = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username || "DeployZen Operator"
  const avatarUrl = user?.user_metadata?.avatar_url
  const initials = userName.substring(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5 md:px-6">
        <nav className="flex items-center gap-1.5 text-sm pl-10 lg:pl-0" aria-label="Breadcrumb">
          <Link href="/dashboard" className="font-display text-muted-foreground transition-colors hover:text-foreground">
            DeployZen
          </Link>
          <ChevronRight className="icon-xs text-muted-foreground/60" />
          <span className="font-medium text-foreground">
            {isSubPage ? pageTitle : "Home"}
          </span>
        </nav>

        <div className="flex items-center space-x-2 md:space-x-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ThemeToggle />
              </div>
            </TooltipTrigger>
            <TooltipContent>Switch appearance</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full border border-border/70 bg-surface shadow-sm ring-2 ring-transparent transition-all hover:ring-primary/20"
                aria-label="Account menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarUrl || "/placeholder-user.jpg"} alt={userName} />
                  <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground font-display">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-2xl border-border/70 bg-surface shadow-xl" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none font-display">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="transition-colors hover:bg-surface-secondary opacity-50 cursor-not-allowed">
                <User className="icon-sm mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="transition-colors hover:bg-surface-secondary opacity-50 cursor-not-allowed">
                <Settings className="icon-sm mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-error transition-colors hover:bg-error/10">
                <LogOut className="icon-sm mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
