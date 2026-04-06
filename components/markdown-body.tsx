"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Copy, Check } from "lucide-react"

/**
 * Inline copy button for code blocks
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

const MD_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="text-foreground/80">{children}</em>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="text-foreground/90">{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 mt-3 text-sm font-bold text-foreground font-display first:mt-0">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-1.5 mt-3 text-[13px] font-bold text-foreground font-display first:mt-0">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 mt-2 text-xs font-semibold text-foreground first:mt-0">{children}</h3>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-primary/30 pl-3 text-foreground/70 italic">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border/40">
      <table className="w-full text-[10px] font-mono">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-surface-secondary/60">{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border-b border-border/30 px-2.5 py-1.5 text-left font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-border/20 px-2.5 py-1.5 text-foreground/80">{children}</td>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => <tr className="hover:bg-surface-secondary/30 transition-colors">{children}</tr>,
  hr: () => <hr className="my-3 border-border/30" />,
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
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
}

/**
 * Shared markdown renderer with full styling for chat and explanation panels
 * @param {{ content: string }} props
 */
export function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
      {content}
    </ReactMarkdown>
  )
}
