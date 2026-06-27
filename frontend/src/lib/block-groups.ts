import type { TurnBlock } from "@/lib/types"

export type BlockGroup =
  | { kind: "thinking"; blocks: Extract<TurnBlock, { kind: "thinking" }>[] }
  | { kind: "text"; block: Extract<TurnBlock, { kind: "text" }> }
  | { kind: "tools"; blocks: Extract<TurnBlock, { kind: "tool" }>[] }
  | { kind: "tool"; block: Extract<TurnBlock, { kind: "tool" }> }

export function groupTurnBlocks(blocks: TurnBlock[]): BlockGroup[] {
  const groups: BlockGroup[] = []

  for (const block of blocks) {
    if (block.kind === "thinking") {
      const last = groups[groups.length - 1]
      if (last?.kind === "thinking") {
        last.blocks.push(block)
      } else {
        groups.push({ kind: "thinking", blocks: [block] })
      }
      continue
    }

    if (block.kind === "tool") {
      const last = groups[groups.length - 1]
      if (last?.kind === "tools") {
        last.blocks.push(block)
      } else {
        groups.push({ kind: "tools", blocks: [block] })
      }
      continue
    }

    if (block.kind === "text") {
      groups.push({ kind: "text", block })
    }
  }

  return groups
}
