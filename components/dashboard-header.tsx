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
import { Bell, Settings, LogOut, User, Sparkles, Search } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-6 px-4 py-4 md:px-6">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-info/10 to-success/15 ring-1 ring-border/70">
              <img src="/Gemini_Generated_Image_l0hl0hl0hl0hl0hl.png" alt="DeployZen" className="w-8 h-8 rounded-xl" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-foreground">Operations Workspace</h2>
                <span className="hidden md:inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Stable
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Track deployments, validate APIs, and monitor models from one clean control surface.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-3">
          <Button variant="ghost" size="icon" className="hidden md:inline-flex rounded-full border border-border/70 bg-surface shadow-sm hover:bg-surface-secondary transition-colors">
            <Search className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="relative rounded-full border border-border/70 bg-surface shadow-sm hover:bg-surface-secondary transition-colors">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error"></span>
          </Button>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full border border-border/70 bg-surface shadow-sm ring-2 ring-transparent hover:ring-primary/20 transition-all"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder-user.jpg" alt="User" />
                  <AvatarFallback className="bg-gradient-to-br from-primary via-info to-success text-white text-sm font-medium">
                    DZ
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-2xl border-border/70 bg-surface shadow-xl" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">DeployZen Operator</p>
                  <p className="text-xs leading-none text-muted-foreground">workspace@deployzen.app</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="hover:bg-surface-secondary transition-colors">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-surface-secondary transition-colors">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="hover:bg-error/10 text-error transition-colors">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
