import { FileDiff } from "lucide-react";
import { useState } from "react";
import { diffStat, lineDiff, parseEditArgs } from "@/lib/diff-parse";
import { cn } from "@/lib/utils";

/** Inline diff for pi `edit`/`write` tool calls — collapsed with a +/- summary. */
export function DiffView({ name, args }: { name: string; args?: string }) {
  const [open, setOpen] = useState(false);
  const parsed = parseEditArgs(args);
  if (!parsed) return null; // caller falls back to the generic tool card

  const lines = lineDiff(parsed.oldText, parsed.newText);
  const { added, removed } = diffStat(lines);
  const label = parsed.path ? parsed.path.split("/").pop() : name;

  return (
    <div className="overflow-hidden rounded-[10px] border border-hairline bg-mist">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <FileDiff className="size-3.5 shrink-0 text-concrete" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-graphite">{label}</span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums">
          <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>{" "}
          <span className="text-rose-600 dark:text-rose-400">-{removed}</span>
        </span>
      </button>
      {open && (
        <div className="max-h-[50vh] overflow-auto border-t border-hairline">
          <pre className="min-w-full font-mono text-[11px] leading-[1.5]">
            {lines.map((l, i) => (
              <div
                key={i}
                className={cn(
                  "whitespace-pre px-3",
                  l.type === "add" && "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                  l.type === "del" && "bg-rose-500/10 text-rose-800 dark:text-rose-200",
                  l.type === "ctx" && "text-concrete"
                )}
              >
                <span className="select-none opacity-60">
                  {l.type === "add" ? "+" : l.type === "del" ? "-" : " "}{" "}
                </span>
                {l.text || " "}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
