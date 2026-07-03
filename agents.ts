// Bridge-side multi-agent orchestration. ADDITIVE: this does not touch the primary
// single-pi chat path. It spawns parallel agents / subagents into real cmux panes via
// the cmux-agent wrapper, records lineage (parentId — cmux's registry is flat), and
// reports a merged status tree for the mobile nested picker.
//
// no-mock: shells out to the real ~/.agents/scripts/cmux-agent. If cmux is unavailable
// spawn fails loudly rather than faking success.

import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, realpathSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export type ContextMode = "full" | "task" | "scoped";
export type AgentStatus = "active" | "awaiting-confirm" | "done" | "closed";

/**
 * Resolve a cwd to the real path pi will actually create its session dir under
 * (macOS symlinks like /tmp -> /private/tmp, otherwise cwd is returned as-is).
 * Falls back to the literal cwd if it doesn't exist / can't be resolved.
 */
export function canonicalizeCwd(cwd: string, resolver: (p: string) => string = realpathSync): string {
  try {
    return resolver(cwd);
  } catch {
    return cwd;
  }
}

export interface SpawnedAgent {
  id: string;
  parentId: string | null;
  label: string;
  cwd: string;
  contextMode: ContextMode;
  surface: string | null; // cmux surface ref, e.g. "surface:88" — UNIQUE ONLY WITHIN a workspace
  workspace: string | null; // cmux workspace ref, e.g. "default" or "workspace:22"
  /** Human workspace name from cmux (e.g. "🦷 opportunity-architecture"), display-only. */
  workspaceLabel?: string;
  /** e.g. "pi", "claude", "codex". Only "pi" agents support the rich RPC chat
   * attach (3.8-full) — other runtimes use a different session protocol entirely. */
  runtime: string;
  status: AgentStatus;
  spawnedAt: number;
}

const CMUX_AGENT = join(homedir(), ".agents", "scripts", "cmux-agent");
const CMUX_BIN = join(homedir(), "bin", "cmux"); // launchd's PATH doesn't include ~/bin — same reason CMUX_AGENT is hardcoded
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
    const parsed = JSON.parse(readFileSync(STORE, "utf8")) as Record<string, SpawnedAgent>;
    // Backfill fields added after some entries were already persisted (JSON on
    // disk doesn't get migrated just because the TS type changed) — confirmed
    // live: 8 pre-existing store entries had no `runtime` at all, showing up as
    // "undefined" in the picker. All of pi-remote's own spawns default to pi.
    for (const a of Object.values(parsed)) {
      if (!a.runtime) a.runtime = "pi";
    }
    return parsed;
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

/**
 * cmux surface refs are only unique WITHIN a workspace (confirmed live: the same
 * "surface:58" existed simultaneously in "default" and "workspace:26"). Every
 * cmux-agent call that targets a specific pane (send/confirm/status-refresh) must
 * be workspace-qualified or it can silently target the wrong agent. Find the
 * workspace for a just-spawned surface by matching surface_ref + cwd (both known
 * to us at spawn time) against the live registry — the most reliable disambiguator
 * right after spawn, before any collision could involve OUR agent specifically.
 */
export function findRegistryWorkspace(
  registry: Record<string, { surface_ref?: string; cwd?: string; registered_at?: number }>,
  surface: string,
  cwd: string
): string | null {
  let best: { workspace: string; registered_at: number } | null = null;
  for (const [key, entry] of Object.entries(registry)) {
    if (entry.surface_ref !== surface || entry.cwd !== cwd) continue;
    const workspace = key.slice(0, key.length - entry.surface_ref.length - 1); // "ws/surface:N" -> "ws"
    const registeredAt = entry.registered_at ?? 0;
    if (!best || registeredAt > best.registered_at) best = { workspace, registered_at: registeredAt };
  }
  return best?.workspace ?? null;
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
  // Canonicalize BEFORE storing, so resolveAgentSessionPath's slug matches the
  // directory pi actually creates. Storing the literal path would make session
  // resolution silently fail forever for any cwd that traverses a symlink (e.g.
  // every /tmp scratchpad path, since macOS symlinks /tmp -> /private/tmp).
  const cwd = canonicalizeCwd(req.cwd);
  const stdout = execFileSync(
    CMUX_AGENT,
    ["spawn", "--agent", runtime, "--prompt", prompt, "--cwd", cwd],
    { encoding: "utf8", timeout: 20000 }
  );
  const surface = parseSpawnSurface(stdout);
  const id = surface ?? `agent-${req.now}`;

  // Resolve the canonical "workspace:N" ref from cmux's own tree FIRST — the
  // registry (cmux-agent list --all) sometimes reports the ambiguous alias
  // "default" for the same workspace, which silently fails to match anything
  // keyed by cmux's tree ref (e.g. the title overlay in listAgents). Fall back
  // to the registry only if the pane hasn't shown up in the tree yet.
  let workspace: string | null = null;
  if (surface) {
    try {
      const treeRaw = execFileSync(CMUX_BIN, ["--json", "tree", "--all"], { encoding: "utf8", timeout: 5000 });
      workspace = findTreeWorkspace(JSON.parse(treeRaw), surface);
    } catch {
      // fall through to registry-based resolution below
    }
    if (!workspace) {
      try {
        const raw = execFileSync(CMUX_AGENT, ["list", "--all"], { encoding: "utf8", timeout: 5000 });
        workspace = findRegistryWorkspace(JSON.parse(raw), surface, cwd);
      } catch {
        // best-effort — status refresh / send / confirm fall back to unqualified
      }
    }
  }

  const agent: SpawnedAgent = {
    id,
    parentId: req.parentId ?? null,
    label: req.task.slice(0, 48),
    cwd,
    contextMode: req.contextMode,
    surface,
    workspace,
    runtime,
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
  workspace?: string;
}

function cwdToSlug(cwd: string): string {
  return "--" + cwd.replace(/\//g, "-").replace(/^-/, "") + "--";
}

/**
 * Find the pi session file for a runtime-"pi" agent: the newest .jsonl under
 * ~/.pi/agent/sessions/<slug(cwd)>/ modified at or after roughly when it
 * started. Takes cwd/spawnedAt directly (not an agentId/store lookup) so it
 * works for ANY pi agent — one pi-remote itself spawned, or an ambient one
 * already running via cmux/`/cmux-agents` — since the caller already has both
 * values on every agent it can see (bridge-tracked or foreign). A prior
 * store-lookup-only version silently failed for every foreign agent (the
 * majority of what's usually in the picker), which is exactly the bug this
 * fixes: tapping a foreign agent did nothing, with no visible error at all.
 * Returns null if pi hasn't written a session yet (spawn is async — the
 * caller should retry) or there's genuinely nothing under that cwd.
 */
export function resolveAgentSessionPath(cwd: string, spawnedAt: number): string | null {
  const dir = join(homedir(), ".pi", "agent", "sessions", cwdToSlug(cwd));
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
    if (mtime < spawnedAt - 5000) continue; // must be from around/after start
    if (!best || mtime > best.mtime) best = { path: p, mtime };
  }
  return best?.path ?? null;
}

function shortCwd(cwd?: string): string {
  if (!cwd) return "";
  return cwd.split("/").filter(Boolean).slice(-2).join("/") || cwd;
}

export interface CmuxTitles {
  /** `${workspaceRef}/${surfaceRef}` -> cmux's own live surface title. */
  bySurfaceKey: Map<string, string>;
  /** workspaceRef -> cmux's human workspace name (e.g. "🦷 opportunity-architecture"). */
  byWorkspaceRef: Map<string, string>;
}

/**
 * Find which workspace a surface currently lives in, directly from cmux's own
 * tree — NOT from cmux-agent's registry, which sometimes reports the workspace
 * as the alias "default" for a workspace cmux itself only ever calls
 * "workspace:N" (confirmed live: cmux-agent's registry said "default" for a pane
 * cmux's own tree calls "workspace:1" — a real, silent format mismatch that
 * breaks any lookup keyed by workspace ref, e.g. the title overlay below).
 * Safe to call right after spawn, when a duplicate surface number appearing in
 * another workspace in that same instant is not a realistic race.
 */
export function findTreeWorkspace(tree: unknown, surface: string): string | null {
  const windows = (tree as { windows?: unknown })?.windows;
  for (const win of Array.isArray(windows) ? windows : []) {
    const workspaces = (win as { workspaces?: unknown })?.workspaces;
    for (const ws of Array.isArray(workspaces) ? workspaces : []) {
      const workspaceRef = (ws as { ref?: unknown })?.ref;
      if (typeof workspaceRef !== "string") continue;
      const panes = (ws as { panes?: unknown })?.panes;
      for (const pane of Array.isArray(panes) ? panes : []) {
        const surfaces = (pane as { surfaces?: unknown })?.surfaces;
        for (const s of Array.isArray(surfaces) ? surfaces : []) {
          if ((s as { ref?: unknown })?.ref === surface) return workspaceRef;
        }
      }
    }
  }
  return null;
}

/**
 * Naming source of truth: cmux already tracks a title per surface (from the real
 * terminal pane) and a human name per workspace — the same names Nik sees in cmux
 * itself. Reading them here means pi-remote's picker shows the SAME name as cmux,
 * instead of a second, independently-invented label that drifts out of sync.
 * Pure — takes the already-parsed `cmux --json tree --all` object.
 */
export function extractCmuxTitles(tree: unknown): CmuxTitles {
  const bySurfaceKey = new Map<string, string>();
  const byWorkspaceRef = new Map<string, string>();
  const windows = (tree as { windows?: unknown })?.windows;
  for (const win of Array.isArray(windows) ? windows : []) {
    const workspaces = (win as { workspaces?: unknown })?.workspaces;
    for (const ws of Array.isArray(workspaces) ? workspaces : []) {
      const workspaceRef = (ws as { ref?: unknown })?.ref;
      if (typeof workspaceRef !== "string") continue;
      const workspaceTitle = (ws as { title?: unknown })?.title;
      if (typeof workspaceTitle === "string") byWorkspaceRef.set(workspaceRef, workspaceTitle);

      const panes = (ws as { panes?: unknown })?.panes;
      for (const pane of Array.isArray(panes) ? panes : []) {
        const surfaces = (pane as { surfaces?: unknown })?.surfaces;
        for (const surface of Array.isArray(surfaces) ? surfaces : []) {
          const surfaceRef = (surface as { ref?: unknown })?.ref;
          const surfaceTitle = (surface as { title?: unknown })?.title;
          if (typeof surfaceRef !== "string" || typeof surfaceTitle !== "string") continue;
          bySurfaceKey.set(`${workspaceRef}/${surfaceRef}`, surfaceTitle);
        }
      }
    }
  }
  return { bySurfaceKey, byWorkspaceRef };
}

/** I/O — the single `cmux --json tree --all` fetch shared by title-extraction AND
 * ambient-agent discovery (one call per listAgents() poll, not two). */
function fetchTree(): unknown {
  try {
    const raw = execFileSync(CMUX_BIN, ["--json", "tree", "--all"], { encoding: "utf8", timeout: 5000 });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ambient agent discovery: surface ANY agent terminal session running in cmux,
// regardless of whether it was spawned via cmux-agent or hooked into its
// registry (confirmed live: 46 real terminal panes existed, the registry only
// actively tracked 5 — everything else, e.g. a codex/hermes/claude session
// someone just typed into a pane, was invisible). Detection is independent of
// cmux-agent entirely: walk cmux's own tree for every terminal surface's tty,
// then ask the OS what's actually running there via `ps`.
// ---------------------------------------------------------------------------

export interface TerminalSurface {
  workspaceRef: string;
  surfaceRef: string;
  tty: string | null;
}

/** Every terminal-type surface in the tree, with its tty for process lookup. */
export function enumerateTerminalSurfaces(tree: unknown): TerminalSurface[] {
  const out: TerminalSurface[] = [];
  const windows = (tree as { windows?: unknown })?.windows;
  for (const win of Array.isArray(windows) ? windows : []) {
    const workspaces = (win as { workspaces?: unknown })?.workspaces;
    for (const ws of Array.isArray(workspaces) ? workspaces : []) {
      const workspaceRef = (ws as { ref?: unknown })?.ref;
      if (typeof workspaceRef !== "string") continue;
      const panes = (ws as { panes?: unknown })?.panes;
      for (const pane of Array.isArray(panes) ? panes : []) {
        const surfaces = (pane as { surfaces?: unknown })?.surfaces;
        for (const surface of Array.isArray(surfaces) ? surfaces : []) {
          const s = surface as { ref?: unknown; type?: unknown; tty?: unknown };
          if (typeof s?.ref !== "string" || s.type !== "terminal") continue;
          out.push({ workspaceRef, surfaceRef: s.ref, tty: typeof s.tty === "string" ? s.tty : null });
        }
      }
    }
  }
  return out;
}

/**
 * Known agent CLI binaries, matched against a process's full argv (not just
 * `comm`) because: (a) hermes is a Python shebang script — `comm` shows
 * "Python"/"python3", never "hermes" — the actual script path only appears in
 * argv; (b) claude is aliased to claude-yolo, more reliably caught in argv too.
 * IMPORTANT: only match the DEEPEST (highest-pid) process for a given tty (see
 * parseTtyRuntimes) — matching the whole process chain gives false positives,
 * since cmux's own pi/codex/etc launch wrapper sets a `CMUX_CUSTOM_CLAUDE_PATH`
 * env var containing the literal string "claude-yolo" in EVERY session's shell
 * command line, including ones actually running pi (confirmed live).
 */
const RUNTIME_PATTERNS: Array<{ runtime: string; pattern: RegExp }> = [
  { runtime: "codex", pattern: /\bcodex\b/ },
  { runtime: "claude", pattern: /\bclaude(-yolo)?\b/ },
  { runtime: "hermes", pattern: /\bhermes(_cli)?\b/ },
  { runtime: "cursor-agent", pattern: /\bcursor-agent\b/ },
  { runtime: "antigravity", pattern: /\bagy\b/ },
  { runtime: "pi", pattern: /(^|\/)pi(\s|$)/ }, // checked last: "pi" is a short, common token
];

export function matchRuntimeFromArgs(args: string): string | null {
  for (const { runtime, pattern } of RUNTIME_PATTERNS) {
    if (pattern.test(args)) return runtime;
  }
  return null;
}

export interface TtyRuntime {
  runtime: string;
  pid: number;
}

/**
 * Parse `ps -eo pid,tty,args` output into tty -> {runtime, pid}, one entry per
 * tty that has a currently-running agent. Only the DEEPEST process per tty
 * (highest pid — the most recently started, i.e. the actual foreground
 * command, not the login/shell wrapper chain in front of it) is matched; see
 * RUNTIME_PATTERNS' doc comment for why matching the whole chain is wrong.
 * ttys whose deepest process doesn't match anything are omitted (idle shell,
 * or running something that isn't a known agent CLI).
 */
export function parseTtyRuntimes(psOutput: string): Map<string, TtyRuntime> {
  const byTty = new Map<string, Array<{ pid: number; args: string }>>();
  const lines = psOutput.split("\n").slice(1); // drop the header row
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    const [, pidStr, tty, args] = m;
    if (!tty.startsWith("ttys")) continue; // "??" = no controlling terminal, not a cmux pane
    const list = byTty.get(tty) ?? [];
    list.push({ pid: Number(pidStr), args });
    byTty.set(tty, list);
  }

  const result = new Map<string, TtyRuntime>();
  for (const [tty, procs] of byTty) {
    const deepest = procs.reduce((a, b) => (b.pid > a.pid ? b : a));
    const runtime = matchRuntimeFromArgs(deepest.args);
    if (runtime) result.set(tty, { runtime, pid: deepest.pid });
  }
  return result;
}

/** I/O — best-effort, returns null on any failure (permissions, ps unavailable). */
function fetchPsOutput(): string | null {
  try {
    return execFileSync("ps", ["-eo", "pid,tty,args"], { encoding: "utf8", timeout: 5000, maxBuffer: 8 * 1024 * 1024 });
  } catch {
    return null;
  }
}

/** cwd is only needed to support attach for ambient "pi" agents (steer works
 * for any runtime without it). One extra shell-out, only for pi matches. */
function resolveCwdForPid(pid: number): string | null {
  try {
    const raw = execFileSync("lsof", ["-a", "-d", "cwd", "-p", String(pid)], { encoding: "utf8", timeout: 3000 });
    const line = raw.trim().split("\n").at(-1);
    const cwd = line?.trim().split(/\s+/).at(-1);
    return cwd && cwd.startsWith("/") ? cwd : null;
  } catch {
    return null;
  }
}

// Bridge.ts is a single-process event loop; execFileSync blocks it entirely
// while it runs. Measured live: cmux tree + system-wide ps together cost
// ~350-400ms. The frontend polls listAgents() every 5s while the Agents panel
// is open, which would mean a ~400ms full-bridge stall (including the ACTIVE
// pi chat's streaming) every 5 seconds — a real, measured risk, not
// speculative. Cache the expensive, knownKeys-independent data (tree + ps) for
// a bounded window so it actually runs at most once per window regardless of
// poll frequency; the fast, pure per-call filtering (buildAmbientAgents) still
// runs fresh every time so newly-known agents are excluded promptly.
const AMBIENT_CACHE_TTL_MS = 10_000;
let ambientCache: { surfaces: TerminalSurface[]; ttyRuntimes: Map<string, TtyRuntime>; titles: CmuxTitles; at: number } | null = null;

function getAmbientDiscoveryData(): { surfaces: TerminalSurface[]; ttyRuntimes: Map<string, TtyRuntime>; titles: CmuxTitles } {
  if (ambientCache && Date.now() - ambientCache.at < AMBIENT_CACHE_TTL_MS) return ambientCache;
  const tree = fetchTree();
  const titles = extractCmuxTitles(tree);
  const surfaces = enumerateTerminalSurfaces(tree);
  const psOutput = fetchPsOutput();
  const ttyRuntimes = psOutput ? parseTtyRuntimes(psOutput) : new Map<string, TtyRuntime>();
  ambientCache = { surfaces, ttyRuntimes, titles, at: Date.now() };
  return ambientCache;
}

/**
 * Build ambient agent entries for every terminal surface running a known agent
 * CLI that ISN'T already known from the registry/store (knownKeys). cwdResolver
 * is injected for testability; the real bridge path passes resolveCwdForPid.
 */
export function buildAmbientAgents(
  surfaces: TerminalSurface[],
  ttyRuntimes: Map<string, TtyRuntime>,
  knownKeys: Set<string>,
  titles: CmuxTitles,
  cwdResolver: (pid: number) => string | null
): SpawnedAgent[] {
  const out: SpawnedAgent[] = [];
  for (const s of surfaces) {
    const key = `${s.workspaceRef}/${s.surfaceRef}`;
    if (knownKeys.has(key) || !s.tty) continue;
    const match = ttyRuntimes.get(s.tty);
    if (!match) continue; // idle shell or an unrecognized process — not an agent
    const title = titles.bySurfaceKey.get(key);
    const cwd = match.runtime === "pi" ? (cwdResolver(match.pid) ?? "") : "";
    out.push({
      id: key,
      parentId: null,
      label: title ?? `${match.runtime} · ${s.surfaceRef}`,
      cwd,
      contextMode: "task",
      surface: s.surfaceRef,
      workspace: s.workspaceRef,
      workspaceLabel: titles.byWorkspaceRef.get(s.workspaceRef),
      runtime: match.runtime,
      status: "active",
      spawnedAt: 0, // unknown start time — resolveAgentSessionPath's window check is skipped when 0 (see there)
    });
  }
  return out;
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

  // Registry keys ARE "workspace/surface" already — use them directly as the
  // composite identity. A bare surface number collides across workspaces (see
  // findRegistryWorkspace), so never key anything by surface alone.
  const knownKeys = new Set<string>();
  for (const a of Object.values(store)) {
    if (!a.surface) continue;
    knownKeys.add(a.workspace ? `${a.workspace}/${a.surface}` : a.surface);
  }

  // Refresh status for agents we spawned ourselves. Try the exact
  // workspace/surface key first; cmux-agent's registry can re-key the SAME
  // surface under "default" later even after we resolved its canonical
  // workspace:N ref at spawn time (confirmed live — a stale-status symptom,
  // not just a spawn-time concern) — fall back to a bare-surface scan so a
  // real status change is never silently missed just because of that alias.
  for (const a of Object.values(store)) {
    if (!a.surface) continue;
    const live = (a.workspace && registry[`${a.workspace}/${a.surface}`]) ||
      Object.values(registry).find((e) => e.surface_ref === a.surface);
    if (live) a.status = mapStatus(live.status);
  }
  save(store);

  // Surface every OTHER live/awaiting cmux agent we didn't spawn, across all
  // runtimes. Skip already-closed history so the picker isn't a graveyard.
  const foreign: SpawnedAgent[] = [];
  for (const [key, entry] of Object.entries(registry)) {
    const surface = entry.surface_ref;
    if (!surface || knownKeys.has(key)) continue;
    const status = mapStatus(entry.status);
    if (status === "closed") continue;
    const workspace = entry.workspace ?? key.slice(0, key.length - surface.length - 1);
    knownKeys.add(key); // so the ambient pass below doesn't duplicate this one
    foreign.push({
      id: key,
      parentId: null,
      label: `${entry.runtime ?? "agent"} · ${shortCwd(entry.cwd)}`,
      cwd: entry.cwd ?? "",
      contextMode: "task",
      surface,
      workspace,
      runtime: entry.runtime ?? "agent",
      status,
      spawnedAt: entry.registered_at ? Math.round(entry.registered_at * 1000) : 0,
    });
  }

  // Ambient agents: any terminal pane running a known agent CLI that neither
  // pi-remote spawned NOR cmux-agent's registry knows about (no spawn/hook
  // required — see buildAmbientAgents' doc comment). Tree+ps are cached (see
  // getAmbientDiscoveryData) — this call is cheap on a cache hit.
  const { surfaces, ttyRuntimes, titles } = getAmbientDiscoveryData();
  const ambient = buildAmbientAgents(surfaces, ttyRuntimes, knownKeys, titles, resolveCwdForPid);

  const merged = [...Object.values(store), ...foreign, ...ambient].sort((x, y) => y.spawnedAt - x.spawnedAt);
  return applyCmuxTitles(merged, titles);
}

/**
 * Overlay cmux's own live titles for display. Never mutates the input or the
 * persisted store — this is display-only, computed fresh on every call, so a
 * cmux hiccup or a temporarily-generic title never permanently clobbers anything
 * saved to disk. Falls back to the existing label when cmux has no title for
 * that surface yet (just spawned) or the tree call failed (empty maps).
 */
export function applyCmuxTitles(agents: SpawnedAgent[], titles: CmuxTitles): SpawnedAgent[] {
  return agents.map((a) => {
    if (!a.surface || !a.workspace) return a;
    const liveTitle = titles.bySurfaceKey.get(`${a.workspace}/${a.surface}`);
    const workspaceLabel = titles.byWorkspaceRef.get(a.workspace);
    if (!liveTitle && !workspaceLabel) return a;
    return { ...a, label: liveTitle ?? a.label, workspaceLabel };
  });
}

function mapStatus(s?: string): AgentStatus {
  if (s === "done-awaiting-confirm") return "awaiting-confirm";
  if (s === "closed") return "closed";
  if (s === "done") return "done";
  return "active";
}

/** workspace should always be passed when known — a bare surface can collide
 * with an identically-numbered surface in another workspace (see
 * findRegistryWorkspace). Falls back to cmux-agent's own "default" guess only
 * when the caller genuinely doesn't have it (legacy/foreign entries). */
export function sendToAgent(surface: string, msg: string, workspace?: string | null): void {
  const args = ["send", "--to", surface, "--msg", msg];
  if (workspace) args.push("--workspace", workspace);
  execFileSync(CMUX_AGENT, args, { encoding: "utf8", timeout: 8000 });
}

export function confirmAgent(surface: string, workspace?: string | null): void {
  const args = ["confirm", "--pane", surface];
  if (workspace) args.push("--workspace", workspace);
  execFileSync(CMUX_AGENT, args, { encoding: "utf8", timeout: 8000 });
  const agents = load();
  if (agents[surface]) {
    agents[surface].status = "closed";
    save(agents);
  }
}
