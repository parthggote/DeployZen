"use client"

import { GradientBackground } from "@/components/gradient-background"
import { useRouter } from "next/navigation"
import { useAudio } from "./audio-context"

export default function Page() {
  const router = useRouter()
  const { play } = useAudio()

  const handleClick = () => {
    play()
    router.push("/landing")
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <GradientBackground />
      <div className="absolute inset-0 -z-10 bg-black/40" />

      <section className="px-6 text-center">
        <div className="mb-8 flex justify-center">
          <img src="/Gemini_Generated_Image_l0hl0hl0hl0hl0hl.png" alt="DeployZen Logo" className="w-20 h-20 drop-shadow-lg rounded-lg" />
        </div>

        <h1 className="font-sd-glitch-robot text-white text-balance font-bold tracking-tight text-5xl drop-shadow-lg mb-8">
          Seamless Deployments. Smarter Testing. One Platform.
        </h1>

        <div className="flex justify-center">
          <div
            onClick={handleClick}
            className="relative w-14 h-14 rounded-full border-2 border-white/40 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-md flex items-center justify-center hover:scale-110 transition-all duration-500 cursor-pointer group animate-pulse hover:animate-none shadow-lg hover:shadow-white/20"
          >
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400/30 via-emerald-500/30 to-teal-400/30 animate-spin opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ animationDuration: "3s" }}
            ></div>
            <svg
              className="w-7 h-7 text-white animate-bounce group-hover:text-green-300 transition-colors duration-300 relative z-10 drop-shadow-lg"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>
    </main>
  )
}