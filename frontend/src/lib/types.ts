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
  status: AgentRunStatus;
  depth: number;
  spawnedAt?: number;
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
}
