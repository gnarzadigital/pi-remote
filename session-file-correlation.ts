// Correlate a chained get_state answer back to the new_session/switch_session
// request that triggered it. pi's own new_session/switch_session RPC responses
// never carry a sessionFile (confirmed against the installed pi binary's
// rpc-mode.js) — only get_state does. The bridge chains an internal get_state
// call after a successful new_session/switch_session and uses this to build
// the enriched response once that chained call resolves.

export interface PendingSessionFileLookup {
  originalId: string;
  originalCommand: "new_session" | "switch_session";
  originalData: unknown;
}

export interface CorrelatedSessionResponse {
  type: "response";
  command: "new_session" | "switch_session";
  id: string;
  success: true;
  data: Record<string, unknown>;
}

/**
 * Build the enriched new_session/switch_session response, merging the real
 * sessionFile (from a chained get_state) into the original response's shape.
 */
export function buildCorrelatedSessionResponse(
  pending: PendingSessionFileLookup,
  getStateData: { sessionFile?: string } | undefined
): CorrelatedSessionResponse {
  const originalData =
    pending.originalData && typeof pending.originalData === "object"
      ? (pending.originalData as Record<string, unknown>)
      : {};
  return {
    type: "response",
    command: pending.originalCommand,
    id: pending.originalId,
    success: true,
    data: { ...originalData, sessionFile: getStateData?.sessionFile },
  };
}
