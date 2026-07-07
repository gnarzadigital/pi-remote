import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "@/components/ui/chain-of-thought"
import { Markdown } from "@/components/ui/markdown"
import { TextShimmer } from "@/components/ui/text-shimmer"
import type { TurnBlock } from "@/lib/types"
import { parseThinkingItems, stepTitle } from "@/lib/thinking-steps"
import { Brain } from "lucide-react"

type ThinkingBlock = Extract<TurnBlock, { kind: "thinking" }>

export function ThinkingChain({
  blocks,
}: {
  blocks: ThinkingBlock[]
}) {
  if (blocks.length === 0) return null

  const anyStreaming = blocks.some((b) => b.streaming)

  return (
    <div className="my-1 space-y-2 rounded-[10px] border border-hairline bg-mist/50 px-3 py-2">
      <div className="flex items-center gap-2 text-[12px] font-medium text-concrete">
        <Brain className="size-3.5 shrink-0" />
        {anyStreaming ? (
          <TextShimmer className="text-[12px]">Chain of thought</TextShimmer>
        ) : (
          <span>Chain of thought</span>
        )}
      </div>
      <ChainOfThought>
        {blocks.map((block, blockIdx) => {
          const items = parseThinkingItems(block.text)
          const title = stepTitle(block.text, blockIdx, !!block.streaming)
          return (
            <ChainOfThoughtStep
              key={blockIdx}
              defaultOpen={block.streaming || blockIdx === blocks.length - 1}
            >
              <ChainOfThoughtTrigger
                leftIcon={<Brain className="size-3.5" />}
                className="text-[13px] text-concrete hover:text-graphite"
              >
                {title}
                {block.streaming ? "…" : ""}
              </ChainOfThoughtTrigger>
              <ChainOfThoughtContent>
                {items.map((item, itemIdx) => (
                  <ChainOfThoughtItem
                    key={itemIdx}
                    className="text-[12px] leading-relaxed text-concrete"
                  >
                    <Markdown
                      className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1"
                      streaming={block.streaming}
                    >
                      {item}
                    </Markdown>
                  </ChainOfThoughtItem>
                ))}
              </ChainOfThoughtContent>
            </ChainOfThoughtStep>
          )
        })}
      </ChainOfThought>
    </div>
  )
}
