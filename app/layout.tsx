import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Instrument_Serif } from "next/font/google"
import localFont from "next/font/local"
import { Suspense } from "react"
import "./globals.css"
import { AudioProvider } from "./audio-context"

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-serif",
  weight: "400",
})

const sdGlitchRobot = localFont({
  src: [
    {
      path: "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap",
      weight: "400",
    },
  ],
  variable: "--font-sd-glitch-robot",
  display: "swap",
})

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${sdGlitchRobot.variable} antialiased`}>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <AudioProvider>
          <Suspense fallback={null}>{children}</Suspense>
        </AudioProvider>
        <Analytics />
      </body>
    </html>
  )
}
