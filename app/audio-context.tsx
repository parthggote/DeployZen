"use client"

import React, { createContext, useContext, useRef, ReactNode } from "react"

interface AudioContextType {
  play: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  const play = () => {
    if (audioRef.current) {
      // User has confirmed audio.mp3 exists in /public
      audioRef.current.src = "/paranoid-instrumental.mp3"
      audioRef.current.play().catch(error => {
        console.error("Audio play failed:", error)
      })
    }
  }

  return (
    <AudioContext.Provider value={{ play }}>
      <audio ref={audioRef} preload="auto" />
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (context === undefined) {
    throw new Error("useAudio must be used within an AudioProvider")
  }
  return context
}
