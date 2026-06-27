import {
  buildStatusText,
  extractToolResultText,
  extractUserImages,
  extractUserText,
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
  BridgeSnapshot,
  ChatLine,
  ExtensionDialogState,
  ImageAttachment,
  PiCommand,
  PiModel,
  PiSession,
  SendMode,
  SessionStats,
  ThinkingLevel,
  TurnBlock,
} from "./types";

const MODE_CYCLE: SendMode[] = ["prompt", "steer", "follow_up"];
const THINKING_CYCLE: ThinkingLevel[] = ["none", "low", "high"];
const PUSH_CLIENT_ID_KEY = "push-client-id";

type StreamingState = {
  turnId: string;
  blocks: TurnBlock[];
  toolIndex: Map<string, number>;
};

function initialSnapshot(): BridgeSnapshot {
  const theme =
    (localStorage.getItem("pi-remote-theme") as "light" | "dark" | null) ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  return {
    connected: false,
    connectionPhase: "connecting",
    streaming: false,
    statusError: null,
    view: "sessions",
    theme,
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

  private patch(partial: Partial<BridgeSnapshot>) {
    this.snapshot = { ...this.snapshot, ...partial };
    this.emit();
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
    this.patch({ connectionPhase: "connecting" });
    this.scheduleConnectionWatchdog();
    this.ws = new WebSocket(`${proto}://${location.host}?clientId=${clientId}`);

    this.ws.addEventListener("open", () => {
      this.reconnectDelay = 1000;
      this.clearConnectionWatchdog();
      this.patch({ connected: true, connectionPhase: "connected", statusError: null });
      if (this.snapshot.thinkingLevel !== "none") {
        this.sendWithId({ type: "set_thinking_level", level: this.snapshot.thinkingLevel });
      }
      this.fetchSessions();
    });

    this.ws.addEventListener("close", () => {
      this.ws = null;
      this.patch({ connected: false, connectionPhase: "connecting", streaming: false });
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
        this.patch({ connectionPhase: "disconnected" });
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
      this.patch({ recentModels: (msg.recentModels as PiModel[]) ?? [] });
      return;
    }
    if (msg.type === "session_info") {
      this.patch({
        sessionInfo: `${msg.folder} · ${msg.branch}`,
      });
      return;
    }
    if (msg.type === "bridge_error") {
      const cmd = msg.command ? ` (${msg.command})` : "";
      this.appendError(`Bridge${cmd}: ${msg.message ?? "unknown error"}`);
      this.patch({ statusError: String(msg.command ?? "error") });
      setTimeout(() => this.patch({ statusError: null }), 4000);
      return;
    }

    switch (msg.type) {
      case "agent_start":
        this.patch({ streaming: true });
        this.startStreamingTurn();
        if (navigator.vibrate) navigator.vibrate(30);
        this.startStatsPolling();
        break;
      case "agent_end":
        this.patch({ streaming: false });
        this.finaliseStreamingTurn();
        this.stopStatsPolling();
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
        this.patch({ statusError: msg.command ? `${msg.command} failed` : "command failed" });
        setTimeout(() => this.patch({ statusError: null }), 4000);
      }
      return;
    }
    switch (msg.command) {
      case "get_state":
        if (msg.data) {
          this.patch({ streaming: Boolean(msg.data.isStreaming) });
          if (msg.data.model) this.setSelectedModel(msg.data.model as PiModel);
          if (typeof msg.data.sessionName === "string" && msg.data.sessionName.trim()) {
            this.patch({ activeSessionName: msg.data.sessionName.trim() });
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
        this.patch({ commands: (msg.data?.commands as PiCommand[]) ?? [] });
        break;
      case "get_available_models":
        this.patch({ allModels: (msg.data?.models as PiModel[]) ?? [] });
        break;
      case "set_model":
        if (msg.data) this.setSelectedModel(msg.data as unknown as PiModel);
        break;
      case "get_session_stats":
        this.patch({ stats: msg.data as SessionStats });
        break;
      case "list_sessions": {
        const raw = (msg.data?.sessions as PiSession[]) ?? [];
        const sessions = raw.map(enrichSessionWorkspace);
        ensureReadBaseline(sessions);
        this.patch({ sessions });
        break;
      }
      case "switch_session":
        if (!msg.data?.cancelled) {
          this.appendSystem("✓ Session loaded");
          this.clearConversation();
          this.send({ type: "get_messages", id: this.nextId() });
          this.send({ type: "get_session_stats", id: this.nextId() });
        }
        break;
      case "new_session":
        if (!msg.data?.cancelled) {
          this.appendSystem("✓ New session started");
          this.clearConversation();
          this.send({ type: "get_session_stats", id: this.nextId() });
        }
        break;
      case "rename_session":
        if (msg.data?.name && msg.data?.sessionPath) {
          const sessionPath = String(msg.data.sessionPath);
          const newName = String(msg.data.name);
          if (this.snapshot.activeSessionPath === sessionPath) {
            this.patch({ activeSessionName: newName });
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
              this.patch({ activeSessionName: pending.name });
            }
          }
        }
        this.fetchSessions();
        break;
    }
  }

  private handleMirroredCommand(msg: Record<string, unknown>) {
    const text = String(msg.message ?? "");
    if (text) this.appendUser(text);
    if (msg.type === "prompt") this.startStreamingTurn();
  }

  private setSelectedModel(model: PiModel) {
    this.patch({ activeModel: model });
  }

  private clearConversation() {
    this.streaming = null;
    this.patch({ lines: [] });
  }

  private appendUser(text: string, images?: ImageAttachment[]) {
    this.patch({
      lines: [...this.snapshot.lines, { id: uid("user"), kind: "user", text, images }],
    });
  }

  private appendSystem(text: string) {
    this.patch({
      lines: [...this.snapshot.lines, { id: uid("sys"), kind: "system", text }],
    });
  }

  private appendError(text: string) {
    this.patch({
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
    this.patch({ lines });
  }

  private startStreamingTurn() {
    this.finaliseStreamingTurn();
    const turnId = uid("turn");
    this.streaming = { turnId, blocks: [], toolIndex: new Map() };
    this.patch({
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
        ? {
            ...l,
            streaming: false,
            blocks: l.blocks.map((b) =>
              b.kind === "text" ? { ...b, streaming: false } : b
            ),
          }
        : l
    );
    this.streaming = null;
    this.patch({ lines });
  }

  private updateStreamingBlocks(updater: (blocks: TurnBlock[]) => TurnBlock[]) {
    if (!this.streaming) return;
    const lines = this.snapshot.lines.map((l) => {
      if (l.id !== this.streaming!.turnId || l.kind !== "turn") return l;
      const blocks = updater([...l.blocks]);
      this.streaming!.blocks = blocks;
      return { ...l, blocks };
    });
    this.patch({ lines });
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
          const idx = blocks.findIndex((b) => b.kind === "thinking");
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
    if (!this.streaming) return;
    this.updateStreamingBlocks((blocks) => {
      const idx = this.streaming!.toolIndex.get(toolCallId);
      if (idx == null) return blocks;
      const copy = [...blocks];
      const b = copy[idx];
      if (b.kind === "tool") copy[idx] = { ...b, ...patch };
      return copy;
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

  private handleExtensionUI(req: Record<string, unknown>) {
    const method = String(req.method ?? "");
    if (method === "setStatus" || method === "setWidget" || method === "setTitle") return;
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
    };
    this.patch({ extensionDialog: dialog });
  }

  resolveExtensionDialog(value: unknown, cancelled = false) {
    const d = this.snapshot.extensionDialog;
    if (!d) return;
    this.send({
      type: "extension_ui_response",
      id: d.id,
      cancelled,
      value,
    });
    this.patch({ extensionDialog: null });
  }

  // ─── Public actions ───────────────────────────────────────────────────────

  fetchSessions() {
    this.sendWithId({ type: "list_sessions" });
  }

  refreshModels() {
    this.sendWithId({ type: "get_available_models" });
  }

  setView(view: "sessions" | "chat") {
    this.patch({ view });
    if (view === "sessions") this.fetchSessions();
  }

  switchSession(session: PiSession) {
    this.patch({
      activeSessionName: formatSessionName(session.name),
      activeSessionPath: session.path,
      view: "chat",
    });
    markSessionRead(session.path, session.mtime);
    this.sendWithId({ type: "switch_session", sessionPath: session.path });
    this.appendSystem("↻ Switching session…");
  }

  renameSession(sessionPath: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed || !sessionPath) return;
    const id = this.sendWithId({ type: "rename_session", sessionPath, name: trimmed });
    this.pendingRenames.set(id, { sessionPath, name: trimmed });
    if (this.snapshot.activeSessionPath === sessionPath) {
      this.patch({ activeSessionName: trimmed });
    }
  }

  newSession() {
    this.patch({
      activeSessionName: "New session",
      activeSessionPath: null,
      view: "chat",
    });
    this.sendWithId({ type: "new_session" });
    this.appendSystem("↻ Starting new session…");
  }

  setTheme(theme: "light" | "dark") {
    localStorage.setItem("pi-remote-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    this.patch({ theme });
  }

  toggleTheme() {
    this.setTheme(this.snapshot.theme === "light" ? "dark" : "light");
  }

  setMode(mode: SendMode) {
    this.patch({ mode });
  }

  cycleMode() {
    const i = MODE_CYCLE.indexOf(this.snapshot.mode);
    this.setMode(MODE_CYCLE[(i + 1) % MODE_CYCLE.length]);
  }

  setThinkingLevel(level: ThinkingLevel, sendRpc = true) {
    localStorage.setItem("thinking-level", level);
    this.patch({ thinkingLevel: level });
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

  sendMessage(text: string) {
    if (!text.trim() || !this.snapshot.connected) return;
    this.hideCmdPicker();

    if (text === "/new" || text.startsWith("/new ")) {
      this.newSession();
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
    this.patch({
      cmdPickerOpen: true,
      cmdFilter: filter,
      cmdSelectedIdx: 0,
    });
  }

  hideCmdPicker() {
    this.patch({ cmdPickerOpen: false, cmdFilter: "", cmdSelectedIdx: 0 });
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
    this.patch({ cmdSelectedIdx: next });
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
              if (b.kind === "text") return `<div class="assistant">${b.text}</div>`;
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
