import { FolderClosed } from "lucide-react";

/** Mini session-list preview for the text-size slider in settings. */
export function SessionListTextPreview() {
  return (
    <div
      className="session-list-preview session-cursor-list rounded-[10px] border border-hairline bg-canvas py-1"
      aria-hidden
    >
      <div className="session-folder-header flex items-center gap-1.5 px-2 py-1.5 text-concrete">
        <FolderClosed className="size-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate">opportunity/lifecycle</span>
      </div>
      <div className="session-row-slide flex items-center gap-1.5 rounded-md px-2 py-[5px]">
        <span className="size-3.5 shrink-0" />
        <span className="session-list-name min-w-0 flex-1 truncate text-graphite">
          HANDOFF: Crystal PM Opportunity Lifecycle
        </span>
        <span className="session-list-time shrink-0 tabular-nums text-concrete">3m</span>
      </div>
      <div className="session-row-slide flex items-center gap-1.5 rounded-md px-2 py-[5px]">
        <span className="size-3.5 shrink-0" />
        <span className="session-list-name min-w-0 flex-1 truncate text-graphite">pi update</span>
        <span className="session-list-time shrink-0 tabular-nums text-concrete">1h</span>
      </div>
    </div>
  );
}
