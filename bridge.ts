/**
 * pi-remote bridge server — v2 (RPC mode)
 *
 * Spawns `pi --mode rpc` as a child process and multiplexes its JSONL
 * stdin/stdout stream across multiple WebSocket clients.
 *
 * On new connection: fetches get_state + get_messages + get_commands from pi
 * and sends the responses to the connecting client so it can bootstrap.
 *
 * All pi events (no `id` field) are broadcast to every connected client.
 * Responses (`type: "response"`) are routed to the client that originated
 * the request, or broadcast for bridge-initiated requests.
 *
 * Extension UI: extension_ui_request events are broadcast; first client to
 * send extension_ui_response wins and it is forwarded to pi stdin.
 */

import { readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from "fs";
import { randomUUID } from "crypto";
import webpush from "web-push";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { StringDecoder } from "string_decoder";
import { createInterface } from "readline";
import { execSync } from "child_process";
import { isJunkWorkspace } from "./workspace-filter";
import { spawnAgent, listAgents, sendToAgent, confirmAgent, resolveAgentSessionPath, type ContextMode } from "./agents";
import { buildAgentTree, flattenTree } from "./lineage";
import { resolveRoute } from "./broker-route";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 7700);
const CWD = process.env.AGENT_CWD ?? process.cwd();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, "public");
const SESSIONS_ROOT = join(homedir(), ".pi", "agent", "sessions");

/** Active session file path reported by pi get_state (for rename routing). */
let loadedSessionFile: string | null = null;

// ---------------------------------------------------------------------------
// Prefs (persisted across restarts)
// ---------------------------------------------------------------------------

interface ModelRef {
  id: string;
  name: string;
  provider: string;
}

interface Prefs {
  lastModel?: { provider: string; modelId: string };
  recentModels?: ModelRef[];
  lastThinkingLevel?: string;
}

interface PushPrefs {
  vapidKeys?: { publicKey: string; privateKey: string };
  subscriptions?: any[];
}

const PREFS_PATH = join(__dirname, "prefs.json");
const PUSH_PREFS_PATH = join(__dirname, "push-prefs.json");

function loadPrefs(): Prefs {
  try { return JSON.parse(readFileSync(PREFS_PATH, "utf8")); }
  catch { return {}; }
}

function savePrefs(prefs: Prefs): void {
  try { writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2)); }
  catch (e) { console.error("[bridge] failed to save prefs:", e); }
}

const prefs = loadPrefs();

function loadPushPrefs(): PushPrefs {
  try { return JSON.parse(readFileSync(PUSH_PREFS_PATH, "utf8")); }
  catch { return {}; }
}

function savePushPrefs(data: PushPrefs): void {
  try { writeFileSync(PUSH_PREFS_PATH, JSON.stringify(data, null, 2)); }
  catch (e) { console.error("[bridge] failed to save push prefs:", e); }
}

const pushPrefs = loadPushPrefs();
if (!pushPrefs.vapidKeys) {
  pushPrefs.vapidKeys = webpush.generateVAPIDKeys();
  savePushPrefs(pushPrefs);
}
if (!Array.isArray(pushPrefs.subscriptions)) {
  pushPrefs.subscriptions = [];
  savePushPrefs(pushPrefs);
}

webpush.setVapidDetails(
  process.env.WEB_PUSH_CONTACT ?? "mailto:pi-remote@localhost",
  pushPrefs.vapidKeys.publicKey,
  pushPrefs.vapidKeys.privateKey,
);

function entrySubscription(entry: any): any {
  return entry?.subscription ?? entry;
}

function sameSubscription(a: any, b: any): boolean {
  return !!a?.endpoint && !!b?.endpoint && a.endpoint === b.endpoint;
}

function addPushSubscription(sub: any, clientId?: string): void {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return;
  const list = pushPrefs.subscriptions ?? [];

  const next = list.filter((entry) => {
    const existingSub = entrySubscription(entry);
    if (sameSubscription(existingSub, sub)) return false;
    if (clientId && entry?.clientId && entry.clientId === clientId) return false;
    return true;
  });

  next.push({ clientId: clientId || null, subscription: sub, updatedAt: Date.now() });
  pushPrefs.subscriptions = next;
  savePushPrefs(pushPrefs);
}

function removePushSubscription(sub: any, clientId?: string): void {
  const list = pushPrefs.subscriptions ?? [];
  const next = list.filter((entry) => {
    const existingSub = entrySubscription(entry);
    if (sub && sameSubscription(existingSub, sub)) return false;
    if (clientId && entry?.clientId === clientId) return false;
    return true;
  });
  if (next.length !== list.length) {
    pushPrefs.subscriptions = next;
    savePushPrefs(pushPrefs);
  }
}

async function notifyPushSubscribers(title: string, body: string): Promise<{ sent: number; failed: number; results: any[] }> {
  const list = [...(pushPrefs.subscriptions ?? [])];
  if (list.length === 0) return { sent: 0, failed: 0, results: [] };

  const payload = JSON.stringify({ title, body, tag: "pi-remote-agent-finished" });
  let sent = 0;
  let failed = 0;
  const results: any[] = [];

  await Promise.all(list.map(async (entry, idx) => {
    const sub = entrySubscription(entry);
    const clientId = entry?.clientId ?? undefined;
    const endpoint = String(sub?.endpoint ?? "");

    if (clientId && isClientActive(clientId)) {
      results.push({ idx, ok: true, skipped: true, reason: "client-active" });
      return;
    }
    let host = "unknown";
    try { host = new URL(endpoint).host; } catch {}

    try {
      const resp = await webpush.sendNotification(sub, payload);
      sent += 1;
      const statusCode = Number((resp as any)?.statusCode ?? 0);
      results.push({ idx, ok: true, host, statusCode });
      console.log(`[bridge] web-push sent ok idx=${idx} host=${host} status=${statusCode || "?"}`);
    } catch (err: any) {
      failed += 1;
      const statusCode = Number(err?.statusCode ?? 0);
      const bodyText = String(err?.body ?? err?.message ?? err);

      // Remove subscriptions that are definitely stale/invalid for future sends.
      const shouldRemove =
        statusCode === 404 ||
        statusCode === 410 ||
        (statusCode === 400 && bodyText.includes("VapidPkHashMismatch")) ||
        (statusCode === 403 && bodyText.includes("BadJwtToken"));

      if (shouldRemove) removePushSubscription(sub, entry?.clientId);

      results.push({ idx, ok: false, host, statusCode, error: bodyText });
      console.error(`[bridge] web-push send failed idx=${idx} host=${host} status=${statusCode || "?"} error=${bodyText}`);
    }
  }));

  return { sent, failed, results };
}

console.log(`[bridge] Web Push ready (subscriptions=${pushPrefs.subscriptions.length})`);

// ---------------------------------------------------------------------------
// Spawn pi --mode rpc
// ---------------------------------------------------------------------------

console.log(`[bridge] Spawning pi --mode rpc, cwd=${CWD}`);

// Shared spawn env so attachable RPC agents (see below) launch identically to the
// primary pi — the NODE_PATH fix lets pi resolve @earendil-works/pi-tui etc.
const PI_SPAWN_ENV = {
  ...process.env,
  NODE_PATH: [
    process.env.NODE_PATH,
    "/opt/homebrew/lib/node_modules",
    "/Users/nicholasgarza/.nvm/versions/node/v22.21.1/lib/node_modules",
  ]
    .filter(Boolean)
    .join(":"),
};

const pi = Bun.spawn(["pi", "--mode", "rpc"], {
  cwd: CWD,
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
  env: PI_SPAWN_ENV,
});

pi.exited.then((code) => {
  console.log(`[bridge] pi process exited with code ${code}`);
  // Don't kill the bridge — keep serving static files and accept new WS connections.
  // pi will be re-spawned on demand if needed.
});

// ---------------------------------------------------------------------------
// WebSocket client registry
// ---------------------------------------------------------------------------

const clients = new Set<any>();
const activeClientConnectionCounts = new Map<string, number>();

function markClientConnected(clientId?: string): void {
  if (!clientId) return;
  activeClientConnectionCounts.set(clientId, (activeClientConnectionCounts.get(clientId) ?? 0) + 1);
}

function markClientDisconnected(clientId?: string): void {
  if (!clientId) return;
  const next = (activeClientConnectionCounts.get(clientId) ?? 0) - 1;
  if (next <= 0) activeClientConnectionCounts.delete(clientId);
  else activeClientConnectionCounts.set(clientId, next);
}

function isClientActive(clientId?: string): boolean {
  if (!clientId) return false;
  return (activeClientConnectionCounts.get(clientId) ?? 0) > 0;
}

// Pending response routes: requestId -> ws  (null = broadcast to all)
const pendingResponseRoutes = new Map<string, any | null>();

// Track which extension_ui_request ids have already been answered
const answeredDialogIds = new Set<string>();

let bridgeReqCounter = 0;
function nextBridgeId(): string {
  return `bridge-${++bridgeReqCounter}`;
}

function addRecentModel(model: ModelRef): void {
  const recent = (prefs.recentModels ?? []).filter(
    m => !(m.id === model.id && m.provider === model.provider)
  );
  recent.unshift(model);
  prefs.recentModels = recent.slice(0, 5);
  savePrefs(prefs);
}

function prefsMessage(): string {
  return JSON.stringify({ type: "prefs", recentModels: prefs.recentModels ?? [] });
}

// Restore the saved model on the first client connection (pi is guaranteed
// ready by then). Subsequent connects skip this.
let hasRestoredModel = false;

// ---------------------------------------------------------------------------
// Communicate with pi
// ---------------------------------------------------------------------------

function sendToPi(cmd: object): void {
  const line = JSON.stringify(cmd) + "\n";
  pi.stdin.write(line);
  // No flush needed — Bun flushes automatically for pipe streams on each write
}

// ---------------------------------------------------------------------------
// Attachable RPC agents (Phase 3.2, ADDITIVE)
// Each is a separate `pi --mode rpc --session <path>` child, one per spawned
// agent the mobile client wants a rich chat for. Events are tagged with agentId
// and sent ONLY to the attaching client (no broadcast) so agent streams never
// cross-talk with the primary chat or with each other.
// ---------------------------------------------------------------------------

interface RpcAgent {
  proc: ReturnType<typeof Bun.spawn>;
  ws: any;
  sessionPath: string;
}
const rpcAgents = new Map<string, RpcAgent>(); // agentId -> agent

function liveAgentIds(): Set<string> {
  return new Set(rpcAgents.keys());
}

function attachRpcAgent(agentId: string, sessionPath: string, ws: any): void {
  const existing = rpcAgents.get(agentId);
  if (existing) {
    existing.ws = ws; // re-point to the (re)attaching client
    return;
  }
  const proc = Bun.spawn(["pi", "--mode", "rpc", "--session", sessionPath], {
    cwd: CWD,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: PI_SPAWN_ENV,
  });
  rpcAgents.set(agentId, { proc, ws, sessionPath });

  attachJsonlReader(proc.stdout as ReadableStream<Uint8Array>, (line) => {
    let evt: unknown;
    try {
      evt = JSON.parse(line);
    } catch {
      return;
    }
    const target = rpcAgents.get(agentId);
    if (target) sendToWs(target.ws, JSON.stringify({ type: "agent_event", agentId, event: evt }));
  });

  proc.exited.then(() => {
    rpcAgents.delete(agentId);
  });

  // Bootstrap the attached agent's state for the client.
  sendToRpcAgent(agentId, { type: "get_state", id: `${agentId}:state` });
  sendToRpcAgent(agentId, { type: "get_messages", id: `${agentId}:messages` });
}

function sendToRpcAgent(agentId: string, cmd: object): boolean {
  const agent = rpcAgents.get(agentId);
  if (!agent) return false;
  agent.proc.stdin.write(JSON.stringify(cmd) + "\n");
  return true;
}

function detachRpcAgent(agentId: string): void {
  const agent = rpcAgents.get(agentId);
  if (!agent) return;
  try {
    agent.proc.kill();
  } catch {
    // already gone
  }
  rpcAgents.delete(agentId);
}

/** Tear down any RPC agents attached to a disconnecting client. */
function detachAgentsForClient(ws: any): void {
  for (const [agentId, agent] of rpcAgents) {
    if (agent.ws === ws) detachRpcAgent(agentId);
  }
}

// ---------------------------------------------------------------------------
// JSONL reader on pi stdout (split on \n only — see RPC docs)
// ---------------------------------------------------------------------------

function attachJsonlReader(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): void {
  const decoder = new StringDecoder("utf8");
  let buffer = "";

  const reader = stream.getReader();

  async function pump() {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.end();
        if (buffer.length > 0) {
          const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
          if (line) onLine(line);
        }
        break;
      }
      buffer += decoder.write(value);
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.trim()) onLine(line);
      }
    }
  }

  pump().catch((err) => console.error("[bridge] pi stdout read error:", err));
}

// ---------------------------------------------------------------------------
// Fan-out / route pi output to WebSocket clients
// ---------------------------------------------------------------------------

function broadcast(msg: string): void {
  for (const ws of clients) {
    try {
      ws.send(msg);
    } catch {
      // disconnected; cleaned up in close handler
    }
  }
}

function sendToWs(ws: any, msg: string): void {
  try {
    ws.send(msg);
  } catch {
    // ignore
  }
}

// Forward pi stderr lines to clients as UI-visible bridge_error events
attachJsonlReader(pi.stderr as ReadableStream<Uint8Array>, (line) => {
  // pi spews tons of non-error noise to stderr (npm output, skill loading,
  // deprecation warnings, install messages). Only surface REAL errors to the chat.
  const isError = /^Error:|\bFATAL\b|\buncaughtException\b|\bunhandledRejection\b/i.test(line);
  console.error(`[pi:stderr] ${line}`);
  if (!isError) return;
  const msg = JSON.stringify({
    type: "bridge_error",
    source: "pi-stderr",
    message: line,
  });
  broadcast(msg);
});

attachJsonlReader(pi.stdout as ReadableStream<Uint8Array>, (line) => {
  let parsed: any;
  try {
    parsed = JSON.parse(line);
  } catch {
    console.error("[bridge] failed to parse pi output:", line);
    return;
  }

  // Log to terminal for visibility
  if (parsed.type === "message_update") {
    const e = parsed.assistantMessageEvent;
    if (e?.type === "text_delta") process.stdout.write(e.delta);
    else if (e?.type === "thinking_delta") process.stdout.write(`[think] ${e.delta}`);
  } else if (
    parsed.type === "tool_execution_start" ||
    parsed.type === "agent_start" ||
    parsed.type === "agent_end"
  ) {
    console.log(`[pi] ${JSON.stringify(parsed)}`);
  }

  if (parsed.type === "agent_end") {
    notifyPushSubscribers("pi", "LLM finished working.").catch((e) => {
      console.error("[bridge] failed to send push notifications:", e);
    });
  }

  // Route: responses with id → specific client or broadcast; events → broadcast
  if (parsed.type === "response" && parsed.id != null) {
    // Make command failures very visible in UI
    if (parsed.success === false && parsed.error) {
      broadcast(JSON.stringify({
        type: "bridge_error",
        source: "rpc-response",
        command: parsed.command,
        message: parsed.error,
      }));
    }

    // When a set_model succeeds, update recents and push updated prefs to all clients
    if (parsed.command === "set_model" && parsed.success && parsed.data) {
      const m = parsed.data;
      addRecentModel({ id: m.id, name: m.name ?? m.id, provider: m.provider });
      broadcast(prefsMessage());
    }

    if (parsed.command === "get_state" && parsed.success && parsed.data?.sessionFile) {
      loadedSessionFile = String(parsed.data.sessionFile);
    }

    if (
      (parsed.command === "switch_session" || parsed.command === "new_session") &&
      parsed.success &&
      parsed.data?.sessionFile
    ) {
      loadedSessionFile = String(parsed.data.sessionFile);
    }

    // Broadcast new_session and switch_session to all clients so they all refresh
    const shouldBroadcast = parsed.command === "new_session" || parsed.command === "switch_session";
    
    const target = pendingResponseRoutes.get(parsed.id);
    if (target !== undefined) {
      pendingResponseRoutes.delete(parsed.id);
      if (target === null || shouldBroadcast) {
        broadcast(line);
      } else {
        sendToWs(target, line);
      }
      return;
    }
  }

  // Default: broadcast to all clients
  broadcast(line);
});

// ---------------------------------------------------------------------------
// WebSocket message handler (client → pi)
// ---------------------------------------------------------------------------

function firstUserMessage(filePath: string): string {
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line);
      if (entry.type === "message" && entry.message?.role === "user") {
        const parts = entry.message.content;
        const text = Array.isArray(parts)
          ? parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
          : String(parts ?? "");
        const trimmed = text.trim().replace(/\s+/g, " ");
        return trimmed.length > 80 ? trimmed.slice(0, 77) + "…" : trimmed;
      }
    }
  } catch {}
  return "";
}

/** Latest session_info name from jsonl, else first user preview, else filename stem. */
function sessionDisplayName(filePath: string, filename: string): string {
  let sessionName: string | undefined;
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line);
      if (entry.type === "session_info" && typeof entry.name === "string") {
        const trimmed = entry.name.trim();
        if (trimmed) sessionName = trimmed;
      }
    }
  } catch {}
  if (sessionName) return sessionName;
  const preview = firstUserMessage(filePath);
  if (preview) return preview;
  return filename.replace(/\.jsonl$/, "");
}

function isValidSessionPath(filePath: string): boolean {
  if (!filePath.endsWith(".jsonl")) return false;
  const resolved = join(filePath);
  return resolved.startsWith(SESSIONS_ROOT + "/") || resolved.startsWith(SESSIONS_ROOT + "\\");
}

function getLeafIdFromSessionFile(filePath: string): string | null {
  let leafId: string | null = null;
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line);
      if (typeof entry.id === "string") leafId = entry.id;
    }
  } catch {}
  return leafId;
}

function appendSessionNameToFile(filePath: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || !isValidSessionPath(filePath)) return false;
  const leafId = getLeafIdFromSessionFile(filePath);
  if (!leafId) return false;
  const entry = {
    type: "session_info",
    id: randomUUID().slice(0, 8),
    parentId: leafId,
    timestamp: new Date().toISOString(),
    name: trimmed,
  };
  appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf8");
  return true;
}

function cwdToSlug(cwd: string): string {
  return "--" + cwd.replace(/\//g, "-").replace(/^-/, "") + "--";
}

function slugToWorkspaceLabel(slug: string): string {
  const parts = slug.replace(/^--/, "").replace(/--$/, "").split("-").filter(Boolean);
  if (parts.length === 0) return slug;
  if (parts.length >= 2) return parts.slice(-2).join("/");
  return parts[parts.length - 1] ?? slug;
}

function listSessionFiles(): Array<{
  path: string;
  name: string;
  mtime: number;
  workspaceSlug: string;
  workspaceLabel: string;
  isCurrentWorkspace: boolean;
}> {
  const sessionsRoot = SESSIONS_ROOT;
  const currentSlug = cwdToSlug(CWD);
  const results: Array<{
    path: string;
    name: string;
    mtime: number;
    workspaceSlug: string;
    workspaceLabel: string;
    isCurrentWorkspace: boolean;
  }> = [];

  const homeSlug = cwdToSlug(homedir());
  let workspaceDirs: string[] = [];
  try {
    workspaceDirs = readdirSync(sessionsRoot).filter(
      (name) => name.startsWith("--") && !isJunkWorkspace(name, homeSlug)
    );
  } catch {
    return [];
  }

  for (const workspaceSlug of workspaceDirs) {
    const sessionsDir = join(sessionsRoot, workspaceSlug);
    let files: string[] = [];
    try {
      files = readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    const workspaceLabel = slugToWorkspaceLabel(workspaceSlug);
    for (const f of files) {
      const fullPath = join(sessionsDir, f);
      let mtime = 0;
      try {
        mtime = statSync(fullPath).mtimeMs;
      } catch {}
      const preview = sessionDisplayName(fullPath, f);
      results.push({
        path: fullPath,
        name: preview || f.replace(".jsonl", ""),
        mtime,
        workspaceSlug,
        workspaceLabel,
        isCurrentWorkspace: workspaceSlug === currentSlug,
      });
    }
  }

  return results.sort((a, b) => b.mtime - a.mtime);
}

/** Full-text search across session names + jsonl content. Returns hits with a snippet. */
function searchSessionFiles(query: string, limit = 40) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const files = listSessionFiles(); // already junk-filtered, mtime-sorted
  const hits: Array<Record<string, unknown>> = [];
  for (const f of files) {
    if (hits.length >= limit) break;
    const nameHit = f.name.toLowerCase().includes(q);
    let snippet = "";
    let contentHit = false;
    try {
      if (statSync(f.path).size <= 2_000_000) {
        const text = readFileSync(f.path, "utf8");
        const idx = text.toLowerCase().indexOf(q);
        if (idx >= 0) {
          contentHit = true;
          const start = Math.max(0, idx - 40);
          snippet = text
            .slice(start, idx + q.length + 60)
            .replace(/[^\x20-\x7e]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
      }
    } catch {
      // unreadable session — skip content, keep name match
    }
    if (nameHit || contentHit) hits.push({ ...f, snippet });
  }
  return hits;
}

// File listing for autocomplete (cache with short TTL)
let fileListCache: string[] = [];
let fileListCacheTime = 0;
const FILE_LIST_CACHE_TTL = 5000; // 5 seconds

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".venv",
  "__pycache__",
  ".vscode",
  ".idea",
  ".DS_Store",
  "target",
  "coverage",
  "out",
  ".turbo",
  ".clj-kondo",
]);

const IGNORED_FILES = new Set([
  ".DS_Store",
  ".gitkeep",
  "thumbs.db",
]);

function listFilesRecursive(dir: string, prefix: string = ""): string[] {
  const items: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || IGNORED_FILES.has(entry.name)) continue;

      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        // Include directory itself as an option (with trailing /)
        items.push(fullPath + "/");
        // Recursively add files from inside the directory
        items.push(...listFilesRecursive(join(dir, entry.name), fullPath));
      } else if (!entry.name.startsWith(".")) {
        items.push(fullPath);
      }
    }
  } catch {
    // Ignore permission errors
  }
  return items;
}

function getFileList(forceRefresh = false): string[] {
  const now = Date.now();
  if (!forceRefresh && fileListCache.length > 0 && now - fileListCacheTime < FILE_LIST_CACHE_TTL) {
    return fileListCache;
  }

  const files = listFilesRecursive(CWD).sort();
  fileListCache = files;
  fileListCacheTime = now;
  return files;
}

function getSessionInfo() {
  const folder = CWD.split("/").pop() || CWD;
  let branch = "?";
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: CWD, encoding: "utf-8" }).trim();
  } catch {
    // Not a git repo or git not available
  }
  return { folder, branch };
}

function handleClientMessage(ws: any, raw: string): void {
  let cmd: any;
  try {
    cmd = JSON.parse(raw);
  } catch {
    sendToWs(ws, JSON.stringify({ type: "response", command: "parse", success: false, error: "Invalid JSON" }));
    return;
  }

  // list_sessions: handled bridge-side (filesystem scan)
  if (cmd.type === "list_sessions") {
    const sessions = listSessionFiles();
    sendToWs(ws, JSON.stringify({ type: "response", command: "list_sessions", success: true, id: cmd.id, data: { sessions } }));
    return;
  }

  // rename_session: active → pi set_session_name; inactive → append session_info to jsonl
  if (cmd.type === "rename_session") {
    const sessionPath = String(cmd.sessionPath ?? "");
    const name = String(cmd.name ?? "").trim();
    if (!name) {
      sendToWs(ws, JSON.stringify({ type: "response", command: "rename_session", success: false, id: cmd.id, error: "Name cannot be empty" }));
      return;
    }
    if (!isValidSessionPath(sessionPath)) {
      sendToWs(ws, JSON.stringify({ type: "response", command: "rename_session", success: false, id: cmd.id, error: "Invalid session path" }));
      return;
    }
    if (loadedSessionFile === sessionPath) {
      if (cmd.id != null) pendingResponseRoutes.set(cmd.id, ws);
      sendToPi({ type: "set_session_name", name, id: cmd.id });
      return;
    }
    const ok = appendSessionNameToFile(sessionPath, name);
    sendToWs(ws, JSON.stringify({
      type: "response",
      command: "rename_session",
      success: ok,
      id: cmd.id,
      data: ok ? { sessionPath, name } : undefined,
      error: ok ? undefined : "Could not rename session file",
    }));
    return;
  }

  // list_files: handled bridge-side (file listing for autocomplete)
  if (cmd.type === "list_files") {
    const files = getFileList(cmd.forceRefresh ?? false);
    sendToWs(ws, JSON.stringify({ type: "response", command: "list_files", success: true, id: cmd.id, data: { files } }));
    return;
  }

  if (cmd.type === "search_sessions") {
    const results = searchSessionFiles(String(cmd.query ?? ""));
    sendToWs(ws, JSON.stringify({ type: "response", command: "search_sessions", success: true, id: cmd.id, data: { results } }));
    return;
  }

  // --- Multi-agent (additive; does not touch the primary pi chat path) ---
  if (cmd.type === "list_agents") {
    // Build the nested tree server-side and send a depth-tagged flat list so the
    // frontend renders indentation without duplicating the lineage logic.
    const flat = flattenTree(buildAgentTree(listAgents())).map(({ children, ...n }) => n);
    sendToWs(ws, JSON.stringify({ type: "response", command: "list_agents", success: true, id: cmd.id, data: { agents: flat } }));
    return;
  }

  if (cmd.type === "spawn_agent") {
    const cm = cmd.contextMode;
    const contextMode: ContextMode = cm === "full" || cm === "scoped" ? cm : "task";
    try {
      const agent = spawnAgent({
        cwd: String(cmd.cwd ?? CWD),
        task: String(cmd.task ?? ""),
        contextMode,
        parentId: cmd.parentId ? String(cmd.parentId) : null,
        parentSummary: cmd.parentSummary ? String(cmd.parentSummary) : undefined,
        now: Date.now(),
      });
      sendToWs(ws, JSON.stringify({ type: "response", command: "spawn_agent", success: true, id: cmd.id, data: { agent } }));
    } catch (e) {
      sendToWs(ws, JSON.stringify({ type: "response", command: "spawn_agent", success: false, id: cmd.id, error: String(e) }));
    }
    return;
  }

  if (cmd.type === "send_to_agent" && cmd.surface) {
    try {
      // workspace disambiguates surface numbers that collide across cmux
      // workspaces (see findRegistryWorkspace) — client sends it when known.
      sendToAgent(String(cmd.surface), String(cmd.message ?? ""), cmd.workspace ? String(cmd.workspace) : null);
      sendToWs(ws, JSON.stringify({ type: "response", command: "send_to_agent", success: true, id: cmd.id }));
    } catch (e) {
      sendToWs(ws, JSON.stringify({ type: "response", command: "send_to_agent", success: false, id: cmd.id, error: String(e) }));
    }
    return;
  }

  if (cmd.type === "confirm_agent" && cmd.surface) {
    try {
      confirmAgent(String(cmd.surface), cmd.workspace ? String(cmd.workspace) : null);
      sendToWs(ws, JSON.stringify({ type: "response", command: "confirm_agent", success: true, id: cmd.id }));
    } catch (e) {
      sendToWs(ws, JSON.stringify({ type: "response", command: "confirm_agent", success: false, id: cmd.id, error: String(e) }));
    }
    return;
  }

  // --- Attachable RPC agents (3.2/3.8): N pi --mode rpc processes, session-routed ---
  if (cmd.type === "resolve_agent_session" && cmd.agentId) {
    const sessionPath = resolveAgentSessionPath(String(cmd.agentId));
    sendToWs(ws, JSON.stringify({ type: "response", command: "resolve_agent_session", success: true, id: cmd.id, data: { sessionPath } }));
    return;
  }

  if (cmd.type === "attach_agent" && cmd.agentId && cmd.sessionPath) {
    attachRpcAgent(String(cmd.agentId), String(cmd.sessionPath), ws);
    sendToWs(ws, JSON.stringify({ type: "response", command: "attach_agent", success: true, id: cmd.id, data: { agentId: String(cmd.agentId) } }));
    return;
  }

  if (cmd.type === "agent_command" && cmd.agentId) {
    const route = resolveRoute({ agentId: String(cmd.agentId) }, new Map(), liveAgentIds());
    if (!route.ok) {
      sendToWs(ws, JSON.stringify({ type: "response", command: "agent_command", success: false, id: cmd.id, error: route.reason }));
      return;
    }
    sendToRpcAgent(route.agentId, (cmd.payload as object) ?? {});
    sendToWs(ws, JSON.stringify({ type: "response", command: "agent_command", success: true, id: cmd.id }));
    return;
  }

  if (cmd.type === "detach_agent" && cmd.agentId) {
    detachRpcAgent(String(cmd.agentId));
    sendToWs(ws, JSON.stringify({ type: "response", command: "detach_agent", success: true, id: cmd.id }));
    return;
  }

  if (cmd.type === "get_git_branch") {
    let branch = "";
    try {
      branch = execSync("git branch --show-current", { cwd: CWD, encoding: "utf8", timeout: 2000 }).trim();
    } catch {
      // not a git repo / git unavailable — leave branch empty
    }
    sendToWs(ws, JSON.stringify({ type: "response", command: "get_git_branch", success: true, id: cmd.id, data: { branch } }));
    return;
  }

  // extension_ui_response: only forward the first response for each dialog id
  if (cmd.type === "extension_ui_response") {
    if (answeredDialogIds.has(cmd.id)) return; // already answered
    answeredDialogIds.add(cmd.id);
    sendToPi(cmd);
    return;
  }

  // Track response route so the reply goes back to this client
  if (cmd.id != null) {
    pendingResponseRoutes.set(cmd.id, ws);
  }

  // Persist model choice and update recents
  if (cmd.type === "set_model" && cmd.provider && cmd.modelId) {
    prefs.lastModel = { provider: cmd.provider, modelId: cmd.modelId };
    savePrefs(prefs);
  }

  if (cmd.type === "set_thinking_level" && cmd.level) {
    prefs.lastThinkingLevel = cmd.level;
    savePrefs(prefs);
  }

  sendToPi(cmd);

  // Fan-out user-visible commands to all OTHER clients so their UI stays in sync
  if (cmd.type === "prompt" || cmd.type === "steer" || cmd.type === "follow_up" || cmd.type === "set_model") {
    for (const other of clients) {
      if (other !== ws) sendToWs(other, raw);
    }
  }
}

// ---------------------------------------------------------------------------
// Bootstrap a newly connected client
// ---------------------------------------------------------------------------

function bootstrapClient(ws: any): void {
  // Send get_state, get_messages, get_commands — route responses to this ws only
  const stateId = nextBridgeId();
  const messagesId = nextBridgeId();
  const commandsId = nextBridgeId();

  pendingResponseRoutes.set(stateId, ws);
  pendingResponseRoutes.set(messagesId, ws);
  pendingResponseRoutes.set(commandsId, ws);

  const modelsId = nextBridgeId();
  pendingResponseRoutes.set(modelsId, ws);

  // Send current prefs immediately (no round-trip needed)
  sendToWs(ws, prefsMessage());
  
  // Send session info (folder + branch)
  const sessionInfo = getSessionInfo();
  sendToWs(ws, JSON.stringify({ type: "session_info", folder: sessionInfo.folder, branch: sessionInfo.branch }));

  sendToPi({ type: "get_state", id: stateId });
  sendToPi({ type: "get_messages", id: messagesId });
  sendToPi({ type: "get_commands", id: commandsId });
  sendToPi({ type: "get_available_models", id: modelsId });

  // On first connect, restore the saved model (pi is ready by this point)
  if (!hasRestoredModel && prefs.lastModel) {
    hasRestoredModel = true;
    console.log(`[bridge] Restoring last model: ${prefs.lastModel.modelId}`);
    const restoreId = nextBridgeId();
    pendingResponseRoutes.set(restoreId, null); // broadcast to all
    sendToPi({ type: "set_model", id: restoreId, ...prefs.lastModel });
  }

  // Always restore thinking level (pi resets it on each startup)
  if (prefs.lastThinkingLevel && prefs.lastThinkingLevel !== "none") {
    console.log(`[bridge] Restoring thinking level: ${prefs.lastThinkingLevel}`);
    const thinkId = nextBridgeId();
    pendingResponseRoutes.set(thinkId, null);
    sendToPi({ type: "set_thinking_level", id: thinkId, level: prefs.lastThinkingLevel });
  }
}

// ---------------------------------------------------------------------------
// Static file server
// ---------------------------------------------------------------------------

function serveFile(path: string): Response {
  try {
    const content = readFileSync(path);
    const ext = path.split(".").pop() ?? "";
    const mime: Record<string, string> = {
      html: "text/html; charset=utf-8",
      css: "text/css; charset=utf-8",
      js: "application/javascript; charset=utf-8",
      json: "application/json",
      svg: "image/svg+xml",
      ico: "image/x-icon",
    };
    return new Response(content, {
      headers: { "Content-Type": mime[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

const server = Bun.serve({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url);

    if (req.headers.get("upgrade") === "websocket") {
      const clientId = url.searchParams.get("clientId") ?? undefined;
      const ok = server.upgrade(req, { data: { clientId } });
      if (!ok) return new Response("WebSocket upgrade failed", { status: 400 });
      return undefined as any;
    }

    if (url.pathname === "/api/push/public-key" && req.method === "GET") {
      return Response.json({ publicKey: pushPrefs.vapidKeys?.publicKey ?? "" });
    }

    if (url.pathname === "/api/push/subscribe" && req.method === "POST") {
      return req.json().then((body: any) => {
        addPushSubscription(body?.subscription, body?.clientId);
        return Response.json({ ok: true, count: pushPrefs.subscriptions?.length ?? 0 });
      }).catch(() => new Response("Invalid JSON", { status: 400 }));
    }

    if (url.pathname === "/api/push/unsubscribe" && req.method === "POST") {
      return req.json().then((body: any) => {
        removePushSubscription(body?.subscription, body?.clientId);
        return Response.json({ ok: true, count: pushPrefs.subscriptions?.length ?? 0 });
      }).catch(() => new Response("Invalid JSON", { status: 400 }));
    }

    if (url.pathname === "/api/push/test" && req.method === "POST") {
      return req.json().catch(() => ({})).then(async (body: any) => {
        const title = body?.title ?? "pi";
        const message = body?.body ?? "Test push notification from bridge.";
        const report = await notifyPushSubscribers(title, message);
        return Response.json({ ok: true, count: pushPrefs.subscriptions?.length ?? 0, report });
      });
    }

    if (url.pathname === "/api/push/status" && req.method === "GET") {
      return Response.json({
        ok: true,
        count: pushPrefs.subscriptions?.length ?? 0,
      });
    }

    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = join(PUBLIC_DIR, pathname.replace(/\.\./g, ""));
    return serveFile(safePath);
  },

  websocket: {
    open(ws) {
      clients.add(ws);
      const clientId = (ws as any).data?.clientId as string | undefined;
      markClientConnected(clientId);
      console.log(`[bridge] Client connected (total=${clients.size}${clientId ? `, clientId=${clientId}` : ""})`);
      bootstrapClient(ws);
    },
    close(ws) {
      clients.delete(ws);
      const clientId = (ws as any).data?.clientId as string | undefined;
      markClientDisconnected(clientId);
      // Tear down any RPC agents this client had attached (3.2)
      detachAgentsForClient(ws);
      // Remove any pending routes for this ws to avoid leaks
      for (const [id, target] of pendingResponseRoutes) {
        if (target === ws) pendingResponseRoutes.delete(id);
      }
      console.log(`[bridge] Client disconnected (total=${clients.size}${clientId ? `, clientId=${clientId}` : ""})`);
    },
    message(ws, msg) {
      handleClientMessage(ws, typeof msg === "string" ? msg : msg.toString());
    },
  },
});

console.log(`[bridge] Listening on http://0.0.0.0:${PORT}`);
console.log(`[bridge] Open on your phone: http://<tailscale-ip>:${PORT}`);
console.log(`[bridge] Terminal: type a prompt, prefix "> " for follow-up, "abort" to stop.`);
console.log();

// ---------------------------------------------------------------------------
// Terminal input loop (optional quick-testing without opening a browser)
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;

  if (text === "abort") {
    console.log("[abort]");
    sendToPi({ type: "abort" });
    return;
  }

  if (text.startsWith("> ")) {
    const msg = text.slice(2).trim();
    console.log(`\n[follow_up] ${msg}`);
    sendToPi({ type: "follow_up", message: msg });
  } else {
    // Use prompt with steer as streaming behavior so it works whether idle or running
    console.log(`\n[prompt] ${text}`);
    sendToPi({ type: "prompt", message: text, streamingBehavior: "steer" });
  }
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on("SIGINT", () => {
  console.log("\n[bridge] Shutting down…");
  pi.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  pi.kill();
  process.exit(0);
});
