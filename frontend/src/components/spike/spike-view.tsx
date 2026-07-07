import { ChevronLeft } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { SpikeThread } from "@/components/spike/spike-thread";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { hapticTap } from "@/lib/utils";

/**
 * Spike page wrapper. Reuses chat-view.tsx's exact `chat-view-root` height-
 * bounding pattern (h-full flex column, driven by pi-remote's --app-height
 * system) so assistant-ui's Thread renders inside a correctly-bounded box.
 * Thread manages its own internal scroll viewport + sticky composer (NOT
 * `.chat-bottom-dock` — see spike-thread.tsx for why: Thread's composer uses
 * `position: sticky`, not `fixed`, a different mechanism than the one that
 * caused the iOS bug this app already fixed).
 */
export function SpikeView() {
  const { bridge } = usePiBridge();

  return (
    <div className="chat-view-root flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-canvas">
      <ScreenHeader innerClassName="gap-2">
        <button
          type="button"
          className="inline-flex min-h-[44px] shrink-0 items-center text-[14px] text-graphite hover:opacity-70"
          onClick={() => {
            hapticTap();
            bridge.setView("sessions");
          }}
        >
          <ChevronLeft className="size-4" />
          <span>Sessions</span>
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-[14px] font-medium text-graphite">
          assistant-ui spike
        </span>
      </ScreenHeader>
      <div className="min-h-0 flex-1">
        <SpikeThread />
      </div>
    </div>
  );
}
