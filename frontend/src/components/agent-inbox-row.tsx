import { ChevronRight } from "lucide-react";
import { runtimeLabel } from "@/lib/agent-runtime";
import { formatRelativeTimeShort } from "@/lib/session-utils";
import type { AgentTreeNode } from "@/lib/types";
import { cn, hapticTap } from "@/lib/utils";

/** Single colored dot: color is the semantic state. Kept to one dot (no icon
 * zoo) to stay calm; process-liveness shape is a Phase 2 refinement. */
function AgentGlyph({ agent }: { agent: AgentTreeNode }) {
  const cls = agent.needsAttention
    ? "bg-rose-500"
    : agent.status === "awaiting-confirm" || agent.needsInput
      ? "bg-amber-500"
      : agent.status === "active"
        ? "animate-pulse bg-emerald-500"
        : "bg-concrete"; // done / idle
  return <span className={cn("size-2 shrink-0 rounded-full", cls)} aria-hidden />;
}

export function AgentInboxRow({
  agent,
  onOpen,
  extraInWorkspace,
}: {
  agent: AgentTreeNode;
  onOpen: (a: AgentTreeNode) => void;
  /** Other sessions in the same cmux workspace folded into this row (collapse-
   *  by-workspace setting). Shown so nothing reads as silently discarded. */
  extraInWorkspace?: number;
}) {
  const time = agent.spawnedAt ? formatRelativeTimeShort(agent.spawnedAt) : "";
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left hover:bg-[var(--session-row-hover)]"
      style={{ paddingLeft: `${8 + agent.depth * 16}px` }}
      onClick={() => {
        hapticTap();
        onOpen(agent);
      }}
    >
      {agent.depth > 0 && <ChevronRight className="size-3 shrink-0 text-concrete" aria-hidden />}
      <AgentGlyph agent={agent} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          {agent.unread ? <span className="size-1.5 shrink-0 rounded-full bg-sky-500" aria-label="unread" /> : null}
          <span className={cn("min-w-0 truncate text-[13px] text-graphite", agent.unread && "font-medium")}>
            {agent.label}
          </span>
          <span className="shrink-0 rounded-full bg-mist px-1.5 py-0.5 text-[10px] lowercase text-concrete">
            {runtimeLabel(agent.runtime)}
          </span>
          {extraInWorkspace ? (
            <span className="shrink-0 rounded-full bg-mist px-1.5 py-0.5 text-[10px] tabular-nums text-concrete">
              +{extraInWorkspace}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 truncate text-[11px] text-concrete">
          {agent.activitySummary ?? (agent.status === "awaiting-confirm" ? "awaiting confirm" : agent.workspaceLabel ?? "")}
        </span>
      </span>
      {time ? <span className="shrink-0 text-[11px] tabular-nums text-concrete">{time}</span> : null}
      <ChevronRight className="size-3.5 shrink-0 text-concrete" aria-hidden />
    </button>
  );
}
