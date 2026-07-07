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

/**
 * A message queued mid-turn normally flushes on the next `agent_end`. But a
 * mid-turn disconnect finalizes the turn locally (see pi-bridge-client's close
 * handler) without ever emitting that `agent_end` — so without this, anything
 * queued before the drop sits stuck until an unrelated future turn happens to
 * end. On reconnect, once the client is no longer marked streaming, treat that
 * as the missed turn-end and flush the queue.
 */
export function shouldFlushQueueOnReconnect(
  queueLength: number,
  streaming: boolean
): boolean {
  return queueLength > 0 && !streaming;
}
