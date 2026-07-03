import { usePiBridge } from "@/hooks/use-pi-bridge";
import {
  formatTokenCount,
  getContextUsedTokens,
  getModelContextWindowTokens,
} from "@/lib/message-utils";

/** Compact context-window visualizer: used / max tokens as a bar + cost. */
export function ContextMeter() {
  const { snapshot } = usePiBridge();
  const max = getModelContextWindowTokens(
    (snapshot.activeModel ?? null) as Record<string, unknown> | null
  );
  const used = getContextUsedTokens(snapshot.stats);
  if (used == null || max == null || max <= 0) return null;

  const pct = Math.min(100, Math.round((used / max) * 100));
  const cost = snapshot.stats?.cost;

  return (
    <div className="px-2 py-1.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-concrete">Context</span>
        <span className="tabular-nums text-graphite">
          {formatTokenCount(used)} / {formatTokenCount(max)} · {pct}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-mist">
        <div
          className="h-full rounded-full bg-graphite"
          style={{ width: `${pct}%`, opacity: pct >= 90 ? 1 : 0.85 }}
        />
      </div>
      {typeof cost === "number" && cost > 0 && (
        <div className="mt-1 text-right text-[11px] tabular-nums text-concrete">
          ${cost.toFixed(3)}
        </div>
      )}
    </div>
  );
}
