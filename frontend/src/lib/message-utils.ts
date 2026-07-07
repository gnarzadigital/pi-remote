import type { ImageAttachment, TurnBlock } from "./types";

let idCounter = 0;
export function uid(prefix = "id"): string {
  return `${prefix}-${++idCounter}-${Date.now()}`;
}

/**
 * Force-finalize a turn's blocks when it ends abnormally (agent_end, or a
 * disconnect finalized as a synthetic agent_end): clears the streaming flag
 * on text/thinking blocks AND flips any tool block still `status: "running"`
 * to `"error"` — a tool_execution_end can be lost the same way a text_delta's
 * trailing chunk can, and without this a tool card spins forever.
 */
export function finalizeTurnBlocks(blocks: TurnBlock[]): TurnBlock[] {
  return blocks.map((b) => {
    if (b.kind === "text" || b.kind === "thinking") return { ...b, streaming: false };
    if (b.kind === "tool" && b.status === "running") {
      return { ...b, status: "error" as const, output: b.output ?? "Interrupted" };
    }
    return b;
  });
}

/**
 * capture_agent_pane responses carry no agentId (bridge.ts only echoes back
 * `text`), and the terminal view's 3s auto-refresh keeps a request in flight
 * per agent. Switching from viewing agent A to agent B before A's response
 * lands used to blindly merge into whatever `peek` is current, painting
 * agent A's stale terminal text under agent B's header. Correlate by request
 * id (tracked client-side per capturePane() call) and only apply a response
 * whose requested agentId still matches the currently-viewed peek.
 */
export function shouldApplyCapturePaneResponse(
  requestedAgentId: string | undefined,
  currentPeekAgentId: string | null
): boolean {
  return requestedAgentId !== undefined && requestedAgentId === currentPeekAgentId;
}

/**
 * The 3s auto-refresh poll and a manual "Refresh" tap can both have a
 * capture_agent_pane request in flight for the same agent at once. If a
 * slower, earlier-issued request's response lands after a faster, later
 * one already rendered, applying it would silently regress the pane back to
 * older text. Only the response matching the most recently issued request
 * for that agent should be applied; older, superseded ones are dropped.
 */
export function isLatestCapturePaneRequest(
  requestId: string | undefined,
  requestedAgentId: string | undefined,
  latestRequestIdForAgent: string | undefined
): boolean {
  return requestId !== undefined && requestedAgentId !== undefined && requestId === latestRequestIdForAgent;
}

/**
 * resolve_agent_session (attachToAgent) has the same out-of-order risk as
 * capture_agent_pane, but was never correlated at all — the handler read a
 * single mutable `pendingAttachAgentId` field instead of matching the
 * response to the request that produced it. Tapping agent A then agent B
 * (before A's slower, real filesystem scan for its newest session file
 * returned) let A's stale response win: it read `pendingAttachAgentId`
 * *after* B's tap had already overwritten it, attaching B's chat view to
 * A's session file. Only the most recently issued request should apply.
 */
export function isLatestAttachRequest(
  requestId: string | undefined,
  latestRequestId: string | null
): boolean {
  return requestId !== undefined && requestId === latestRequestId;
}

/**
 * extensionDialog is a single slot (BridgeSnapshot). If a second
 * extension_ui_request (from the primary session or an attached agent) lands
 * while a prior one is still unresolved, the handler used to just overwrite
 * the slot — the first request's `id` was never responded to, leaving pi's
 * tool call blocked waiting forever while the user only ever saw the second
 * dialog. Auto-cancel any different, still-pending request before replacing it.
 */
export function shouldAutoCancelPendingDialog(
  pendingId: string | undefined,
  incomingId: string
): boolean {
  return pendingId !== undefined && pendingId !== incomingId;
}

/**
 * statusError has three independent writers (bridge_error, a failed
 * handleResponse, "agent session not ready yet"), each scheduling its own
 * auto-clear timeout. Without a generation token, an earlier error's timer
 * firing after a second, unrelated error already replaced the message would
 * blindly null it out early — dismissing the newer toast before its own
 * duration elapsed. Only the clear scheduled by the most recent
 * setStatusError call should actually apply.
 */
export function isLatestStatusErrorToken(token: number, latestToken: number): boolean {
  return token === latestToken;
}

export function extractUserText(content: unknown): string {
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content
      .filter((c): c is { type: string; text: string } => c?.type === "text")
      .map((c) => c.text)
      .join("");
  }

  const skillMatch = text.match(/<skill\s+name="([^"]+)"/);
  if (skillMatch) {
    const argsAfter = text.replace(/<skill[^>]*>[\s\S]*?<\/skill>/g, "").trim();
    return `/skill:${skillMatch[1]}${argsAfter ? ` ${argsAfter}` : ""}`;
  }

  const promptMatch = text.match(/<prompt\s+name="([^"]+)"/);
  if (promptMatch) {
    const argsAfter = text.replace(/<prompt[^>]*>[\s\S]*?<\/prompt>/g, "").trim();
    return `/prompt:${promptMatch[1]}${argsAfter ? ` ${argsAfter}` : ""}`;
  }

  return text
    .replace(/<skill[^>]*>[\s\S]*?<\/skill>/g, "")
    .replace(/<prompt[^>]*>[\s\S]*?<\/prompt>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractUserImages(content: unknown): ImageAttachment[] {
  if (!Array.isArray(content)) return [];
  return content.filter(
    (c): c is ImageAttachment =>
      c?.type === "image" && typeof c.data === "string" && typeof c.mimeType === "string"
  );
}

export function extractToolResultText(content: unknown): string {
  if (!Array.isArray(content)) return String(content ?? "");
  return content
    .filter((c): c is { type: string; text: string } => c?.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export function getModelContextWindowTokens(model: Record<string, unknown> | null): number | null {
  if (!model) return null;
  const direct = [
    model.contextWindow,
    model.context_window,
    model.maxContextTokens,
    model.max_context_tokens,
  ];
  for (const v of direct) {
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}

export function getContextUsedTokens(data: { tokens?: Record<string, number> } | null): number | null {
  if (!data?.tokens) return null;
  const t = data.tokens;
  for (const k of ["context", "contextTokens", "context_tokens", "prompt", "input", "total"] as const) {
    const v = t[k];
    if (typeof v === "number" && v >= 0) return v;
  }
  return null;
}

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Session diagnostics for overflow menus — no model name or Ready/Running noise. */
export function formatSessionMeta(
  connected: boolean,
  stats: { tokens?: Record<string, number> } | null,
  contextWindow: number | null
): string | null {
  if (!connected) return "Connecting…";

  const parts: string[] = [];
  if (stats?.tokens?.total != null) {
    parts.push(`${formatTokenCount(stats.tokens.total)} tok`);
  }
  const used = getContextUsedTokens(stats);
  if (used != null && contextWindow != null && contextWindow > 0) {
    parts.push(`${Math.min(100, Math.round((used / contextWindow) * 100))}% ctx`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildStatusText(
  connected: boolean,
  streaming: boolean,
  model: { name?: string; id?: string } | null,
  stats: { tokens?: Record<string, number> } | null,
  contextWindow: number | null
): string {
  if (!connected) return "Connecting…";
  const parts: string[] = [streaming ? "Running" : "Ready"];
  if (model) parts.push(model.name ?? model.id ?? "");
  if (stats?.tokens?.total != null) {
    parts.push(`${formatTokenCount(stats.tokens.total)} tok`);
  }
  const used = getContextUsedTokens(stats);
  if (used != null && contextWindow != null && contextWindow > 0) {
    parts.push(`${Math.min(100, Math.round((used / contextWindow) * 100))}% ctx`);
  }
  return parts.filter(Boolean).join(" · ");
}
