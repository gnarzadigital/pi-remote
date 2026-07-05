import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import type { AgentContextMode } from "@/lib/types";
import { cn, hapticTap } from "@/lib/utils";

const MODE_LABELS: Record<AgentContextMode, string> = { task: "Task", scoped: "Scoped", full: "Full" };
const MODE_ORDER: AgentContextMode[] = ["task", "scoped", "full"];

/** Spawn a new parallel agent into a cmux pane. The context-mode picker lives
 * HERE (spawn time), never on an inbox row — the row should read as a status,
 * not a config surface. */
export function SpawnAgentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { bridge } = usePiBridge();
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<AgentContextMode>("task");

  const doSpawn = () => {
    if (!task.trim()) return;
    hapticTap();
    bridge.spawnAgent({ task: task.trim(), contextMode: mode });
    setTask("");
    setMode("task");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  );
}
