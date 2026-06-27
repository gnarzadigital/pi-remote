import type { ToolPart } from "@/components/ui/tool";
import type { TurnBlock } from "@/lib/types";

export function mapToolBlock(block: Extract<TurnBlock, { kind: "tool" }>): ToolPart {
  let state: ToolPart["state"] = "output-available";
  if (block.status === "running") state = "input-streaming";
  if (block.status === "error") state = "output-error";

  return {
    type: block.name,
    state,
    output: block.output ? { result: block.output } : undefined,
    errorText: block.status === "error" ? block.output ?? "Tool failed" : undefined,
  };
}
