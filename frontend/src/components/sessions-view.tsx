import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "@/components/settings-panel";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import {
  formatSessionName,
  formatTimeShort,
  groupSessionsByDay,
} from "@/lib/session-utils";
import { cn, hapticTap } from "@/lib/utils";

export function SessionsView() {
  const { snapshot, bridge } = usePiBridge();
  const groups = groupSessionsByDay(snapshot.sessions);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex shrink-0 items-center justify-between border-b border-hairline px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)]">
        <span className="text-sm font-semibold tracking-tight text-graphite">pi remote</span>
        <div className="flex items-center gap-1">
          <SettingsPanel />
          <Button
            size="sm"
            onClick={() => {
              hapticTap();
              bridge.newSession();
            }}
          >
            New
          </Button>
        </div>
      </header>

      <div className="border-b border-hairline px-4 py-2">
        <span className="text-[12px] text-concrete">
          {snapshot.connected ? "Connected" : "Connecting…"}
        </span>
      </div>

      <div className="sessions-scroll flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-concrete">No saved sessions</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-4">
              <h2 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-concrete">
                {group.label}
              </h2>
              <div className="overflow-hidden rounded-[14px] border border-hairline bg-card">
                {group.items.map((session, i) => {
                  const name = formatSessionName(session.name);
                  const active = session.path === snapshot.activeSessionPath;
                  return (
                    <button
                      key={session.path}
                      type="button"
                      className={cn(
                        "flex w-full min-h-[52px] items-center gap-3 px-4 py-3 text-left transition-colors active:bg-mist",
                        i > 0 && "border-t border-hairline",
                        active && "bg-mist"
                      )}
                      onClick={() => {
                        hapticTap();
                        bridge.switchSession(session);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium text-graphite">{name}</div>
                        <div className="text-[13px] text-concrete">{formatTimeShort(session.mtime)}</div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-concrete" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
