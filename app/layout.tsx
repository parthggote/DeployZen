import type React from "react"
import type { Metadata } from "next"
import { Outfit, Sora, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
})

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "DeployZen - AI-Powered Testing and LLM Deployment",
  description: "AI-Powered Testing and LLM Deployment Assistant",
  generator: 'v0.dev',
  icons: {
    icon: '/deployzen-icon.png',
    shortcut: '/deployzen-icon.png',
    apple: '/deployzen-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/deployzen-icon.png" type="image/png" />
        <link rel="shortcut icon" href="/deployzen-icon.png" />
      </head>
      <body className={`${outfit.className} ${outfit.variable} ${sora.variable} ${jetbrainsMono.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
