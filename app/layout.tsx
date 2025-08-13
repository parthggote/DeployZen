import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

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
      <body className={`${inter.className} ${inter.variable} ${geistSans.variable} ${ibmPlexSerif.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
