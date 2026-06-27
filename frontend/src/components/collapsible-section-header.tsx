import type { LucideIcon } from "lucide-react";
import { cn, hapticTap } from "@/lib/utils";

type Props = {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  iconCollapsed: LucideIcon;
  iconExpanded: LucideIcon;
  badge?: number;
  className?: string;
};

/** Cursor-style collapsible folder / inbox header with Lucide open/close icons. */
export function CollapsibleSectionHeader({
  label,
  collapsed,
  onToggle,
  iconCollapsed,
  iconExpanded,
  badge,
  className,
}: Props) {
  const Icon = collapsed ? iconCollapsed : iconExpanded;

  return (
    <button
      type="button"
      className={cn(
        "session-folder-header flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-concrete hover:text-graphite",
        className
      )}
      onClick={() => {
        hapticTap();
        onToggle();
      }}
    >
      <Icon className="size-3.5 shrink-0 opacity-80" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge != null && badge > 0 ? (
        <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sky-600 dark:text-sky-400">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}
