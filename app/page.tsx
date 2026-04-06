"use client"

import { GradientBackground } from "@/components/gradient-background"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Page() {
  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <GradientBackground />
      <div className="absolute inset-0 -z-10 bg-black/40" />

      <section className="px-6 text-center max-w-3xl mx-auto">
        <div className="mb-10 flex justify-center animate-scale-in">
          <div className="relative">
            <img
              src="/Gemini_Generated_Image_l0hl0hl0hl0hl0hl.png"
              alt="DeployZen Logo"
              className="w-20 h-20 drop-shadow-lg rounded-xl"
            />
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-black/20 animate-glow-pulse" />
          </div>
        </div>

        <h1 className="font-display text-white text-balance font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl drop-shadow-lg mb-5 animate-slide-up-fade">
          Seamless Deployments. Smarter Testing. One Platform.
        </h1>

        <p className="text-white/60 text-base sm:text-lg mb-10 max-w-xl mx-auto animate-slide-up-fade stagger-2">
          AI-powered security scanning, automated testing, and intelligent deployment — all in one control center.
        </p>

        <div className="flex justify-center animate-slide-up-fade stagger-4">
          <Link
            href="/dashboard"
            className="group relative inline-flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:border-white/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </main>
  )
}
