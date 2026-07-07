import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { Tool, type ToolPart } from "@/components/ui/tool";

/**
 * Proof-of-concept for the "hybrid" integration pattern: assistant-ui calls
 * this component for every tool-call part (wired via `Thread`'s
 * `components.ToolFallback` prop in spike-thread.tsx), and it hands off to
 * pi-remote's OWN existing `Tool` component completely unchanged — no
 * rebuilt tool-card UI. This same mechanism is what would later host the
 * thinking-chain (`reasoning` parts, via `components.ReasoningGroup`) and
 * tool-batch grouping (`components.ToolGroup`) ports.
 */
export const SpikeToolPart: ToolCallMessagePartComponent = ({
  toolName,
  toolCallId,
  args,
  result,
  status,
}) => {
  const toolPart: ToolPart = {
    type: toolName,
    toolCallId,
    input: args as Record<string, unknown> | undefined,
    state: mapStatusToState(status.type),
    output: result ? { result } : undefined,
    errorText: status.type === "incomplete" && status.reason === "error" ? String(result ?? "Tool failed") : undefined,
  };

  return <Tool toolPart={toolPart} />;
};

function mapStatusToState(statusType: string): ToolPart["state"] {
  if (statusType === "running") return "input-streaming";
  if (statusType === "incomplete") return "output-error";
  return "output-available";
}
