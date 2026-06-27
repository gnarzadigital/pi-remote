import type { SessionGroupMode } from "@/lib/session-utils";
import { cn, hapticTap } from "@/lib/utils";

const MODES: { id: SessionGroupMode; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "recent", label: "Recent" },
  { id: "workspace", label: "Workspace" },
];

export function SessionGroupToggle({
  value,
  onChange,
  unreadCount = 0,
}: {
  value: SessionGroupMode;
  onChange: (mode: SessionGroupMode) => void;
  unreadCount?: number;
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-hairline px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Group sessions by"
    >
      {MODES.map((mode) => {
        const active = value === mode.id;
        const showBadge = mode.id === "inbox" && unreadCount > 0;
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
              active
                ? "bg-graphite text-chalk"
                : "text-concrete hover:bg-mist hover:text-graphite"
            )}
            onClick={() => {
              hapticTap();
              onChange(mode.id);
            }}
          >
            {mode.label}
            {showBadge ? (
              <span
                className={cn(
                  "inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-[18px]",
                  active ? "bg-chalk/20 text-chalk" : "bg-sky-500 text-white"
                )}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
