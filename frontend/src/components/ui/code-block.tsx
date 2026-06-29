import { cn } from "@/lib/utils"
import React, { useEffect, useState } from "react"
import { highlightCode, resolveShikiTheme } from "@/lib/shiki-highlighter"

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border",
        "border-border bg-card text-card-foreground rounded-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  theme?: string
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({
  code,
  language = "tsx",
  className,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function highlight() {
      if (!code) {
        if (!cancelled) setHighlightedHtml("<pre><code></code></pre>")
        return
      }

      const html = await highlightCode(code, language)
      if (!cancelled) setHighlightedHtml(html)
    }

    highlight()
    return () => {
      cancelled = true
    }
  }, [code, language])

  useEffect(() => {
    const root = document.documentElement
    let cancelled = false
    const observer = new MutationObserver(() => {
      if (!code || cancelled) return
      highlightCode(code, language).then((html) => {
        if (!cancelled) setHighlightedHtml(html)
      })
    })
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [code, language])

  const classNames = cn(
    "w-full overflow-x-auto text-[13px] [&>pre]:px-4 [&>pre]:py-4",
    className
  )

  return highlightedHtml ? (
    <div
      className={classNames}
      data-shiki-theme={resolveShikiTheme()}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props}
    />
  ) : (
    <div className={classNames} {...props}>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock }
