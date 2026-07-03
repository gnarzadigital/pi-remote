// Bridge-side multi-agent orchestration. ADDITIVE: this does not touch the primary
// single-pi chat path. It spawns parallel agents / subagents into real cmux panes via
// the cmux-agent wrapper, records lineage (parentId — cmux's registry is flat), and
// reports a merged status tree for the mobile nested picker.
//
// no-mock: shells out to the real ~/.agents/scripts/cmux-agent. If cmux is unavailable
// spawn fails loudly rather than faking success.

import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export type ContextMode = "full" | "task" | "scoped";
export type AgentStatus = "active" | "awaiting-confirm" | "done" | "closed";

export interface SpawnedAgent {
  id: string;
  parentId: string | null;
  label: string;
  cwd: string;
  contextMode: ContextMode;
  surface: string | null; // cmux surface ref, e.g. "surface:88"
  status: AgentStatus;
  spawnedAt: number;
}

const CMUX_AGENT = join(homedir(), ".agents", "scripts", "cmux-agent");
const STORE = join(homedir(), ".pi-remote-agents.json");

/**
 * Shape the prompt a spawned agent receives based on how much orchestrator context
 * it should carry. Full = inherit the parent's context (fork/clone note); Task = just
 * the brief; Scoped = brief + a compacted summary the orchestrator hands off.
 * (For cmux-spawned TUI agents, context is delivered via the prompt; true RPC fork is
 * the deeper hybrid path.)
 */
export function buildSpawnPrompt(
  mode: ContextMode,
  task: string,
  opts: { parentSummary?: string; parentSessionPath?: string } = {}
): string {
  const t = task.trim();
  if (mode === "task") return t;
  if (mode === "scoped") {
    const summary = opts.parentSummary?.trim();
    return summary ? `Context from the orchestrator:\n${summary}\n\nYour task:\n${t}` : t;
  }
  // full
  const ref = opts.parentSessionPath
    ? `\n\nFull orchestrator session: ${opts.parentSessionPath} (continue that thread).`
    : "";
  const summary = opts.parentSummary?.trim();
  return `${summary ? `Full context from the orchestrator:\n${summary}\n\n` : ""}Your task:\n${t}${ref}`;
}

function load(): Record<string, SpawnedAgent> {
  try {
    return JSON.parse(readFileSync(STORE, "utf8")) as Record<string, SpawnedAgent>;
  } catch {
    return {};
  }
}

function save(agents: Record<string, SpawnedAgent>): void {
  try {
    writeFileSync(STORE, JSON.stringify(agents, null, 2));
  } catch {
    // best-effort persistence
  }
}

/** Parse "spawned: <runtime> in surface:NN" from cmux-agent spawn stdout. */
export function parseSpawnSurface(stdout: string): string | null {
  const m = stdout.match(/surface:\d+/);
  return m ? m[0] : null;
}

export interface SpawnRequest {
  cwd: string;
  task: string;
  contextMode: ContextMode;
  parentId?: string | null;
  parentSummary?: string;
  runtime?: string; // default "pi"
  now: number; // caller passes timestamp (bridge has Date.now)
}

export function spawnAgent(req: SpawnRequest): SpawnedAgent {
  const prompt = buildSpawnPrompt(req.contextMode, req.task, {
    parentSummary: req.parentSummary,
  });
  const runtime = req.runtime ?? "pi";
  const stdout = execFileSync(
    CMUX_AGENT,
    ["spawn", "--agent", runtime, "--prompt", prompt, "--cwd", req.cwd],
    { encoding: "utf8", timeout: 20000 }
  );
  const surface = parseSpawnSurface(stdout);
  const id = surface ?? `agent-${req.now}`;
  const agent: SpawnedAgent = {
    id,
    parentId: req.parentId ?? null,
    label: req.task.slice(0, 48),
    cwd: req.cwd,
    contextMode: req.contextMode,
    surface,
    status: "active",
    spawnedAt: req.now,
  };
  const agents = load();
  agents[id] = agent;
  save(agents);
  return agent;
}

interface RegistryEntry {
  runtime?: string;
  cwd?: string;
  status?: string;
  registered_at?: number;
  surface_ref?: string;
}

function cwdToSlug(cwd: string): string {
  return "--" + cwd.replace(/\//g, "-").replace(/^-/, "") + "--";
}

/**
 * For an agent we spawned with runtime "pi", find the session file pi created
 * for it: the newest .jsonl under ~/.pi/agent/sessions/<slug(cwd)>/ modified at
 * or after the agent's spawn time. Returns null if pi hasn't written one yet
 * (spawn is async — the caller should retry) or the agent isn't ours/isn't pi.
 */
export function resolveAgentSessionPath(agentId: string): string | null {
  const store = load();
  const agent = store[agentId];
  if (!agent) return null;
  const dir = join(homedir(), ".pi", "agent", "sessions", cwdToSlug(agent.cwd));
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return null;
  }
  let best: { path: string; mtime: number } | null = null;
  for (const f of files) {
    const p = join(dir, f);
    let mtime: number;
    try {
      mtime = statSync(p).mtimeMs;
    } catch {
      continue;
    }
    if (mtime < agent.spawnedAt - 5000) continue; // must be from around/after spawn
    if (!best || mtime > best.mtime) best = { path: p, mtime };
  }
  return best?.path ?? null;
}

function shortCwd(cwd?: string): string {
  if (!cwd) return "";
  return cwd.split("/").filter(Boolean).slice(-2).join("/") || cwd;
}

/**
 * Merge our lineage store (agents WE spawned, with parent lineage + context mode)
 * with the FULL live cmux registry (`cmux-agent list --all`), which spans every
 * runtime (claude, codex, pi, zai, hermes...) and every workspace — not just what
 * this phone spawned. Ambient agents we didn't spawn are surfaced as roots
 * (no parent, no context mode) so the picker reflects everything actually
 * running, matching what `/cmux-agents` shows on the desktop.
 */
export function listAgents(): SpawnedAgent[] {
  const store = load();
  let registry: Record<string, RegistryEntry> = {};
  try {
    const raw = execFileSync(CMUX_AGENT, ["list", "--all"], { encoding: "utf8", timeout: 5000 });
    registry = JSON.parse(raw) as Record<string, RegistryEntry>;
  } catch {
    // cmux unavailable — return stored view only
  }

  const bySurface = new Map<string, RegistryEntry>();
  for (const entry of Object.values(registry)) {
    if (entry.surface_ref) bySurface.set(entry.surface_ref, entry);
  }

  // Refresh status for agents we spawned ourselves.
  for (const a of Object.values(store)) {
    const live = a.surface ? bySurface.get(a.surface) : undefined;
    if (live) a.status = mapStatus(live.status);
  }
  save(store);

  // Surface every OTHER live/awaiting cmux agent we didn't spawn, across all
  // runtimes. Skip already-closed history so the picker isn't a graveyard.
  const known = new Set(Object.values(store).map((a) => a.surface).filter(Boolean));
  const foreign: SpawnedAgent[] = [];
  for (const entry of Object.values(registry)) {
    const surface = entry.surface_ref;
    if (!surface || known.has(surface)) continue;
    const status = mapStatus(entry.status);
    if (status === "closed") continue;
    foreign.push({
      id: surface,
      parentId: null,
      label: `${entry.runtime ?? "agent"} · ${shortCwd(entry.cwd)}`,
      cwd: entry.cwd ?? "",
      contextMode: "task",
      surface,
      status,
      spawnedAt: entry.registered_at ? Math.round(entry.registered_at * 1000) : 0,
    });
  }

  return [...Object.values(store), ...foreign].sort((x, y) => y.spawnedAt - x.spawnedAt);
}

function mapStatus(s?: string): AgentStatus {
  if (s === "done-awaiting-confirm") return "awaiting-confirm";
  if (s === "closed") return "closed";
  if (s === "done") return "done";
  return "active";
}

export function sendToAgent(surface: string, msg: string): void {
  execFileSync(CMUX_AGENT, ["send", "--to", surface, "--msg", msg], {
    encoding: "utf8",
    timeout: 8000,
  });
}

export function confirmAgent(surface: string): void {
  execFileSync(CMUX_AGENT, ["confirm", "--pane", surface], { encoding: "utf8", timeout: 8000 });
  const agents = load();
  if (agents[surface]) {
    agents[surface].status = "closed";
    save(agents);
  }
}
