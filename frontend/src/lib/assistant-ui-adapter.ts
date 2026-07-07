import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatLine, TurnBlock } from "@/lib/types";

/**
 * Pure conversion: pi-remote's existing streamed transcript (`ChatLine[]`,
 * read from `usePiBridge().snapshot.lines`) -> assistant-ui's
 * `ExternalStoreRuntime` message shape. Called on every `snapshot.lines`
 * change (i.e. every bridge delta), not a one-time conversion. No backend or
 * reducer changes: reads the exact same `lines` `ConversationView` already
 * reads.
 */
export function chatLineToThreadMessage(line: ChatLine): ThreadMessageLike | null {
  if (line.kind === "user") {
    return { id: line.id, role: "user", content: [{ type: "text", text: line.text }] };
  }
  if (line.kind === "system" || line.kind === "error") {
    // assistant-ui has no first-class "system banner in transcript" concept;
    // rendered as a plain assistant text part for the spike. Banner styling
    // parity is out of scope (see qa/composer-keyboard-checklist.md scope note).
    return { id: line.id, role: "assistant", content: [{ type: "text", text: line.text }] };
  }
  if (line.kind === "turn") {
    return {
      id: line.id,
      role: "assistant",
      content: turnBlocksToParts(line.blocks),
      status: line.streaming ? { type: "running" } : { type: "complete", reason: "stop" },
    };
  }
  return null;
}

export function chatLinesToThreadMessages(lines: ChatLine[]): ThreadMessageLike[] {
  return lines.map(chatLineToThreadMessage).filter((m): m is ThreadMessageLike => m !== null);
}

type ThreadContentParts = Extract<ThreadMessageLike["content"], readonly unknown[]>;

function turnBlocksToParts(blocks: TurnBlock[]): ThreadContentParts {
  return blocks.map((b): ThreadContentParts[number] => {
    if (b.kind === "text") return { type: "text", text: b.text };
    if (b.kind === "thinking") return { type: "reasoning", text: b.text };
    return {
      type: "tool-call",
      toolCallId: b.id,
      toolName: b.name,
      args: b.args ? JSON.parse(b.args) : {},
      result: b.output,
      isError: b.status === "error",
    };
  });
}
