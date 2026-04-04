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
import { Settings, LogOut, User } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-end gap-6 px-4 py-4 md:px-6">
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="hidden rounded-full border border-border/70 bg-surface px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm md:inline-flex">
            Live
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ThemeToggle />
              </div>
            </TooltipTrigger>
            <TooltipContent>Switch appearance</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full border border-border/70 bg-surface shadow-sm ring-2 ring-transparent transition-all hover:ring-primary/20"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="/placeholder-user.jpg" alt="User" />
                        <AvatarFallback className="bg-gradient-to-br from-primary via-info to-success text-sm font-medium text-white">
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
                    <DropdownMenuItem className="transition-colors hover:bg-surface-secondary">
                      <User className="icon-sm mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="transition-colors hover:bg-surface-secondary">
                      <Settings className="icon-sm mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-error transition-colors hover:bg-error/10">
                      <LogOut className="icon-sm mr-2" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TooltipTrigger>
            <TooltipContent>Account menu</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
