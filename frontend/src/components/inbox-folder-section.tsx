import { Mailbox, Inbox } from "lucide-react";
import { CollapsibleSectionHeader } from "@/components/collapsible-section-header";
import { SessionListRow } from "@/components/session-list-row";
import { filterUnread } from "@/lib/session-read-state";
import type { PiSession } from "@/lib/types";

type Props = {
  sessions: PiSession[];
  collapsed: boolean;
  activeSessionPath: string | null;
  pinnedPaths: Set<string>;
  onToggleCollapse: () => void;
  onSelect: (session: PiSession) => void;
  onTogglePin: (session: PiSession) => void;
  onArchive: (session: PiSession) => void;
  onRename?: (session: PiSession) => void;
};

export function InboxFolderSection({
  sessions,
  collapsed,
  activeSessionPath,
  pinnedPaths,
  onToggleCollapse,
  onSelect,
  onTogglePin,
  onArchive,
  onRename,
}: Props) {
  const unread = filterUnread(sessions);
  const count = unread.length;

  return (
    <section className="session-folder mb-1">
      <CollapsibleSectionHeader
        label="Inbox"
        collapsed={collapsed}
        onToggle={onToggleCollapse}
        iconCollapsed={Mailbox}
        iconExpanded={Inbox}
        badge={count}
      />

      {!collapsed ? (
        <div className="pb-1 pl-1">
          {unread.length === 0 ? (
            <p className="session-list-meta px-2 py-2 text-concrete">You&apos;re all caught up</p>
          ) : (
            unread.map((session) => (
              <SessionListRow
                key={session.path}
                session={session}
                active={session.path === activeSessionPath}
                pinned={pinnedPaths.has(session.path)}
                unread
                foreign={session.isCurrentWorkspace === false}
                onSelect={onSelect}
                onTogglePin={onTogglePin}
                onArchive={onArchive}
                onRename={onRename}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
