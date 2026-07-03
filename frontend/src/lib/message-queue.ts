import type { SendMode } from "@/lib/types";

/**
 * Whether a send should be QUEUED (held until the current turn ends) rather than
 * delivered now. We queue only a plain prompt typed while the agent is streaming
 * and with no pending images. Steer/Follow-up are deliberate mid-turn interjections
 * and always send immediately; images send immediately (queue is text-only).
 */
export function shouldQueue(
  streaming: boolean,
  mode: SendMode,
  hasImages: boolean
): boolean {
  return streaming && mode === "prompt" && !hasImages;
}
