import { FolderClosed, FolderOpen } from "lucide-react";
import { CollapsibleSectionHeader } from "@/components/collapsible-section-header";
import { SessionListRow } from "@/components/session-list-row";
import {
  formatWorkspaceLabel,
  sliceFolderSessions,
  sortSessionsForFolder,
  type SessionGroup,
} from "@/lib/session-utils";
import type { PiSession } from "@/lib/types";
import { hapticTap } from "@/lib/utils";

type Props = {
  group: SessionGroup;
  collapsed: boolean;
  expanded: boolean;
  activeSessionPath: string | null;
  pinnedPaths: Set<string>;
  onToggleCollapse: (slug: string) => void;
  onShowMore: (slug: string) => void;
  onSelect: (session: PiSession) => void;
  onTogglePin: (session: PiSession) => void;
  onArchive: (session: PiSession) => void;
  onRename?: (session: PiSession) => void;
  isUnread: (session: PiSession) => boolean;
  /** Hide sessions that appear in the inbox unread list */
  excludePaths?: Set<string>;
};

export function WorkspaceFolderSection({
  group,
  collapsed,
  expanded,
  activeSessionPath,
  pinnedPaths,
  onToggleCollapse,
  onShowMore,
  onSelect,
  onTogglePin,
  onArchive,
  onRename,
  isUnread,
  excludePaths,
}: Props) {
  const slug = group.workspaceSlug ?? group.label;
  const folderName = group.label || (group.items[0] ? formatWorkspaceLabel(group.items[0]) : "Workspace");

  const items = excludePaths
    ? group.items.filter((s) => !excludePaths.has(s.path))
    : group.items;

  const sorted = sortSessionsForFolder(items, pinnedPaths);
  const { visible, hiddenCount } = sliceFolderSessions(sorted, expanded);

  if (items.length === 0) return null;

  return (
    <section className="session-folder mb-1">
      <CollapsibleSectionHeader
        label={folderName}
        collapsed={collapsed}
        onToggle={() => onToggleCollapse(slug)}
        iconCollapsed={FolderClosed}
        iconExpanded={FolderOpen}
      />

      {!collapsed ? (
        <div className="pb-1 pl-1">
          {visible.map((session) => (
            <SessionListRow
              key={session.path}
              session={session}
              active={session.path === activeSessionPath}
              pinned={pinnedPaths.has(session.path)}
              unread={isUnread(session)}
              foreign={session.isCurrentWorkspace === false}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onArchive={onArchive}
              onRename={onRename}
            />
          ))}
          {hiddenCount > 0 ? (
            <button
              type="button"
              className="w-full min-h-[44px] px-2 py-2.5 text-left text-[12px] text-concrete hover:text-graphite"
              onClick={() => {
                hapticTap();
                onShowMore(slug);
              }}
            >
              More
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
