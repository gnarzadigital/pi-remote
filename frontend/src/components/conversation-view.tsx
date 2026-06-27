import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, Copy, Check } from "lucide-react";
import { useState } from "react";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import type { ChatLine, TurnBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

const STICK_ZONE_PX = 80;

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-2 overflow-hidden rounded-[10px] border border-hairline bg-mist">
      <button
        type="button"
        className="absolute top-2 right-2 rounded-[6px] border border-hairline bg-chalk px-2 py-0.5 text-[11px] text-concrete hover:text-graphite"
        onClick={() => {
          navigator.clipboard.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
      <pre className="max-w-full overflow-x-auto p-3 pt-8 font-mono text-[13px] leading-relaxed text-graphite whitespace-pre-wrap break-words">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function ThinkingBlock({ block }: { block: Extract<TurnBlock, { kind: "thinking" }> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-[12px] text-concrete hover:text-graphite"
        aria-expanded={expanded}
      >
        <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
        Thinking{block.streaming ? "…" : ""}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <pre className="mt-1 max-h-48 overflow-auto rounded-[10px] border border-hairline bg-mist p-2 font-mono text-[12px] text-concrete whitespace-pre-wrap">
            {block.text}
          </pre>
        </div>
      </div>
    </div>
  );
}

function ToolBlock({ block }: { block: Extract<TurnBlock, { kind: "tool" }> }) {
  return (
    <div
      className={cn(
        "my-2 rounded-[10px] border border-hairline bg-mist p-3 text-[13px]",
        block.status === "error" && "border-graphite/30"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-graphite">{block.name}</span>
        <span className="text-[11px] uppercase text-concrete">{block.status}</span>
      </div>
      {block.output && (
        <pre className="mt-2 max-h-40 overflow-auto font-mono text-[12px] text-concrete whitespace-pre-wrap">
          {block.output}
        </pre>
      )}
    </div>
  );
}

function TurnLine({ line }: { line: Extract<ChatLine, { kind: "turn" }> }) {
  return (
    <div className="space-y-1 py-2">
      <div className="text-[11px] font-medium text-concrete">
        {line.streaming ? "glm" : "Assistant"}
      </div>
      {line.blocks.map((block, i) => {
        if (block.kind === "text") {
          return (
            <div
              key={i}
              className="w-full max-w-full overflow-hidden rounded-[14px] border border-hairline bg-card px-3 py-2.5 text-[14px] leading-relaxed text-graphite break-words [overflow-wrap:anywhere]"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children }) => (
                    <div className="my-2 max-w-full overflow-x-auto">{children}</div>
                  ),
                  table: ({ children }) => (
                    <div className="my-2 max-w-full overflow-x-auto">
                      <table className="w-full border-collapse text-[13px]">{children}</table>
                    </div>
                  ),
                  code: ({ className, children }) => {
                    const text = String(children).replace(/\n$/, "");
                    if (className?.includes("language-")) {
                      return <CodeBlock>{text}</CodeBlock>;
                    }
                    return (
                      <code className="rounded-[4px] bg-mist px-1 py-0.5 font-mono text-[13px]">{children}</code>
                    );
                  },
                }}
              >
                {block.text + (block.streaming ? " ▍" : "")}
              </ReactMarkdown>
            </div>
          );
        }
        if (block.kind === "thinking") {
          return <ThinkingBlock key={i} block={block} />;
        }
        if (block.kind === "tool") {
          return <ToolBlock key={i} block={block} />;
        }
        return null;
      })}
    </div>
  );
}

export function ConversationView() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const lineCountRef = useRef(0);
  const { snapshot } = usePiBridge();

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < STICK_ZONE_PX;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const lineCount = snapshot.lines.length;
    const addedLines = lineCount > lineCountRef.current;
    lineCountRef.current = lineCount;

    if (snapshot.streaming || addedLines || stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [snapshot.lines, snapshot.streaming]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3 [overflow-anchor:auto]"
      onScroll={() => {
        stickToBottomRef.current = isNearBottom();
      }}
    >
      {snapshot.lines.map((line) => {
        if (line.kind === "user") {
          return (
            <div key={line.id} className="mb-4 flex flex-col items-end gap-1">
              <span className="text-[11px] text-concrete">You</span>
              <div className="max-w-[92%] rounded-[14px] border border-hairline bg-mist px-3 py-2.5 text-[14px] text-graphite">
                {line.text}
              </div>
            </div>
          );
        }
        if (line.kind === "system") {
          return (
            <p key={line.id} className="my-2 text-center text-[12px] text-concrete italic">
              {line.text}
            </p>
          );
        }
        if (line.kind === "error") {
          return (
            <p key={line.id} className="my-2 text-center text-[12px] text-graphite">
              {line.text}
            </p>
          );
        }
        return <TurnLine key={line.id} line={line} />;
      })}
    </div>
  );
}
