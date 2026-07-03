// Bridge-side multi-agent orchestration. ADDITIVE: this does not touch the primary
// single-pi chat path. It spawns parallel agents / subagents into real cmux panes via
// the cmux-agent wrapper, records lineage (parentId — cmux's registry is flat), and
// reports a merged status tree for the mobile nested picker.
//
// no-mock: shells out to the real ~/.agents/scripts/cmux-agent. If cmux is unavailable
// spawn fails loudly rather than faking success.

import { execFileSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
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

/** Merge our lineage store with live cmux registry status. */
export function listAgents(): SpawnedAgent[] {
  const agents = load();
  let registry: Record<string, { status?: string }> = {};
  try {
    const raw = execFileSync(CMUX_AGENT, ["list", "--all"], { encoding: "utf8", timeout: 5000 });
    registry = JSON.parse(raw) as Record<string, { status?: string }>;
  } catch {
    // cmux unavailable — return stored view
  }
  for (const a of Object.values(agents)) {
    if (a.surface && registry[a.surface]) {
      a.status = mapStatus(registry[a.surface].status);
    }
  }
  save(agents);
  return Object.values(agents).sort((x, y) => y.spawnedAt - x.spawnedAt);
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
