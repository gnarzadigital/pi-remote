import type { ChatLine } from "@/lib/types"

/** Label for ThinkingBar / TextShimmer while the assistant turn is live. */
export function getStreamingLabel(lines: ChatLine[], streaming: boolean): string | null {
  if (!streaming) return null

  const turn = [...lines].reverse().find((l) => l.kind === "turn" && l.streaming)
  if (!turn || turn.kind !== "turn") return "Working"

  const blocks = turn.blocks
  if (blocks.length === 0) return "Working"

  const last = blocks[blocks.length - 1]
  if (last.kind === "thinking" && last.streaming) return "Thinking"
  if (last.kind === "tool" && last.status === "running") return "Running tool"
  if (last.kind === "text" && last.streaming) return "Responding"

  const thinking = blocks.find((b) => b.kind === "thinking" && b.streaming)
  if (thinking) return "Thinking"

  const tool = blocks.find((b) => b.kind === "tool" && b.status === "running")
  if (tool) return "Running tool"

  return "Working"
}
