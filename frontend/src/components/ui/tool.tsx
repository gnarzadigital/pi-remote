"use client"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronDown, Loader2 } from "lucide-react"
import { useState } from "react"

export type ToolPart = {
  type: string
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  toolCallId?: string
  errorText?: string
}

export type ToolProps = {
  toolPart: ToolPart
  defaultOpen?: boolean
  className?: string
}

function statusLabel(state: ToolPart["state"]) {
  switch (state) {
    case "input-streaming":
      return "Running…"
    case "input-available":
      return "Ready"
    case "output-error":
      return "Error"
    default:
      return null
  }
}

const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const { state, input, output, toolCallId } = toolPart
  const label = statusLabel(state)

  const formatValue = (value: unknown): string => {
    if (value === null) return "null"
    if (value === undefined) return "undefined"
    if (typeof value === "string") return value
    if (typeof value === "object") return JSON.stringify(value, null, 2)
    return String(value)
  }

  const outputText =
    output && "result" in output
      ? formatValue(output.result)
      : output
        ? formatValue(output)
        : ""

  return (
    <div className={cn("overflow-hidden rounded-[10px] border border-hairline bg-mist", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto w-full justify-between rounded-none px-3 py-2.5 font-normal hover:bg-mist/80"
          >
            <div className="flex min-w-0 items-center gap-2">
              {state === "input-streaming" ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-concrete" />
              ) : (
                <ChevronDown
                  className={cn("size-3.5 shrink-0 text-concrete transition-transform", isOpen && "rotate-180")}
                />
              )}
              <span className="truncate font-mono text-[13px] font-medium text-graphite">
                {toolPart.type}
              </span>
            </div>
            {label && <span className="shrink-0 text-[11px] text-concrete">{label}</span>}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-hairline">
          <div className="space-y-2 p-3">
            {input && Object.keys(input).length > 0 && (
              <div>
                <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-concrete">
                  Input
                </h4>
                <pre className="max-h-32 overflow-auto rounded-[8px] border border-hairline bg-chalk p-2 font-mono text-[12px] text-graphite whitespace-pre-wrap">
                  {Object.entries(input)
                    .map(([key, value]) => `${key}: ${formatValue(value)}`)
                    .join("\n")}
                </pre>
              </div>
            )}
            {outputText && (
              <div>
                <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-concrete">
                  Output
                </h4>
                <pre className="max-h-40 overflow-auto rounded-[8px] border border-hairline bg-chalk p-2 font-mono text-[12px] text-concrete whitespace-pre-wrap">
                  {outputText}
                </pre>
              </div>
            )}
            {state === "output-error" && toolPart.errorText && (
              <p className="text-[12px] text-graphite">{toolPart.errorText}</p>
            )}
            {toolCallId && (
              <p className="border-t border-hairline pt-2 font-mono text-[10px] text-concrete">
                {toolCallId}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export { Tool }
