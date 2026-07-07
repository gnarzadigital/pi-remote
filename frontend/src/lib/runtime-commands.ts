import type { PiCommand } from "@/lib/types";

/**
 * Slash commands for TERMINAL-runtime agents steered remotely via cmux send
 * (agent-terminal-view). pi agents get their live command list from the RPC
 * snapshot instead. Lists are verified from primary sources on this machine:
 * claude = Claude Code built-ins; codex = strings extracted from the installed
 * @openai/codex native binary; hermes = grep of ~/.hermes/hermes-agent/cli.py
 * command dispatch. Custom per-user skills (also slash-invokable in claude/
 * codex) are intentionally not enumerated here.
 */
export const RUNTIME_COMMANDS: Record<string, PiCommand[]> = {
  claude: [
    { name: "clear", description: "Clear conversation history" },
    { name: "compact", description: "Compact conversation context" },
    { name: "model", description: "Change the model" },
    { name: "resume", description: "Resume a previous session" },
    { name: "agents", description: "Manage subagents" },
    { name: "status", description: "Show session status" },
    { name: "cost", description: "Show token cost for this session" },
    { name: "usage", description: "Show plan usage limits" },
    { name: "memory", description: "Edit memory files" },
    { name: "permissions", description: "View or update permissions" },
    { name: "mcp", description: "Manage MCP servers" },
    { name: "review", description: "Review current changes" },
    { name: "todos", description: "Show the task list" },
    { name: "export", description: "Export the conversation" },
    { name: "rewind", description: "Rewind to an earlier point" },
    { name: "help", description: "Show help" },
  ],
  codex: [
    { name: "model", description: "Change the model" },
    { name: "compact", description: "Compact conversation context" },
    { name: "review", description: "Review current changes" },
    { name: "diff", description: "Show working-tree diff" },
    { name: "status", description: "Show session status" },
    { name: "resume", description: "Resume a previous session" },
    { name: "init", description: "Create AGENTS.md for this repo" },
    { name: "permissions", description: "View or update approvals" },
    { name: "skills", description: "List available skills" },
    { name: "apps", description: "Manage connected apps" },
  ],
  hermes: [
    { name: "new", description: "Start a new conversation" },
    { name: "clear", description: "Clear conversation" },
    { name: "compress", description: "Compress conversation context" },
    { name: "reset", description: "Reset the session" },
    { name: "resume", description: "Resume a previous session" },
    { name: "steer", description: "Steer the current run" },
    { name: "queue", description: "Queue a message" },
    { name: "undo", description: "Undo last turn" },
    { name: "fast", description: "Toggle fast mode" },
    { name: "skills", description: "Search / manage skills" },
    { name: "browser", description: "Browser controls" },
    { name: "insights", description: "Show session insights" },
    { name: "billing", description: "Show billing info" },
    { name: "reload-mcp", description: "Reload MCP servers" },
    { name: "reload-skills", description: "Reload skills" },
  ],
};

/** Command list for an agent's runtime. pi = the live RPC command list the
 * primary session already fetched; unknown runtimes get none (no picker). */
export function commandsForRuntime(
  runtime: string | undefined,
  piCommands: PiCommand[]
): PiCommand[] {
  if (runtime === "pi") return piCommands;
  return RUNTIME_COMMANDS[runtime ?? ""] ?? [];
}
