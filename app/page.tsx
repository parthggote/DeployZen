"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { Bot, Zap, BarChart3, Shield, ArrowRight, Cpu } from "lucide-react"
import Link from "next/link"
import HeroSection from "@/components/HeroSection"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"

// Reusable BotIcon component with consistent theming
const BotIcon = ({ size = "w-6 h-6", className = "" }) => {
  const { resolvedTheme } = useTheme();
  
  // Use dark theme styling for both 'dark' and 'system' (when system is dark)
  const isDarkMode = resolvedTheme === 'dark';
  
  return (
    <Bot 
      className={`${size} ${className}`}
      style={{
        color: isDarkMode ? '#4ade80' : '#000000', // green-400 in dark, black in light
        background: isDarkMode ? 'transparent' : '#ffffff',
        borderRadius: '6px',
        padding: '2px'
      }}
    />
  );
};

export default function LandingPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [navbarHeight, setNavbarHeight] = useState(0);
  const navbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (navbarRef.current) {
      setNavbarHeight(navbarRef.current.offsetHeight);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-secondary to-background">
      {/* Header */}
      <header className="border-b bg-surface/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary via-info to-primary rounded-xl flex items-center justify-center shadow-lg ring-2 ring-primary/10">
                <BotIcon size="w-6 h-6" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-background animate-pulse"></div>
            </div>
            <div>
              <span className="text-xl font-bold  from-primary to-info ">
                DeployZen
              </span>
              <div className="text-xs text-muted-foreground font-medium">AI Testing Platform</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
              onClick={e => {e.preventDefault(); document.getElementById('features')?.scrollIntoView({behavior: 'smooth'});}}
            >
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full"></span>
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
              onClick={e => {e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({behavior: 'smooth'});}}
            >
              Pricing
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full"></span>
            </a>
            <a
              href="#docs"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
              onClick={e => {e.preventDefault(); document.getElementById('docs')?.scrollIntoView({behavior: 'smooth'});}}
            >
              Docs
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full"></span>
            </a>
            <a
              href="#support"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
              onClick={e => {e.preventDefault(); document.getElementById('support')?.scrollIntoView({behavior: 'smooth'});}}
            >
              Support
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full"></span>
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <Button variant="ghost" className="text-sm font-medium hover:bg-surface-secondary" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button
              className="text-sm font-medium bg-gradient-to-r from-primary to-info hover:from-primary/90 hover:to-info/90 shadow-lg"
              asChild
            >
              <Link href="/dashboard">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <HeroSection navbarHeight={navbarHeight} />

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl font-bold">Everything you need to succeed</h2>
          <p className="text-xl text-muted-foreground font-serif max-w-2xl mx-auto">
            From automated testing to model deployment and monitoring, we've got your entire AI workflow covered.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="border-0 bg-surface-secondary/50 hover:bg-surface-secondary transition-colors">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mx-auto">
                <Zap className="w-6 h-6 text-success" />
              </div>
              <h3 className="font-semibold">Auto Testing</h3>
              <p className="text-sm text-muted-foreground">
                AI-powered automatic test generation and execution for your APIs
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-surface-secondary/50 hover:bg-surface-secondary transition-colors">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center mx-auto">
                <Cpu className="w-6 h-6 text-info" />
              </div>
              <h3 className="font-semibold">LLM Upload</h3>
              <p className="text-sm text-muted-foreground">
                Easy deployment of custom language models with optimized configurations
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-surface-secondary/50 hover:bg-surface-secondary transition-colors">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mx-auto">
                <BarChart3 className="w-6 h-6 text-warning" />
              </div>
              <h3 className="font-semibold">Live Monitoring</h3>
              <p className="text-sm text-muted-foreground">
                Real-time performance metrics and health monitoring for all deployments
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-surface-secondary/50 hover:bg-surface-secondary transition-colors">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-error/10 rounded-lg flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6 text-error" />
              </div>
              <h3 className="font-semibold">Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Unified control center for managing all your APIs and models
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-primary to-info text-primary-foreground border-0">
          <CardContent className="p-12 text-center space-y-6">
            <h2 className="text-4xl font-bold">Ready to accelerate your development?</h2>
            <p className="text-xl opacity-90 font-serif max-w-2xl mx-auto">
              Join thousands of developers who trust DeployZen for their testing and deployment needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="text-lg px-8" asChild>
                <Link href="/dashboard">
                  Get Started Free <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
              >
                Schedule Demo
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer id="support" className="border-t bg-surface-secondary/50">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary via-info to-primary rounded-xl flex items-center justify-center shadow-lg">
                    <BotIcon size="w-8 h-8" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-background"></div>
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
                    DeployZen
                  </span>
                  <div className="text-xs text-muted-foreground">AI Testing Platform</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                AI-powered testing and deployment platform for modern developers. Build, test, and deploy with
                confidence.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Product</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>API Testing</div>
                <div>Model Deployment</div>
                <div>Monitoring</div>
                <div>Analytics</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Company</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>About</div>
                <div>Blog</div>
                <div>Careers</div>
                <div>Contact</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Support</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>Documentation</div>
                <div>Help Center</div>
                <div>Community</div>
                <div>Status</div>
              </div>
            </div>
          </div>

          <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 DeployZen. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}