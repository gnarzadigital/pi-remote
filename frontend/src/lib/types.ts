export interface PiModel {
  id: string;
  name?: string;
  provider: string;
  label?: string;
  contextWindow?: number;
  context_window?: number;
  maxContextTokens?: number;
  limits?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PiSession {
  name: string;
  path: string;
  mtime: number;
  workspaceSlug?: string;
  workspaceLabel?: string;
  isCurrentWorkspace?: boolean;
}

export interface ImageAttachment {
  type: "image";
  data: string;
  mimeType: string;
  preview?: string;
}

export interface PiCommand {
  name: string;
  description?: string;
}

export type SendMode = "prompt" | "steer" | "follow_up";
export type ThinkingLevel = "none" | "low" | "high";
export type MobileView = "sessions" | "chat" | "agent-chat";
export type ConnectionPhase = "connected" | "connecting" | "disconnected";

export type TurnBlock =
  | { kind: "text"; text: string; streaming?: boolean }
  | { kind: "thinking"; text: string; expanded?: boolean; streaming?: boolean }
  | {
      kind: "tool";
      id: string;
      name: string;
      args?: string;
      output?: string;
      status: "running" | "done" | "error";
    };

export type ChatLine =
  | { id: string; kind: "user"; text: string; images?: ImageAttachment[] }
  | { id: string; kind: "system"; text: string }
  | { id: string; kind: "error"; text: string }
  | { id: string; kind: "turn"; blocks: TurnBlock[]; streaming?: boolean };

export interface SessionStats {
  tokens?: {
    total?: number;
    context?: number;
    contextTokens?: number;
    context_tokens?: number;
    prompt?: number;
    input?: number;
  };
  cost?: number;
}

export interface ExtensionDialogState {
  id: string;
  method: string;
  title: string;
  message?: string;
  options?: string[];
  inputValue?: string;
  editorValue?: string;
  showInput?: boolean;
  showEditor?: boolean;
  showConfirm?: boolean;
  /** Set when this dialog came from an attached agent, not the primary session —
   * routes the response back to that agent instead of the primary pi. */
  agentId?: string;
}

export interface SessionHit extends PiSession {
  snippet?: string;
}

export type AgentContextMode = "full" | "task" | "scoped";
export type AgentRunStatus = "active" | "awaiting-confirm" | "done" | "closed";

/** A spawned parallel agent / subagent node (depth-tagged, from the bridge tree). */
export interface AgentTreeNode {
  id: string;
  parentId: string | null;
  label: string;
  cwd?: string;
  contextMode?: AgentContextMode;
  surface: string | null;
  /** cmux workspace ref — REQUIRED alongside surface for any pane-targeted action
   * (steer/confirm). Surface numbers are only unique within a workspace. */
  workspace?: string | null;
  /** Human workspace name from cmux (e.g. "🦷 opportunity-architecture"), display-only. */
  workspaceLabel?: string;
  /** "pi", "claude", "codex", etc. Only "pi" supports the rich RPC chat attach
   * (3.8-full) — other runtimes use a different session protocol entirely. */
  runtime?: string;
  status: AgentRunStatus;
  depth: number;
  spawnedAt?: number;
  /** One-line "what it's doing" summary for the row (Phase 2: pane-tail capture). */
  activitySummary?: string;
  /** Finished / needs-input and not yet peeked — drives the unread dot. */
  unread?: boolean;
  /** Agent is asking a real question (routes to "Needs you"). */
  needsInput?: boolean;
  /** Agent stalled or errored, distinct from needsInput (routes to "Needs you"). */
  needsAttention?: boolean;
  /** "+42 -18" diff summary chip; presence promotes a done agent to "Ready for review". */
  diffStat?: { added: number; removed: number };
}

/** Live peek sheet state: the on-demand terminal tail for one agent row. */
export interface AgentPeek {
  agentId: string;
  text: string | null;
  loading: boolean;
}

export interface DirEntry {
  name: string;
  path: string;
}

/** A directory listing for the workspace folder browser. */
export interface DirListing {
  path: string;
  parent: string | null;
  home: string;
  /** The bridge's current workspace cwd, so the picker can mark it. */
  cwd: string;
  entries: DirEntry[];
}

export type Theme = "light" | "dark" | "console";

export interface BridgeSnapshot {
  connected: boolean;
  connectionPhase: ConnectionPhase;
  streaming: boolean;
  statusError: string | null;
  view: MobileView;
  theme: Theme;
  /** Prompts typed while the agent is streaming; auto-sent on turn end (FIFO). */
  queuedMessages: string[];
  /** Current git branch of the active workspace, null if not a repo. */
  gitBranch: string | null;
  /** Full-text search hits; null when not searching. */
  searchResults: SessionHit[] | null;
  /** Spawned parallel/subagents (depth-tagged tree) for the nested picker. */
  agents: AgentTreeNode[];
  /** Terminal tail for the currently open agent peek sheet, null when closed. */
  peek: AgentPeek | null;
  /** Current folder-browser listing, null until the workspace picker loads one. */
  dirListing: DirListing | null;
  /** The agent currently attached for the rich chat view ("agent-chat"), if any. */
  attachedAgentId: string | null;
  attachedAgentLabel: string | null;
  attachedAgentLines: ChatLine[];
  attachedAgentStreaming: boolean;
  sessions: PiSession[];
  activeSessionName: string | null;
  activeSessionPath: string | null;
  sessionInfo: string | null;
  lines: ChatLine[];
  activeModel: PiModel | null;
  allModels: PiModel[];
  recentModels: PiModel[];
  stats: SessionStats | null;
  mode: SendMode;
  thinkingLevel: ThinkingLevel;
  commands: PiCommand[];
  cmdPickerOpen: boolean;
  cmdFilter: string;
  cmdSelectedIdx: number;
  extensionDialog: ExtensionDialogState | null;
  notificationsEnabled: boolean;
  /** Images attached but not yet sent (thumbnail + mimeType only — the base64
   * payload stays private to the bridge until send). */
  pendingImages: { preview: string; mimeType: string }[];
}
