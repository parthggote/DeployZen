"use client"

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  AlertTriangle,
  Bot,
  Copy,
  Check,
  Lightbulb,
  Loader2,
  Send,
  Shield,
  Sparkles,
  TestTubes,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
  { label: "Summarize critical findings", icon: AlertTriangle },
  { label: "What are the top security risks?", icon: Shield },
  { label: "Suggest fixes for the issues", icon: Lightbulb },
  { label: "Generate test cases", icon: TestTubes },
]

/**
 * Inline code-copy button for code blocks in markdown output
 * @param {{ code: string }} props
 */
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

/**
 * Renders an assistant message with full markdown support
 * @param {{ content: string }} props
 */
function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="text-foreground/80">{children}</em>,
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="text-foreground/90">{children}</li>,
        h1: ({ children }) => <h1 className="mb-2 mt-3 text-sm font-bold text-foreground font-display first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-[13px] font-bold text-foreground font-display first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 mt-2 text-xs font-semibold text-foreground first:mt-0">{children}</h3>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-primary/30 pl-3 text-foreground/70 italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-[10px] font-mono">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-surface-secondary/60">{children}</thead>,
        th: ({ children }) => (
          <th className="border-b border-border/30 px-2.5 py-1.5 text-left font-semibold text-foreground">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border/20 px-2.5 py-1.5 text-foreground/80">{children}</td>
        ),
        tr: ({ children }) => <tr className="hover:bg-surface-secondary/30 transition-colors">{children}</tr>,
        hr: () => <hr className="my-3 border-border/30" />,
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-")
          const codeStr = String(children).replace(/\n$/, "")

          if (isBlock) {
            const lang = className?.replace("language-", "") || ""
            return (
              <div className="group relative my-2 rounded-lg border border-border/30 bg-surface-tertiary overflow-hidden">
                {lang && (
                  <div className="flex items-center justify-between border-b border-border/20 bg-surface-secondary/50 px-3 py-1">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60 font-mono">{lang}</span>
                  </div>
                )}
                <CopyButton code={codeStr} />
                <pre className="overflow-x-auto p-3 text-[10px] leading-relaxed font-mono">
                  <code className="text-foreground/90">{children}</code>
                </pre>
              </div>
            )
          }

          return (
            <code className="rounded-md bg-surface-tertiary px-1.5 py-0.5 text-[10px] font-mono text-primary/90">
              {children}
            </code>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

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
    <div className="flex h-full flex-col min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div ref={scrollRef} className="space-y-3 p-3">
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 animate-scale-in">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 glow-primary">
                <Sparkles className="icon-sm text-primary" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground font-display">Security Assistant</p>
              <p className="mt-1 text-center text-xs text-muted-foreground max-w-[220px]">
                Ask about findings, request fixes, or generate test cases
              </p>

              <div className="mt-4 w-full grid grid-cols-2 gap-1.5">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => sendMessage(prompt.label)}
                    disabled={sending}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border border-border/50 bg-background/60 px-2.5 py-2.5 text-left text-[11px] text-foreground/80 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-0.5 active:scale-[0.97]",
                      `stagger-${idx + 1} animate-slide-up-fade`
                    )}
                  >
                    <prompt.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                    <span className="leading-snug">{prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatHistory.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 animate-slide-up-fade",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/50 bg-surface-secondary text-foreground/90"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <MarkdownBody content={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface-secondary mt-0.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-center gap-2 animate-slide-up-fade">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="rounded-xl border border-border/50 bg-surface-secondary px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-20 rounded-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 animate-pulse" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/50 bg-surface-secondary/20 p-2">
        {selectedFindingIndex !== null && (
          <p className="mb-1.5 text-[10px] text-muted-foreground px-1 font-mono">
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
            aria-label="Chat message input"
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl active:scale-[0.93] transition-transform"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            aria-label="Send message"
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
