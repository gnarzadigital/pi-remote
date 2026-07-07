import { cn } from "@/lib/utils"
import {
  MarkdownTextPrimitive,
  type MarkdownTextPrimitiveProps,
} from "@assistant-ui/react-markdown"
import { TextMessagePartProvider } from "@assistant-ui/react"
import { memo, useEffect, useState } from "react"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { Source, SourceContent, SourceTrigger } from "./source"

export type MarkdownProps = {
  children: string
  className?: string
  streaming?: boolean
  components?: MarkdownTextPrimitiveProps["components"]
}

function isExternalHttpUrl(href: string | undefined): href is string {
  if (!href) return false
  try {
    const u = new URL(href)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

// ponytail: no header/copy button, matches the pre-swap renderer's behavior.
function LazySyntaxHighlighter({
  language,
  code,
}: {
  language: string
  code: string
}) {
  const [mod, setMod] = useState<typeof import("./code-block") | null>(null)

  useEffect(() => {
    import("./code-block").then(setMod)
  }, [])

  if (!mod) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-hairline bg-mist p-4 text-[13px]">
        <code>{code}</code>
      </pre>
    )
  }

  const { CodeBlock, CodeBlockCode } = mod
  return (
    <CodeBlock>
      <CodeBlockCode code={code} language={language || "plaintext"} />
    </CodeBlock>
  )
}

const INITIAL_COMPONENTS: MarkdownTextPrimitiveProps["components"] = {
  a: function LinkComponent({ href, children, ...props }) {
    const label =
      typeof children === "string"
        ? children
        : Array.isArray(children)
          ? children.join("")
          : "Source"

    if (isExternalHttpUrl(href)) {
      return (
        <Source href={href}>
          <SourceTrigger
            showFavicon
            label={label}
            className="mx-0.5 border border-hairline bg-mist text-graphite"
          />
          <SourceContent title={label} description={href} />
        </Source>
      )
    }

    return (
      <a
        href={href}
        className="text-graphite underline underline-offset-2"
        {...props}
      >
        {children}
      </a>
    )
  },
  code: function InlineCodeComponent({ className, children, ...props }) {
    return (
      <span
        className={cn(
          "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  },
  table: function TableComponent({ children, ...props }) {
    return (
      <div className="markdown-table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
        <table {...props}>{children}</table>
      </div>
    )
  },
  SyntaxHighlighter: function SyntaxHighlighterComponent({ language, code }) {
    return <LazySyntaxHighlighter language={language} code={code} />
  },
}

function MarkdownComponent({
  children,
  className,
  streaming = false,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  return (
    <div className={cn("max-w-full min-w-0", className)}>
      <TextMessagePartProvider text={children} isRunning={streaming}>
        <MarkdownTextPrimitive
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={components}
        />
      </TextMessagePartProvider>
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
