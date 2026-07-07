import type { ChatLine, TurnBlock } from "./types";
import { extractToolResultText, finalizeTurnBlocks } from "./message-utils";

export interface AgentChatState {
  lines: ChatLine[];
  streaming: boolean;
  /** Internal: current turn id + tool-callId -> block-index, while streaming. */
  turnId: string | null;
  toolIndex: Record<string, number>;
}

export function initialAgentChatState(): AgentChatState {
  return { lines: [], streaming: false, turnId: null, toolIndex: {} };
}

/**
 * The optimistic user-message append (sendToAttachedAgent) and every other
 * writer of attachedAgentLines must share the same source of truth
 * (state.lines), or the next agent_event reduces on top of state that never
 * saw the just-sent message and clobbers it out of the snapshot.
 */
export function appendUserLine(state: AgentChatState, id: string, text: string): AgentChatState {
  return { ...state, lines: [...state.lines, { id, kind: "user", text }] };
}

/**
 * The bridge tears down an attached agent's RPC process when its owning
 * WebSocket closes (bridge.ts detachAgentsForClient). If the client was still
 * attached when a mid-turn disconnect happened, a bare reconnect leaves the
 * UI showing "attached" while the agentId is dead server-side — any further
 * send silently no-ops (sendToRpcAgent finds nothing to write to). Re-attach
 * with the same agentId + sessionPath on reconnect to restore it.
 */
export function shouldReattachAgentOnReconnect(
  attachedAgentId: string | null,
  attachedSessionPath: string | null
): boolean {
  return attachedAgentId !== null && attachedSessionPath !== null;
}

/**
 * The `attach_agent` response handler resets the agent-chat transcript to
 * blank on every success, which is correct for a genuinely new attach (the
 * user just opened this agent's chat and should see it start empty) but
 * wrong for the reconnect flow above: that flow re-sends `attach_agent` for
 * the SAME agent the client was already viewing, and the response looks
 * identical on the wire. Without this check, any WS blip while watching an
 * attached agent's live stream silently blanks the transcript the user was
 * reading. Distinguish by comparing the incoming agentId against the one
 * already attached client-side (only null before a genuinely fresh attach,
 * since detach clears it and a disconnect alone does not).
 */
export function isReconnectReattach(
  currentAttachedAgentId: string | null,
  incomingAgentId: string
): boolean {
  return currentAttachedAgentId === incomingAgentId;
}

let seq = 0;
function uid(prefix: string): string {
  return `${prefix}-${++seq}`;
}

function patchTurnBlocks(
  state: AgentChatState,
  updater: (blocks: TurnBlock[]) => TurnBlock[]
): AgentChatState {
  if (!state.turnId) return state;
  const lines = state.lines.map((l) => {
    if (l.id !== state.turnId || l.kind !== "turn") return l;
    return { ...l, blocks: updater([...l.blocks]) };
  });
  return { ...state, lines };
}

function patchToolBlock(
  state: AgentChatState,
  toolCallId: string,
  patch: Partial<Extract<TurnBlock, { kind: "tool" }>>
): AgentChatState {
  const idx = state.toolIndex[toolCallId];
  if (idx == null) return state;
  return patchTurnBlocks(state, (blocks) => {
    const copy = [...blocks];
    const b = copy[idx];
    if (b?.kind === "tool") copy[idx] = { ...b, ...patch };
    return copy;
  });
}

/**
 * Pure reducer: fold one tagged `agent_event` (a raw pi RPC event, same shape as
 * the primary session's event stream) into per-agent chat state. Mirrors the
 * primary reducer logic in pi-bridge-client.ts (handleMessageUpdate/updateTool)
 * but as a standalone pure function so an attached agent's chat can be tested
 * and rendered independently of the primary snapshot.
 */
export function reduceAgentEvent(
  state: AgentChatState,
  event: Record<string, unknown>
): AgentChatState {
  switch (event.type) {
    case "agent_start": {
      const turnId = uid("turn");
      return {
        ...state,
        streaming: true,
        turnId,
        toolIndex: {},
        lines: [...state.lines, { id: turnId, kind: "turn", blocks: [], streaming: true }],
      };
    }

    case "agent_end": {
      const lines = state.lines.map((l) =>
        l.id === state.turnId && l.kind === "turn"
          ? { ...l, streaming: false, blocks: finalizeTurnBlocks(l.blocks) }
          : l
      );
      return { ...state, lines, streaming: false, turnId: null, toolIndex: {} };
    }

    case "message_update": {
      const e = (event.assistantMessageEvent as Record<string, unknown>) ?? {};
      if (!state.turnId) return state;

      if (e.type === "text_delta") {
        return patchTurnBlocks(state, (blocks) => {
          const last = blocks[blocks.length - 1];
          if (last?.kind === "text") {
            return [...blocks.slice(0, -1), { ...last, text: last.text + String(e.delta ?? ""), streaming: true }];
          }
          return [...blocks, { kind: "text", text: String(e.delta ?? ""), streaming: true }];
        });
      }

      if (e.type === "thinking_delta") {
        return patchTurnBlocks(state, (blocks) => {
          let idx = -1;
          for (let i = blocks.length - 1; i >= 0; i--) {
            if (blocks[i].kind === "thinking") { idx = i; break; }
          }
          if (idx >= 0) {
            const copy = [...blocks];
            const tb = copy[idx];
            if (tb.kind === "thinking") copy[idx] = { ...tb, text: tb.text + String(e.delta ?? ""), streaming: true };
            return copy;
          }
          return [...blocks, { kind: "thinking", text: String(e.delta ?? ""), streaming: true }];
        });
      }

      if (e.type === "toolcall_end") {
        const tc = e.toolCall as Record<string, unknown> | undefined;
        if (!tc?.id) return state;
        const id = String(tc.id);
        const existingIdx = state.toolIndex[id];
        if (existingIdx == null) {
          let newIdx = 0;
          const next = patchTurnBlocks(state, (blocks) => {
            newIdx = blocks.length;
            return [
              ...blocks,
              {
                kind: "tool" as const,
                id,
                name: String(tc.name ?? "…"),
                args: tc.arguments ? JSON.stringify(tc.arguments, null, 2) : undefined,
                status: "running" as const,
              },
            ];
          });
          return { ...next, toolIndex: { ...next.toolIndex, [id]: newIdx } };
        }
        return patchTurnBlocks(state, (blocks) => {
          const copy = [...blocks];
          const b = copy[existingIdx];
          if (b?.kind === "tool") {
            copy[existingIdx] = {
              ...b,
              name: String(tc.name ?? b.name),
              args: tc.arguments ? JSON.stringify(tc.arguments, null, 2) : b.args,
            };
          }
          return copy;
        });
      }
      return state;
    }

    case "tool_execution_start":
      return patchToolBlock(state, String(event.toolCallId ?? ""), { status: "running" });

    case "tool_execution_update":
      return patchToolBlock(state, String(event.toolCallId ?? ""), {
        output: extractToolResultText((event.partialResult as { content?: unknown } | undefined)?.content),
      });

    case "tool_execution_end":
      return patchToolBlock(state, String(event.toolCallId ?? ""), {
        status: event.isError ? "error" : "done",
        output: extractToolResultText((event.result as { content?: unknown } | undefined)?.content),
      });

    default:
      return state;
  }
}
