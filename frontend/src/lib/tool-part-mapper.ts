import type { ToolPart } from "@/components/ui/tool";
import type { TurnBlock } from "@/lib/types";

function parseToolArgs(args: string | undefined): Record<string, unknown> | undefined {
  if (!args) return undefined;
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function mapToolBlock(block: Extract<TurnBlock, { kind: "tool" }>): ToolPart {
  let state: ToolPart["state"] = "output-available";
  if (block.status === "running") state = "input-streaming";
  if (block.status === "error") state = "output-error";

  return {
    type: block.name,
    state,
    input: parseToolArgs(block.args),
    output: block.output ? { result: block.output } : undefined,
    errorText: block.status === "error" ? block.output ?? "Tool failed" : undefined,
    toolCallId: block.id,
  };
}
