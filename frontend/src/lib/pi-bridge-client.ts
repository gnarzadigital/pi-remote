import {
  buildStatusText,
  extractToolResultText,
  extractUserImages,
  extractUserText,
  finalizeTurnBlocks,
  getModelContextWindowTokens,
  uid,
} from "./message-utils";
import { enrichSessionWorkspace, formatSessionName } from "./session-utils";
import {
  ensureReadBaseline,
  markSessionRead,
  markSessionUnread,
} from "./session-read-state";
import type {
  AgentContextMode,
  AgentTreeNode,
  BridgeSnapshot,
  ChatLine,
  DirListing,
  ExtensionDialogState,
  ImageAttachment,
  PiCommand,
  PiModel,
  PiSession,
  SendMode,
  SessionHit,
  SessionStats,
  Theme,
  ThinkingLevel,
  TurnBlock,
} from "./types";
import { applyTheme } from "./utils";
import { shouldFlushQueueOnReconnect, shouldQueue } from "./message-queue";
import {
  initialAgentChatState,
  reduceAgentEvent,
  shouldReattachAgentOnReconnect,
  type AgentChatState,
} from "./agent-turn-reducer";

const MODE_CYCLE: SendMode[] = ["prompt", "steer", "follow_up"];
const THINKING_CYCLE: ThinkingLevel[] = ["none", "low", "high"];
const PUSH_CLIENT_ID_KEY = "push-client-id";

type StreamingState = {
  turnId: string;
  blocks: TurnBlock[];
  toolIndex: Map<string, number>;
};

function initialSnapshot(): BridgeSnapshot {
  const theme: Theme =
    (localStorage.getItem("pi-remote-theme") as Theme | null) ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  return {
    connected: false,
    connectionPhase: "connecting",
    streaming: false,
    statusError: null,
    view: "sessions",
    theme,
    queuedMessages: [],
    gitBranch: null,
    searchResults: null,
    agents: [],
    peek: null,
    dirListing: null,
    attachedAgentId: null,
    attachedAgentLabel: null,
    attachedAgentLines: [],
    attachedAgentStreaming: false,
    sessions: [],
    activeSessionName: null,
    activeSessionPath: null,
    sessionInfo: null,
    lines: [],
    activeModel: null,
    allModels: [],
    recentModels: [],
    stats: null,
    mode: "prompt",
    thinkingLevel: (localStorage.getItem("thinking-level") as ThinkingLevel) ?? "none",
    commands: [],
    cmdPickerOpen: false,
    cmdFilter: "",
    cmdSelectedIdx: 0,
    extensionDialog: null,
    notificationsEnabled: localStorage.getItem("notifications-enabled") === "true",
  };
}

export class PiBridgeClient {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private reqCounter = 0;
  private listeners = new Set<() => void>();
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private streaming: StreamingState | null = null;
  private messageQueue: string[] = [];
  private agentChatState: AgentChatState = initialAgentChatState();
  private pendingAttachAgentId: string | null = null;
  /** sessionPath of the currently-attached agent, kept so a reconnect can
   * re-attach the same RPC process the bridge tore down on WS close. */
  private attachedSessionPath: string | null = null;
  private pendingImages: ImageAttachment[] = [];
  private connectionWatchdog: ReturnType<typeof setTimeout> | null = null;
  private pendingRenames = new Map<string, { sessionPath: string; name: string }>();

  snapshot: BridgeSnapshot = initialSnapshot();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private pendingPatch: Partial<BridgeSnapshot> | null = null;
  private patchQueued = false;
  /** Messages from pi `notify` extension calls that the user dismissed.
   *  Persisted to localStorage so they don't reappear on reconnect. */
  private dismissedNotifies = new Set<string>(
    (() => { try { return JSON.parse(localStorage.getItem("pi-dismissed-notifies") ?? "[]"); } catch { return []; } })()
  );

  private queuePatch(partial: Partial<BridgeSnapshot>) {
    // Accumulate the patch — do NOT touch this.snapshot synchronously,
    // because useSyncExternalStore.getSnapshot() may be called mid-render
    // by another component. Apply on a macrotask, fully outside React's cycle.
    this.pendingPatch = this.pendingPatch ? { ...this.pendingPatch, ...partial } : partial;
    if (!this.patchQueued) {
      this.patchQueued = true;
      setTimeout(() => {
        this.patchQueued = false;
        if (this.pendingPatch) {
          this.snapshot = { ...this.snapshot, ...this.pendingPatch };
          this.pendingPatch = null;
          this.emit();
        }
      }, 0);
    }
  }


  private nextId() {
    return `client-${++this.reqCounter}`;
  }

  private send(cmd: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(cmd));
    }
  }

  sendWithId(cmd: Record<string, unknown>) {
    const id = this.nextId();
    this.send({ ...cmd, id });
    return id;
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const clientId = encodeURIComponent(this.getPushClientId());
    this.queuePatch({ connectionPhase: "connecting" });
    this.scheduleConnectionWatchdog();
    this.ws = new WebSocket(`${proto}://${location.host}?clientId=${clientId}`);

    this.ws.addEventListener("open", () => {
      this.reconnectDelay = 1000;
      this.clearConnectionWatchdog();
      this.queuePatch({ connected: true, connectionPhase: "connected", statusError: null });
      if (this.snapshot.thinkingLevel !== "none") {
        this.sendWithId({ type: "set_thinking_level", level: this.snapshot.thinkingLevel });
      }
      this.fetchSessions();
      this.fetchGitBranch();
      this.listAgents();
      // Re-bootstrap state after reconnect
      this.sendWithId({ type: "get_state" });
      this.sendWithId({ type: "get_available_models" });
      // A message queued mid-turn only flushes on `agent_end` — a disconnect
      // before that event fires finalizes the turn locally (close handler)
      // but leaves the queue stuck forever. Flush it now that we're back.
      if (shouldFlushQueueOnReconnect(this.messageQueue.length, this.snapshot.streaming)) {
        this.flushQueuedMessage();
      }
      // The bridge kills an attached agent's RPC process on WS close (bridge.ts
      // detachAgentsForClient) — without this, the client's attachedAgentId
      // survives the reconnect but points at a dead process, so any send after
      // reconnecting silently no-ops. Re-attach the same agent + session.
      if (shouldReattachAgentOnReconnect(this.snapshot.attachedAgentId, this.attachedSessionPath)) {
        this.sendWithId({
          type: "attach_agent",
          agentId: this.snapshot.attachedAgentId,
          sessionPath: this.attachedSessionPath,
        });
      }
    });

    this.ws.addEventListener("close", () => {
      this.ws = null;
      // A mid-turn disconnect leaves the streaming turn's line/blocks stuck at
      // streaming: true forever (spinner + thinking-chain "…" never clear) if
      // we just drop the internal tracker — finalize it like a normal agent_end.
      this.finaliseStreamingTurn();
      // Same finalize-on-disconnect gap existed for an attached agent's mirrored
      // turn state (attachedAgentStreaming/attachedAgentLines) — it only reset on
      // a real agent_end event, so a disconnect mid-turn left it stuck forever.
      if (this.agentChatState.streaming) {
        this.agentChatState = reduceAgentEvent(this.agentChatState, { type: "agent_end" });
        this.queuePatch({
          attachedAgentLines: this.agentChatState.lines,
          attachedAgentStreaming: this.agentChatState.streaming,
        });
      }
      this.queuePatch({ connected: false, connectionPhase: "connecting", streaming: false });
      this.scheduleConnectionWatchdog();
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
    });

    this.ws.addEventListener("message", (evt) => {
      try {
        this.handleMessage(JSON.parse(evt.data as string));
      } catch {
        /* ignore */
      }
    });
  }

  private clearConnectionWatchdog() {
    if (this.connectionWatchdog) {
      clearTimeout(this.connectionWatchdog);
      this.connectionWatchdog = null;
    }
  }

  /** After 6s without connect, show red disconnected dot. */
  private scheduleConnectionWatchdog() {
    this.clearConnectionWatchdog();
    this.connectionWatchdog = setTimeout(() => {
      if (!this.snapshot.connected) {
        this.queuePatch({ connectionPhase: "disconnected" });
      }
    }, 6000);
  }

  private getPushClientId(): string {
    let id = localStorage.getItem(PUSH_CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `push-${Date.now()}`;
      localStorage.setItem(PUSH_CLIENT_ID_KEY, id);
    }
    return id;
  }

  private handleMessage(msg: Record<string, unknown>) {
    if (msg.type === "response") {
      this.handleResponse(msg as { success: boolean; command?: string; data?: Record<string, unknown> });
      return;
    }
    if (msg.type === "extension_ui_request") {
      this.handleExtensionUI(msg as Record<string, unknown>);
      return;
    }
    if (msg.type === "agent_event" && msg.agentId === this.snapshot.attachedAgentId) {
      const event = msg.event as Record<string, unknown>;
      if (event.type === "extension_ui_request") {
        // Same approval/input flow the primary session uses, tagged so the
        // response routes back to this agent instead of the primary pi.
        this.handleExtensionUI(event, String(msg.agentId));
        return;
      }
      this.agentChatState = reduceAgentEvent(this.agentChatState, event);
      this.queuePatch({
        attachedAgentLines: this.agentChatState.lines,
        attachedAgentStreaming: this.agentChatState.streaming,
      });
      return;
    }
    if (msg.type === "prompt" || msg.type === "steer" || msg.type === "follow_up") {
      this.handleMirroredCommand(msg);
      return;
    }
    if (msg.type === "set_model" && msg.provider && msg.modelId) {
      const m = this.snapshot.allModels.find(
        (x) => x.id === msg.modelId && x.provider === msg.provider
      );
      if (m) this.setSelectedModel(m);
      return;
    }
    if (msg.type === "prefs") {
      this.queuePatch({ recentModels: (msg.recentModels as PiModel[]) ?? [] });
      return;
    }
    if (msg.type === "session_info") {
      this.queuePatch({
        sessionInfo: `${msg.folder} · ${msg.branch}`,
      });
      return;
    }
    if (msg.type === "bridge_error") {
      const text = String(msg.message ?? "");
      // Suppress deprecation warnings from cluttering the chat
      if (text.includes("deprecated") || text.includes("DeprecationWarning") || text.includes("DEP0")) return;
      const cmd = msg.command ? ` (${msg.command})` : "";
      this.appendError(`Bridge${cmd}: ${text}`);
      this.queuePatch({ statusError: String(msg.command ?? "error") });
      setTimeout(() => this.queuePatch({ statusError: null }), 4000);
      return;
    }

    switch (msg.type) {
      case "agent_start":
        this.queuePatch({ streaming: true });
        this.startStreamingTurn();
        if (navigator.vibrate) navigator.vibrate(30);
        this.startStatsPolling();
        break;
      case "agent_end":
        this.queuePatch({ streaming: false });
        this.finaliseStreamingTurn();
        this.stopStatsPolling();
        this.flushQueuedMessage();
        this.send({ type: "get_session_stats", id: this.nextId() });
        this.fetchSessions();
        if (this.snapshot.activeSessionPath) {
          if (this.snapshot.view === "chat" && !document.hidden) {
            const session = this.snapshot.sessions.find(
              (s) => s.path === this.snapshot.activeSessionPath
            );
            markSessionRead(
              this.snapshot.activeSessionPath,
              session?.mtime ?? Date.now()
            );
          } else {
            markSessionUnread(this.snapshot.activeSessionPath);
          }
        }
        if (navigator.vibrate) navigator.vibrate([20, 60, 20]);
        break;
      case "message_update":
        this.handleMessageUpdate(msg);
        break;
      case "tool_execution_start":
        this.updateTool(msg.toolCallId as string, { status: "running" });
        break;
      case "tool_execution_update":
        this.updateTool(msg.toolCallId as string, {
          output: extractToolResultText((msg.partialResult as { content?: unknown })?.content),
        });
        break;
      case "tool_execution_end":
        this.updateTool(msg.toolCallId as string, {
          status: msg.isError ? "error" : "done",
          output: extractToolResultText((msg.result as { content?: unknown })?.content),
        });
        break;
      case "auto_compaction_start":
        this.appendSystem("⟳ Compacting context…");
        break;
      case "auto_compaction_end":
        this.appendSystem("✓ Compaction complete");
        break;
      case "auto_retry_start":
        this.appendSystem(`↺ Retrying (attempt ${msg.attempt ?? 1})…`);
        break;
    }
  }

  private handleResponse(msg: {
    success: boolean;
    command?: string;
    data?: Record<string, unknown>;
    id?: string;
  }) {
    if (!msg.success) {
      if (msg.command !== "abort") {
        this.queuePatch({ statusError: msg.command ? `${msg.command} failed` : "command failed" });
        setTimeout(() => this.queuePatch({ statusError: null }), 4000);
        if (msg.command === "switch_session") {
          this.queuePatch({ view: "sessions" });
        }
        if (msg.command === "rename_session") {
          this.pendingRenames.delete(String(msg.id));
          this.fetchSessions();
        }
      }
      return;
    }
    switch (msg.command) {
      case "get_state":
        if (msg.data) {
          this.queuePatch({ streaming: Boolean(msg.data.isStreaming) });
          if (msg.data.model) this.setSelectedModel(msg.data.model as PiModel);
          if (typeof msg.data.sessionName === "string" && msg.data.sessionName.trim()) {
            this.queuePatch({ activeSessionName: msg.data.sessionName.trim() });
          }
        }
        break;
      case "get_messages":
        this.renderHistory((msg.data?.messages as Record<string, unknown>[]) ?? []);
        if (this.snapshot.activeSessionPath && this.snapshot.view === "chat") {
          const session = this.snapshot.sessions.find(
            (s) => s.path === this.snapshot.activeSessionPath
          );
          markSessionRead(this.snapshot.activeSessionPath, session?.mtime ?? Date.now());
        }
        break;
      case "get_commands":
        this.queuePatch({ commands: (msg.data?.commands as PiCommand[]) ?? [] });
        break;
      case "get_available_models":
        this.queuePatch({ allModels: (msg.data?.models as PiModel[]) ?? [] });
        break;
      case "set_model":
        if (msg.data) this.setSelectedModel(msg.data as unknown as PiModel);
        break;
      case "get_git_branch":
        this.queuePatch({ gitBranch: (msg.data?.branch as string) || null });
        break;
      case "search_sessions":
        this.queuePatch({ searchResults: (msg.data?.results as SessionHit[]) ?? [] });
        break;
      case "list_agents":
        this.queuePatch({ agents: (msg.data?.agents as AgentTreeNode[]) ?? [] });
        break;
      case "capture_agent_pane":
        if (this.snapshot.peek) {
          this.queuePatch({
            peek: { ...this.snapshot.peek, text: (msg.data?.text as string | null) ?? null, loading: false },
          });
        }
        break;
      case "list_dirs":
        this.queuePatch({ dirListing: (msg.data as unknown as DirListing) ?? null });
        break;
      case "spawn_agent":
      case "send_to_agent":
      case "confirm_agent":
        this.listAgents(); // refresh the tree after any mutation
        break;
      case "resolve_agent_session": {
        const sessionPath = msg.data?.sessionPath as string | null | undefined;
        const agentId = this.pendingAttachAgentId;
        this.pendingAttachAgentId = null;
        if (sessionPath && agentId) {
          this.attachedSessionPath = sessionPath;
          this.sendWithId({ type: "attach_agent", agentId, sessionPath });
        } else {
          this.queuePatch({ statusError: "Agent session not ready yet — try again in a moment" });
          setTimeout(() => this.queuePatch({ statusError: null }), 3000);
        }
        break;
      }
      case "attach_agent":
        if (msg.data?.agentId) {
          this.agentChatState = initialAgentChatState();
          this.queuePatch({
            attachedAgentId: String(msg.data.agentId),
            attachedAgentLines: [],
            attachedAgentStreaming: false,
            view: "agent-chat",
          });
        }
        break;
      case "get_session_stats":
        this.queuePatch({ stats: msg.data as SessionStats });
        break;
      case "list_sessions": {
        const raw = (msg.data?.sessions as PiSession[]) ?? [];
        const sessions = raw.map(enrichSessionWorkspace);
        ensureReadBaseline(sessions);
        this.queuePatch({ sessions });
        break;
      }
      case "switch_session":
        if (!msg.data?.cancelled) {
          this.pendingRenames.delete(`switch-${msg.id}`);
          this.appendSystem("✓ Session loaded");
          this.clearConversation();
          this.send({ type: "get_messages", id: this.nextId() });
          this.send({ type: "get_session_stats", id: this.nextId() });
        } else {
          this.queuePatch({ view: "sessions" });
        }
        break;
      case "new_session":
        if (!msg.data?.cancelled) {
          this.appendSystem("✓ New session started");
          this.clearConversation();
          this.send({ type: "get_session_stats", id: this.nextId() });
          // The workspace may have changed (new session in a chosen folder →
          // pi respawned in a new cwd). Refresh cwd-derived views.
          this.fetchSessions();
          this.fetchGitBranch();
        }
        break;
      case "rename_session":
        if (msg.data?.name && msg.data?.sessionPath) {
          const sessionPath = String(msg.data.sessionPath);
          const newName = String(msg.data.name);
          if (this.snapshot.activeSessionPath === sessionPath) {
            this.queuePatch({ activeSessionName: newName });
          }
        }
        this.fetchSessions();
        break;
      case "set_session_name":
        if (msg.id) {
          const pending = this.pendingRenames.get(msg.id);
          if (pending) {
            this.pendingRenames.delete(msg.id);
            if (this.snapshot.activeSessionPath === pending.sessionPath) {
              this.queuePatch({ activeSessionName: pending.name });
            }
          }
        }
        this.fetchSessions();
        break;
    }
  }

  private handleMirroredCommand(msg: Record<string, unknown>) {
    const text = String(msg.message ?? "");
    if (msg.type === "prompt") {
      if (text) this.appendUser(text);
      this.startStreamingTurn();
    } else {
      const prefix = msg.type === "steer" ? "[steer]" : "[follow-up]";
      if (text) this.appendSystem(`${prefix} ${text}`);
    }
  }

  private setSelectedModel(model: PiModel) {
    this.queuePatch({ activeModel: model });
  }

  private clearConversation() {
    this.streaming = null;
    this.queuePatch({ lines: [] });
  }

  private appendUser(text: string, images?: ImageAttachment[]) {
    this.queuePatch({
      lines: [...this.snapshot.lines, { id: uid("user"), kind: "user", text, images }],
    });
  }

  private appendSystem(text: string) {
    this.queuePatch({
      lines: [...this.snapshot.lines, { id: uid("sys"), kind: "system", text }],
    });
  }

  private appendError(text: string) {
    this.queuePatch({
      lines: [...this.snapshot.lines, { id: uid("err"), kind: "error", text: `⚠ ${text}` }],
    });
  }

  private renderHistory(messages: Record<string, unknown>[]) {
    const lines: ChatLine[] = [];
    const toolBlocks = new Map<string, { turnIdx: number; blockIdx: number }>();

    for (const msg of messages) {
      if (msg.role === "user") {
        const text = extractUserText(msg.content);
        const images = extractUserImages(msg.content);
        if (text || images.length) lines.push({ id: uid("user"), kind: "user", text, images });
      } else if (msg.role === "assistant") {
        const blocks: TurnBlock[] = [];
        for (const block of (msg.content as Record<string, unknown>[]) ?? []) {
          if (block.type === "text" && block.text) {
            blocks.push({ kind: "text", text: String(block.text) });
          } else if (block.type === "thinking" && block.thinking) {
            blocks.push({ kind: "thinking", text: String(block.thinking), expanded: false });
          } else if (block.type === "toolCall") {
            const idx = blocks.length;
            blocks.push({
              kind: "tool",
              id: String(block.id),
              name: String(block.name ?? "tool"),
              args: block.arguments ? JSON.stringify(block.arguments, null, 2) : undefined,
              status: "done",
            });
            toolBlocks.set(String(block.id), { turnIdx: lines.length, blockIdx: idx });
          }
        }
        if (blocks.length) lines.push({ id: uid("turn"), kind: "turn", blocks });
      } else if (msg.role === "toolResult") {
        const ref = toolBlocks.get(String(msg.toolCallId));
        if (ref && lines[ref.turnIdx]?.kind === "turn") {
          const turn = lines[ref.turnIdx];
          if (turn.kind === "turn") {
            const b = turn.blocks[ref.blockIdx];
            if (b.kind === "tool") {
              b.output = extractToolResultText(msg.content);
              b.status = msg.isError ? "error" : "done";
            }
          }
        }
      } else if (msg.role === "bashExecution") {
        lines.push({ id: uid("sys"), kind: "system", text: `$ ${msg.command}` });
      }
    }
    this.streaming = null;
    this.queuePatch({ lines });
  }

  private startStreamingTurn() {
    this.finaliseStreamingTurn();
    const turnId = uid("turn");
    this.streaming = { turnId, blocks: [], toolIndex: new Map() };
    this.queuePatch({
      lines: [
        ...this.snapshot.lines,
        { id: turnId, kind: "turn", blocks: [], streaming: true },
      ],
    });
  }

  private finaliseStreamingTurn() {
    if (!this.streaming) return;
    const lines = this.snapshot.lines.map((l) =>
      l.id === this.streaming!.turnId && l.kind === "turn"
        ? { ...l, streaming: false, blocks: finalizeTurnBlocks(l.blocks) }
        : l
    );
    this.streaming = null;
    this.queuePatch({ lines });
  }

  private updateStreamingBlocks(updater: (blocks: TurnBlock[]) => TurnBlock[]) {
    if (!this.streaming) return;
    const lines = this.snapshot.lines.map((l) => {
      if (l.id !== this.streaming!.turnId || l.kind !== "turn") return l;
      const blocks = updater([...l.blocks]);
      this.streaming!.blocks = blocks;
      return { ...l, blocks };
    });
    this.queuePatch({ lines });
  }

  private handleMessageUpdate(msg: Record<string, unknown>) {
    const e = (msg.assistantMessageEvent as Record<string, unknown>) ?? {};
    if (!this.streaming) return;

    switch (e.type) {
      case "text_delta": {
        this.updateStreamingBlocks((blocks) => {
          const last = blocks[blocks.length - 1];
          if (last?.kind === "text") {
            return [
              ...blocks.slice(0, -1),
              { ...last, text: last.text + String(e.delta ?? ""), streaming: true },
            ];
          }
          return [...blocks, { kind: "text", text: String(e.delta ?? ""), streaming: true }];
        });
        break;
      }
      case "thinking_delta": {
        this.updateStreamingBlocks((blocks) => {
          // Find the last thinking block to support multi-phase thinking
          let idx = -1;
          for (let i = blocks.length - 1; i >= 0; i--) {
            if (blocks[i].kind === "thinking") { idx = i; break; }
          }
          if (idx >= 0 && blocks[idx].kind === "thinking") {
            const copy = [...blocks];
            const tb = copy[idx];
            if (tb.kind === "thinking") {
              copy[idx] = {
                ...tb,
                text: tb.text + String(e.delta ?? ""),
                streaming: true,
              };
            }
            return copy;
          }
          return [...blocks, { kind: "thinking", text: String(e.delta ?? ""), streaming: true }];
        });
        break;
      }
      case "toolcall_end": {
        const tc = e.toolCall as Record<string, unknown> | undefined;
        if (!tc?.id) break;
        this.updateStreamingBlocks((blocks) => {
          const id = String(tc.id);
          let idx = this.streaming!.toolIndex.get(id);
          if (idx == null) {
            idx = blocks.length;
            this.streaming!.toolIndex.set(id, idx);
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
          }
          const copy = [...blocks];
          const b = copy[idx];
          if (b.kind === "tool") {
            copy[idx] = {
              ...b,
              name: String(tc.name ?? b.name),
              args: tc.arguments ? JSON.stringify(tc.arguments, null, 2) : b.args,
            };
          }
          return copy;
        });
        break;
      }
    }
  }

  private updateTool(toolCallId: string, patch: Partial<TurnBlock & { kind: "tool" }>) {
    if (this.streaming) {
      // Normal path: streaming turn is active
      this.updateStreamingBlocks((blocks) => {
        const idx = this.streaming!.toolIndex.get(toolCallId);
        if (idx == null) return blocks;
        const copy = [...blocks];
        const b = copy[idx];
        if (b.kind === "tool") copy[idx] = { ...b, ...patch };
        return copy;
      });
      return;
    }
    // Fallback: turn already finalized but tool event arrived late
    // Find the most recent turn and try to patch its tool blocks
    this.queuePatch({
      lines: this.snapshot.lines.map((l) => {
        if (l.kind !== "turn") return l;
        const toolIdx = l.blocks.findIndex(
          (b) => b.kind === "tool" && b.id === toolCallId
        );
        if (toolIdx < 0) return l;
        const copy = [...l.blocks];
        const block = copy[toolIdx];
        if (block.kind === "tool") {
          copy[toolIdx] = { ...block, ...patch };
        }
        return { ...l, blocks: copy };
      }),
    });
  }

  private startStatsPolling() {
    if (this.statsInterval) return;
    this.statsInterval = setInterval(() => {
      if (this.snapshot.streaming) {
        this.send({ type: "get_session_stats", id: this.nextId() });
      }
    }, 2500);
  }

  private stopStatsPolling() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.statsInterval = null;
  }

  /** agentId is set when this request came from an attached agent's agent_event,
   * not the primary session — the response routes back via agent_command instead
   * of a top-level extension_ui_response. */
  private handleExtensionUI(req: Record<string, unknown>, agentId?: string) {
    const method = String(req.method ?? "");
    if (method === "setStatus" || method === "setWidget" || method === "setTitle") return;

    const respond = (payload: { id: string; cancelled: boolean; value: unknown }) => {
      if (agentId) {
        this.send({ type: "agent_command", agentId, payload: { type: "extension_ui_response", ...payload } });
      } else {
        this.send({ type: "extension_ui_response", ...payload });
      }
    };

    // `notify` is fire-and-forget — pi uses it for advisory messages
    // (e.g. "@qhqn/pi-goal also installed"). Persist dismissal so the same
    // message never pops up again, even across reconnects.
    if (method === "notify") {
      const message = String(req.message ?? req.title ?? "").slice(0, 120);
      if (message) {
        if (!this.dismissedNotifies.has(message)) {
          this.dismissedNotifies.add(message);
          try { localStorage.setItem("pi-dismissed-notifies", JSON.stringify([...this.dismissedNotifies])); } catch {}
          this.appendSystem(`ℹ ${message}`);
        }
        // Always ack so pi doesn't block or re-send
        respond({ id: String(req.id), cancelled: true, value: null });
      }
      return;
    }

    const dialog: ExtensionDialogState = {
      id: String(req.id),
      method,
      title: String(req.title ?? method),
      message: req.message ? String(req.message) : undefined,
      options: Array.isArray(req.options) ? (req.options as string[]) : undefined,
      showInput: method === "input" || method === "confirm",
      showEditor: method === "editor",
      showConfirm: method !== "notify",
      inputValue: "",
      editorValue: String(req.text ?? ""),
      agentId,
    };
    this.queuePatch({ extensionDialog: dialog });
  }

  resolveExtensionDialog(value: unknown, cancelled = false) {
    const d = this.snapshot.extensionDialog;
    if (!d) return;
    const payload = { id: d.id, cancelled, value };
    if (d.agentId) {
      this.send({ type: "agent_command", agentId: d.agentId, payload: { type: "extension_ui_response", ...payload } });
    } else {
      this.send({ type: "extension_ui_response", ...payload });
    }
    this.queuePatch({ extensionDialog: null });
  }

  // ─── Public actions ───────────────────────────────────────────────────────

  fetchSessions() {
    this.sendWithId({ type: "list_sessions" });
  }

  fetchGitBranch() {
    this.sendWithId({ type: "get_git_branch" });
  }

  listAgents() {
    this.sendWithId({ type: "list_agents" });
  }

  /** Request a terminal-runtime agent's live pane text (with scrollback) for the
   * full terminal view. surface + workspace are both required (surface is only
   * unique within one workspace). Pass refresh=true for silent polling so the
   * view doesn't flash a "Reading…" state on every auto-refresh tick. */
  capturePane(agent: AgentTreeNode, refresh = false) {
    if (!agent.surface || !agent.workspace) {
      this.queuePatch({ peek: { agentId: agent.id, text: null, loading: false } });
      return;
    }
    if (!refresh) this.queuePatch({ peek: { agentId: agent.id, text: null, loading: true } });
    this.sendWithId({ type: "capture_agent_pane", surface: agent.surface, workspace: agent.workspace, lines: 200 });
  }

  closePeek() {
    if (this.snapshot.peek) this.queuePatch({ peek: null });
  }

  spawnAgent(req: { cwd?: string; task: string; contextMode: AgentContextMode; parentId?: string | null }) {
    this.sendWithId({ type: "spawn_agent", ...req });
  }

  // workspace disambiguates surface numbers that collide across cmux workspaces
  // (a bare surface is only unique within one workspace) — always pass it when
  // the caller has it (AgentTreeNode.workspace).
  steerAgent(surface: string, message: string, workspace?: string | null) {
    this.sendWithId({ type: "send_to_agent", surface, message, workspace: workspace ?? undefined });
  }

  confirmAgent(surface: string, workspace?: string | null) {
    this.sendWithId({ type: "confirm_agent", surface, workspace: workspace ?? undefined });
  }

  /** Attach the rich chat view to a runtime="pi" agent (resolves its session file
   * first, using the cwd/spawnedAt already on the node — works for any pi agent,
   * not just ones this phone spawned; only "pi" supports this, see AgentTreeNode.runtime). */
  attachToAgent(agent: AgentTreeNode) {
    this.pendingAttachAgentId = agent.id;
    this.queuePatch({ attachedAgentLabel: agent.label });
    this.sendWithId({
      type: "resolve_agent_session",
      agentId: agent.id,
      cwd: agent.cwd,
      spawnedAt: agent.spawnedAt,
    });
  }

  detachFromAgent() {
    const agentId = this.snapshot.attachedAgentId;
    if (agentId) this.send({ type: "detach_agent", agentId, id: this.nextId() });
    this.attachedSessionPath = null;
    this.agentChatState = initialAgentChatState();
    this.queuePatch({
      attachedAgentId: null,
      attachedAgentLabel: null,
      attachedAgentLines: [],
      attachedAgentStreaming: false,
      view: "sessions",
    });
  }

  /** Switch the attached agent's model via /model — routed to THAT agent's pi
   * process (agent_command), the same set_model shape the primary session uses. */
  setAttachedAgentModel(model: PiModel) {
    const agentId = this.snapshot.attachedAgentId;
    if (!agentId) return;
    this.sendWithId({
      type: "agent_command",
      agentId,
      payload: { type: "set_model", provider: model.provider, modelId: model.id },
    });
  }

  sendToAttachedAgent(text: string) {
    const agentId = this.snapshot.attachedAgentId;
    if (!agentId || !text.trim()) return;
    const turnId = uid("user");
    this.queuePatch({
      attachedAgentLines: [...this.snapshot.attachedAgentLines, { id: turnId, kind: "user", text }],
    });
    this.sendWithId({ type: "agent_command", agentId, payload: { type: "prompt", message: text } });
  }

  searchSessions(query: string) {
    if (query.trim().length < 2) {
      this.clearSearch();
      return;
    }
    this.sendWithId({ type: "search_sessions", query });
  }

  clearSearch() {
    if (this.snapshot.searchResults !== null) this.queuePatch({ searchResults: null });
  }

  refreshModels() {
    this.sendWithId({ type: "get_available_models" });
  }

  setView(view: "sessions" | "chat") {
    this.queuePatch({ view });
    if (view === "sessions") this.fetchSessions();
  }

  switchSession(session: PiSession) {
    this.queuePatch({
      activeSessionName: formatSessionName(session.name),
      activeSessionPath: session.path,
      view: "chat",
    });
    markSessionRead(session.path, session.mtime);
    this.sendWithId({ type: "switch_session", sessionPath: session.path });
    if (this.snapshot.connected) {
      this.appendSystem("↻ Switching session…");
    } else {
      this.appendSystem("⚠ pi not connected — commands will not work");
    }
  }

  renameSession(sessionPath: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed || !sessionPath) return;
    const id = this.sendWithId({ type: "rename_session", sessionPath, name: trimmed });
    this.pendingRenames.set(id, { sessionPath, name: trimmed });
    if (this.snapshot.activeSessionPath === sessionPath) {
      this.queuePatch({ activeSessionName: trimmed });
    }
  }

  newSession() {
    this.queuePatch({
      activeSessionName: "New session",
      activeSessionPath: null,
      view: "chat",
    });
    this.sendWithId({ type: "new_session" });
    this.appendSystem("↻ Starting new session…");
  }

  /** Browse folders for the workspace picker (default: home when path omitted). */
  listDirs(path?: string) {
    this.sendWithId(path ? { type: "list_dirs", path } : { type: "list_dirs" });
  }

  /** Start a new session in a chosen folder. The bridge respawns pi there (its
   * cwd is fixed per-process) then creates the session, so the whole app switches
   * to that workspace. */
  newSessionInDir(cwd: string) {
    this.queuePatch({
      activeSessionName: "New session",
      activeSessionPath: null,
      view: "chat",
    });
    this.sendWithId({ type: "new_session", cwd });
    this.appendSystem(`↻ Starting new session in ${cwd}…`);
  }

  setTheme(theme: Theme) {
    localStorage.setItem("pi-remote-theme", theme);
    applyTheme(theme);
    this.queuePatch({ theme });
  }

  toggleTheme() {
    // Quick toggle cycles light -> dark -> console -> light.
    const order: Theme[] = ["light", "dark", "console"];
    const next = order[(order.indexOf(this.snapshot.theme) + 1) % order.length];
    this.setTheme(next);
  }

  setMode(mode: SendMode) {
    this.queuePatch({ mode });
  }

  cycleMode() {
    const i = MODE_CYCLE.indexOf(this.snapshot.mode);
    this.setMode(MODE_CYCLE[(i + 1) % MODE_CYCLE.length]);
  }

  setThinkingLevel(level: ThinkingLevel, sendRpc = true) {
    localStorage.setItem("thinking-level", level);
    this.queuePatch({ thinkingLevel: level });
    if (sendRpc) this.sendWithId({ type: "set_thinking_level", level });
  }

  cycleThinking() {
    const i = THINKING_CYCLE.indexOf(this.snapshot.thinkingLevel);
    this.setThinkingLevel(THINKING_CYCLE[(i + 1) % THINKING_CYCLE.length]);
  }

  setModel(model: PiModel) {
    this.sendWithId({ type: "set_model", provider: model.provider, modelId: model.id });
  }

  abort() {
    this.send({ type: "abort" });
  }

  compact() {
    this.appendSystem("⟳ Requesting compaction…");
    this.sendWithId({ type: "compact" });
  }

  /** Send the next queued prompt after a turn ends (bypasses the queue guard). */
  private flushQueuedMessage() {
    if (this.messageQueue.length === 0) return;
    const next = this.messageQueue.shift()!;
    this.queuePatch({ queuedMessages: [...this.messageQueue] });
    this.appendUser(next);
    this.send({ type: "prompt", message: next, streamingBehavior: "steer" });
  }

  /** Remove a queued prompt before it sends. */
  cancelQueued(index: number) {
    if (index < 0 || index >= this.messageQueue.length) return;
    this.messageQueue.splice(index, 1);
    this.queuePatch({ queuedMessages: [...this.messageQueue] });
  }

  /** Interrupt the running agent NOW with a steer message, bypassing the queue.
   * Used by the composer's "Interrupt" action, which only appears while streaming
   * — the deliberate "cut in and redirect" path, vs the default queue-on-send. */
  sendInterrupt(text: string) {
    const val = text.trim();
    if (!val || !this.snapshot.connected) return;
    this.hideCmdPicker();
    this.appendSystem(`[steer] ${val}`);
    this.send({ type: "steer", message: val });
  }

  sendMessage(text: string) {
    if (!text.trim() || !this.snapshot.connected) return;
    this.hideCmdPicker();

    if (text === "/new" || text.startsWith("/new ")) {
      this.newSession();
      return;
    }

    if (shouldQueue(this.snapshot.streaming, this.snapshot.mode, this.pendingImages.length > 0)) {
      this.messageQueue.push(text);
      this.queuePatch({ queuedMessages: [...this.messageQueue] });
      return;
    }

    const images =
      this.pendingImages.length > 0
        ? this.pendingImages.map(({ type, data, mimeType }) => ({ type, data, mimeType }))
        : undefined;

    const mode = this.snapshot.mode;
    if (mode === "prompt") {
      this.appendUser(text, this.pendingImages);
      const cmd: Record<string, unknown> = {
        type: "prompt",
        message: text,
        streamingBehavior: "steer",
      };
      if (images) cmd.images = images;
      this.send(cmd);
    } else if (mode === "steer") {
      this.appendSystem(`[steer] ${text}`);
      const cmd: Record<string, unknown> = { type: "steer", message: text };
      if (images) cmd.images = images;
      this.send(cmd);
    } else {
      this.appendSystem(`[follow-up] ${text}`);
      const cmd: Record<string, unknown> = { type: "follow_up", message: text };
      if (images) cmd.images = images;
      this.send(cmd);
    }

    this.pendingImages.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
    this.pendingImages = [];
  }

  addPendingImages(files: FileList | File[]) {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const data = (reader.result as string).split(",")[1];
        this.pendingImages.push({
          type: "image",
          data,
          mimeType: file.type,
          preview: URL.createObjectURL(file),
        });
        this.emit();
      };
      reader.readAsDataURL(file);
    }
  }

  get pendingImageCount() {
    return this.pendingImages.length;
  }

  showCmdPicker(filter: string) {
    this.queuePatch({
      cmdPickerOpen: true,
      cmdFilter: filter,
      cmdSelectedIdx: 0,
    });
  }

  hideCmdPicker() {
    this.queuePatch({ cmdPickerOpen: false, cmdFilter: "", cmdSelectedIdx: 0 });
  }

  moveCmdSelection(delta: number) {
    if (!this.snapshot.cmdPickerOpen) return;
    const q = this.snapshot.cmdFilter.toLowerCase();
    const matches = this.snapshot.commands
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
    if (matches.length === 0) return;
    const next =
      (this.snapshot.cmdSelectedIdx + delta + matches.length) % matches.length;
    this.queuePatch({ cmdSelectedIdx: next });
  }

  selectCommand(name: string) {
    this.hideCmdPicker();
    return `/${name} `;
  }

  getStatusText(): string {
    const ctx = getModelContextWindowTokens(
      (this.snapshot.activeModel ?? null) as Record<string, unknown> | null
    );
    return buildStatusText(
      this.snapshot.connected,
      this.snapshot.streaming,
      this.snapshot.activeModel,
      this.snapshot.stats,
      ctx
    );
  }

  toggleThinking(_lineId: string, _blockIdx: number) {
    // Thinking expand/collapse is local UI state in ConversationView
  }

  exportConversation(): void {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>pi remote export</title>
<style>body{font-family:system-ui;background:#fff;color:#0a0a0a;padding:20px;max-width:800px;margin:0 auto}
.user{background:#f2f2f2;border:1px solid #e5e5e5;padding:12px;border-radius:10px;margin:8px 0}
.assistant{border:1px solid #e5e5e5;padding:12px;border-radius:10px;margin:8px 0}
.system{color:#737373;font-size:12px;text-align:center;margin:8px 0}
pre{background:#f2f2f2;border:1px solid #e5e5e5;padding:12px;border-radius:10px;overflow-x:auto;font-size:13px}
</style></head><body>${this.snapshot.lines
      .map((l) => {
        if (l.kind === "user") return `<div class="user"><strong>You</strong><p>${escapeHtml(l.text)}</p></div>`;
        if (l.kind === "system") return `<div class="system">${escapeHtml(l.text)}</div>`;
        if (l.kind === "error") return `<div class="system">${escapeHtml(l.text)}</div>`;
        if (l.kind === "turn") {
          const inner = l.blocks
            .map((b) => {
              if (b.kind === "text") return `<div class="assistant">${escapeHtml(b.text)}</div>`;
              if (b.kind === "tool")
                return `<pre>${escapeHtml(b.name)}\n${escapeHtml(b.output ?? "")}</pre>`;
              return "";
            })
            .join("");
          return inner;
        }
        return "";
      })
      .join("")}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pi-conversation-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const piBridge = new PiBridgeClient();
