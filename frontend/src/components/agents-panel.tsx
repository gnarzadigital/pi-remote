import { Boxes, Check, ChevronRight, Plus, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { CollapsibleSectionHeader } from "@/components/collapsible-section-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { canAttachChat } from "@/lib/agent-runtime";
import type { AgentContextMode, AgentRunStatus, AgentTreeNode } from "@/lib/types";
import { cn, hapticTap } from "@/lib/utils";

const MODE_LABELS: Record<AgentContextMode, string> = { task: "Task", scoped: "Scoped", full: "Full" };
const MODE_ORDER: AgentContextMode[] = ["task", "scoped", "full"];

function StatusDot({ status }: { status: AgentRunStatus }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "active" && "animate-pulse bg-emerald-500",
        status === "awaiting-confirm" && "bg-amber-500",
        (status === "done" || status === "closed") && "bg-concrete"
      )}
    />
  );
}

export function AgentsPanel() {
  const { snapshot, bridge } = usePiBridge();
  const [collapsed, setCollapsed] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<AgentContextMode>("task");
  const [steerFor, setSteerFor] = useState<string | null>(null);
  const [steerText, setSteerText] = useState("");

  const agents = snapshot.agents.filter((a) => a.status !== "closed");

  // Poll status while the section is open and there are live agents.
  useEffect(() => {
    if (collapsed || agents.length === 0) return;
    const t = window.setInterval(() => bridge.listAgents(), 5000);
    return () => window.clearInterval(t);
  }, [collapsed, agents.length, bridge]);

  const doSpawn = () => {
    if (!task.trim()) return;
    hapticTap();
    bridge.spawnAgent({ task: task.trim(), contextMode: mode });
    setTask("");
    setMode("task");
    setSpawnOpen(false);
  };

  const doSteer = (agent: AgentTreeNode) => {
    if (!agent.surface || !steerText.trim()) return;
    hapticTap();
    bridge.steerAgent(agent.surface, steerText.trim(), agent.workspace);
    setSteerText("");
    setSteerFor(null);
  };

  return (
    <section className="session-folder mb-1 border-b border-hairline pb-1">
      <div className="flex items-center justify-between pr-2">
        <div className="min-w-0 flex-1">
          <CollapsibleSectionHeader
            label="Agents"
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
            iconCollapsed={Boxes}
            iconExpanded={Boxes}
            badge={agents.length || undefined}
          />
        </div>
        <button
          type="button"
          aria-label="Spawn agent"
          className="inline-flex size-7 items-center justify-center rounded-full text-concrete hover:bg-mist hover:text-graphite"
          onClick={() => {
            hapticTap();
            setSpawnOpen(true);
          }}
        >
          <Plus className="size-4" />
        </button>
      </div>

      {snapshot.statusError && (
        <p className="px-2 pb-1 text-[11px] text-rose-600 dark:text-rose-400">{snapshot.statusError}</p>
      )}

      {!collapsed && (
        <div className="pb-1 pl-1">
          {agents.length === 0 ? (
            <p className="session-list-meta px-2 py-1.5 text-concrete">No agents running</p>
          ) : (
            agents.map((agent) => (
              <div key={agent.id}>
                <div
                  className="flex items-center gap-2 rounded-[8px] px-2 py-2"
                  style={{ paddingLeft: `${8 + agent.depth * 16}px` }}
                >
                  {agent.depth > 0 && <ChevronRight className="size-3 shrink-0 text-concrete" />}
                  <StatusDot status={agent.status} />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                    onClick={() => {
                      hapticTap();
                      if (canAttachChat(agent.runtime)) {
                        bridge.attachToAgent(agent);
                      } else {
                        // claude/codex/etc can't attach a rich pi-RPC chat — the
                        // one thing that DOES work for any runtime is steer.
                        setSteerFor(steerFor === agent.id ? null : agent.id);
                      }
                    }}
                  >
                    <span className="w-full truncate text-[13px] text-graphite">{agent.label}</span>
                    {agent.workspaceLabel && (
                      <span className="w-full truncate text-[11px] text-concrete">{agent.workspaceLabel}</span>
                    )}
                  </button>
                  {agent.contextMode && (
                    <span className="shrink-0 rounded-full border border-hairline px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-concrete">
                      {MODE_LABELS[agent.contextMode]}
                    </span>
                  )}
                  {agent.surface && (
                    <button
                      type="button"
                      aria-label="Steer agent"
                      className="shrink-0 text-concrete hover:text-graphite"
                      onClick={() => setSteerFor(steerFor === agent.id ? null : agent.id)}
                    >
                      <Send className="size-3.5" />
                    </button>
                  )}
                  {agent.status === "awaiting-confirm" && agent.surface && (
                    <button
                      type="button"
                      aria-label="Confirm and close agent"
                      className="shrink-0 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                      onClick={() => {
                        hapticTap();
                        bridge.confirmAgent(agent.surface!, agent.workspace);
                      }}
                    >
                      <Check className="size-4" />
                    </button>
                  )}
                </div>
                {steerFor === agent.id && (
                  <div className="mb-1 flex items-center gap-2 px-2" style={{ paddingLeft: `${8 + agent.depth * 16}px` }}>
                    <input
                      type="text"
                      value={steerText}
                      onChange={(e) => setSteerText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doSteer(agent)}
                      placeholder="Send a message…"
                      aria-label="Message to agent"
                      className="min-w-0 flex-1 rounded-[8px] border border-hairline bg-mist px-2 py-1.5 text-[13px] text-graphite outline-none placeholder:text-concrete"
                    />
                    <Button size="sm" onClick={() => doSteer(agent)}>
                      Send
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={spawnOpen} onOpenChange={setSpawnOpen}>
        <DialogContent className="max-w-sm gap-4">
          <DialogTitle>Spawn agent</DialogTitle>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="What should this agent do?"
            aria-label="Agent task"
            rows={3}
            className="w-full rounded-[10px] border border-hairline bg-mist px-3 py-2 text-[14px] text-graphite outline-none placeholder:text-concrete"
          />
          <div>
            <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-concrete">Context handoff</p>
            <div className="grid grid-cols-3 gap-2">
              {MODE_ORDER.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-[10px] border px-2 py-2 text-[13px] font-medium",
                    mode === m
                      ? "border-graphite bg-graphite text-chalk"
                      : "border-hairline bg-chalk text-graphite hover:bg-mist"
                  )}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-concrete">
              {mode === "task"
                ? "Fresh session with just this task."
                : mode === "scoped"
                  ? "Task plus a compacted summary of this session."
                  : "Inherits the full orchestrator context."}
            </p>
          </div>
          <Button onClick={doSpawn} disabled={!task.trim()}>
            Spawn into cmux pane
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
