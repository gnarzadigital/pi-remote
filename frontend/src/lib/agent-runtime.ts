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

/** Existing/ambient cmux Pi panes look like runtime="pi", but they are
 * interactive terminals, not pi-remote-owned RPC children. Opening those as
 * rich chat can resolve the wrong session and render blank. Only use rich chat
 * when the agent has a real spawn timestamp + cwd from pi-remote/canonical
 * registry metadata; otherwise use terminal capture, which works for any cmux
 * pane. */
export function canOpenRichAgentChat(agent: {
  runtime?: string;
  spawnedAt?: number;
  cwd?: string | null;
}): boolean {
  return canAttachChat(agent.runtime) && (agent.spawnedAt ?? 0) > 0 && Boolean(agent.cwd);
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
