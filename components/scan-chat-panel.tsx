"use client"

import { useState, useRef, useEffect } from "react"
import {
  Bot,
  Loader2,
  Send,
  User,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

interface ScanChatPanelProps {
  scanId: string
  chatHistory: ChatMessage[]
  onNewMessage: (userMsg: ChatMessage, assistantMsg: ChatMessage) => void
  selectedFindingIndex: number | null
}

const QUICK_PROMPTS = [
  "Summarize the most critical findings",
  "What are the top security risks?",
  "Suggest fixes for the critical issues",
  "Generate custom test cases for the vulnerabilities",
]

/**
 * AI chat panel for discussing scan findings with security context
 * @param {ScanChatPanelProps} props - Component props
 */
export function ScanChatPanel({
  scanId,
  chatHistory,
  onNewMessage,
  selectedFindingIndex,
}: ScanChatPanelProps) {
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatHistory])

  /**
   * Sends a chat message to the AI endpoint
   * @param {string} message - The user's message text
   */
  async function sendMessage(message: string) {
    if (!message.trim() || sending) return

    setSending(true)
    setInput("")

    try {
      const res = await fetch(`/api/scans/${scanId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          findingIndex: selectedFindingIndex,
        }),
      })

      const data = await res.json()

      if (data.success) {
        onNewMessage(data.userMessage, data.assistantMessage)
      }
    } catch {
      onNewMessage(
        { role: "user", content: message.trim(), timestamp: new Date().toISOString() },
        { role: "assistant", content: "Failed to get response. Please try again.", timestamp: new Date().toISOString() }
      )
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  /**
   * Handles keyboard events for the textarea input
   * @param {React.KeyboardEvent} e - Keyboard event
   */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex h-[calc(100vh-14rem)] flex-col">
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="space-y-3 p-3">
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="icon-sm text-primary" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">Security Assistant</p>
              <p className="mt-1 text-center text-xs text-muted-foreground max-w-[220px]">
                Ask about findings, request fixes, or generate test cases
              </p>

              <div className="mt-4 w-full space-y-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    disabled={sending}
                    className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatHistory.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/50 bg-surface-secondary text-foreground/90"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {msg.role === "user" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="rounded-xl border border-border/50 bg-surface-secondary px-3 py-2">
                <Loader2 className="icon-xs animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/50 p-2">
        {selectedFindingIndex !== null && (
          <p className="mb-1.5 text-[10px] text-muted-foreground px-1">
            Context: Finding #{selectedFindingIndex + 1}
          </p>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about findings, security, or tests..."
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <Loader2 className="icon-xs animate-spin" />
            ) : (
              <Send className="icon-xs" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
