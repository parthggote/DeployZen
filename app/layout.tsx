import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AudioProvider } from "./audio-context"

// Configure fonts properly
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

// Use system fonts as fallback for Geist Sans and IBM Plex Serif
const geistSans = {
  variable: "--font-geist-sans",
}

const ibmPlexSerif = {
  variable: "--font-ibm-plex-serif",
}

export const metadata: Metadata = {
  title: "DeployZen - AI-Powered Testing and LLM Deployment",
  description: "AI-Powered Testing and LLM Deployment Assistant",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.className} ${inter.variable} ${geistSans.variable} ${ibmPlexSerif.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AudioProvider>
            {children}
          </AudioProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
