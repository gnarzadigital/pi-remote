/**
 * Only "pi" agents support the rich RPC chat attach (3.8-full) — claude/codex/
 * other runtimes use an entirely different session protocol, so attaching a
 * pi --mode rpc process to them is not possible. Tapping one of those rows
 * should fall back to steer (the one action that works for any runtime via
 * `cmux send`), not silently attempt and fail an attach.
 */
export function canAttachChat(runtime?: string): boolean {
  return (runtime ?? "pi").toLowerCase() === "pi";
}

/** Short display label for the runtime badge on an inbox row. */
export function runtimeLabel(runtime?: string): string {
  const r = (runtime ?? "pi").toLowerCase();
  const map: Record<string, string> = {
    pi: "pi",
    claude: "claude",
    codex: "codex",
    hermes: "hermes",
    "cursor-agent": "cursor",
    antigravity: "agy",
    agent: "agent",
  };
  return map[r] ?? r;
}

/**
 * Stable identity key for a terminal-runtime agent's pane-watch effect.
 * AgentInbox's 5s poll replaces `snapshot.agents` wholesale, so a freshly
 * fetched AgentTreeNode for the SAME agent is a new object reference every
 * time even when nothing changed. Keying a useEffect on the object itself
 * re-runs it every poll tick; keying on this string only re-runs it when the
 * agent actually changes (or its pane target moves to a new surface).
 */
export function terminalWatchKey(agent: { id: string; surface: string | null; workspace?: string | null }): string {
  return `${agent.id}|${agent.surface ?? ""}|${agent.workspace ?? ""}`;
}
