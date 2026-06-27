import type { ConnectionPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABELS: Record<ConnectionPhase, string> = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
};

type Props = {
  phase: ConnectionPhase;
  className?: string;
};

/** Status indicator: green connected, yellow connecting, red disconnected. */
export function ConnectionDot({ phase, className }: Props) {
  return (
    <span
      role="status"
      aria-label={LABELS[phase]}
      className={cn(
        "inline-block size-[7px] shrink-0 rounded-full",
        phase === "connected" && "bg-emerald-500",
        phase === "connecting" && "animate-pulse bg-amber-400",
        phase === "disconnected" && "bg-red-500",
        className
      )}
    />
  );
}
