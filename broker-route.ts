// Route a client command to the right pi agent process when the bridge runs N of
// them. Mirrors Picot's broker discipline: session route wins; explicit agentId
// next; single-live fallback; REFUSE to guess when >1 agent is live (so a command
// from one agent can never be misrouted into another).

export type RouteResult =
  | { ok: true; agentId: string }
  | { ok: false; reason: "no_route" | "ambiguous" | "unknown_agent" };

export interface RouteInput {
  agentId?: string;
  sessionId?: string;
}

export function resolveRoute(
  cmd: RouteInput,
  routes: Map<string, string>, // sessionId -> agentId
  liveAgents: Set<string>
): RouteResult {
  // 1. Explicit agent id.
  if (cmd.agentId) {
    return liveAgents.has(cmd.agentId)
      ? { ok: true, agentId: cmd.agentId }
      : { ok: false, reason: "unknown_agent" };
  }

  // 2. Session route learned from upstream traffic.
  if (cmd.sessionId) {
    const mapped = routes.get(cmd.sessionId);
    if (mapped && liveAgents.has(mapped)) return { ok: true, agentId: mapped };
    // A known session whose process died, or an unseen session.
    if (mapped) return { ok: false, reason: "unknown_agent" };
  }

  // 3. Single-live fallback — only safe with exactly one agent.
  if (liveAgents.size === 1) {
    return { ok: true, agentId: [...liveAgents][0]! };
  }

  // 4. Ambiguous: 2+ live and no route → refuse to guess.
  return { ok: false, reason: liveAgents.size === 0 ? "no_route" : "ambiguous" };
}

/**
 * Keep the session→agent map 1:1. When an agent reports a (possibly new) session,
 * drop any other session that pointed at that agent so an in-place session switch
 * doesn't leave a stale id hijacking commands.
 */
export function setRoute(routes: Map<string, string>, sessionId: string, agentId: string): void {
  for (const [sid, aid] of routes) {
    if (aid === agentId && sid !== sessionId) routes.delete(sid);
  }
  routes.set(sessionId, agentId);
}
