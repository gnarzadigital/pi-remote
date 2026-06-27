import { cn } from "@/lib/utils"
import { marked } from "marked"
import { memo, useEffect, useId, useMemo, useState } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { Source, SourceContent, SourceTrigger } from "./source"

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
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

function LazyCodeBlock(props: {
  className?: string
  code: string
  language: string
}) {
  const [mod, setMod] = useState<typeof import("./code-block") | null>(null)

  useEffect(() => {
    import("./code-block").then(setMod)
  }, [])

  if (!mod) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-hairline bg-mist p-4 text-[13px]">
        <code>{props.code}</code>
      </pre>
    )
  }

  const { CodeBlock, CodeBlockCode } = mod
  return (
    <CodeBlock className={props.className}>
      <CodeBlockCode code={props.code} language={props.language} />
    </CodeBlock>
  )
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

const INITIAL_COMPONENTS: Partial<Components> = {
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
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
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
    }

    const language = extractLanguage(className)

    return (
      <LazyCodeBlock
        className={className}
        code={children as string}
        language={language}
      />
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
  table: function TableComponent({ children, ...props }) {
    return (
      <div className="markdown-table-scroll" tabIndex={0} role="region" aria-label="Scrollable table">
        <table {...props}>{children}</table>
      </div>
    )
  },
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId()
  const blockId = id ?? generatedId
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children])

  return (
    <div className={cn("max-w-full min-w-0", className)}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
