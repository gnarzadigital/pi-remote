import { Archive, ArchiveRestore } from "lucide-react";
import { ConnectionDot } from "@/components/connection-dot";
import { InboxFolderSection } from "@/components/inbox-folder-section";
import { PiLogo } from "@/components/pi-logo";
import { ScreenHeader } from "@/components/screen-header";
import { SessionRenameSheet } from "@/components/session-rename-sheet";
import { WorkspaceFolderSection } from "@/components/workspace-folder-section";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "@/components/settings-panel";
import { usePiBridge } from "@/hooks/use-pi-bridge";
import { useReadState } from "@/hooks/use-read-state";
import { toggleArchive, getArchivedPaths } from "@/lib/archived-sessions";
import { getPinnedPaths, togglePin } from "@/lib/pinned-sessions";
import { filterUnread, isSessionUnread } from "@/lib/session-read-state";
import {
  expandWorkspace,
  getCollapsedWorkspaces,
  getExpandedWorkspaces,
  getInboxCollapsed,
  toggleInboxCollapsed,
  toggleWorkspaceCollapsed,
} from "@/lib/session-list-state";
import {
  formatSessionName,
  groupSessionsByWorkspace,
  workspaceSlugToPath,
} from "@/lib/session-utils";
import type { PiSession } from "@/lib/types";
import { applyTextScale, getTextScale } from "@/lib/text-size";
import { hapticTap } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

export function SessionsView() {
  const { snapshot, bridge } = usePiBridge();
  useReadState();
  const [listRevision, setListRevision] = useState(0);
  const [collapsed, setCollapsed] = useState(getCollapsedWorkspaces);
  const [expandedFolders, setExpandedFolders] = useState(getExpandedWorkspaces);
  const [inboxCollapsed, setInboxCollapsed] = useState(getInboxCollapsed);
  const [hint, setHint] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<PiSession | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const pinnedPaths = useMemo(
    () => new Set(getPinnedPaths()),
    [listRevision, snapshot.sessions]
  );

  useEffect(() => {
    applyTextScale(getTextScale());
    const onScale = () => applyTextScale(getTextScale());
    window.addEventListener("session-list-text-scale", onScale);
    return () => window.removeEventListener("session-list-text-scale", onScale);
  }, []);

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [hint]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") bridge.fetchSessions();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [bridge]);

  const visibleSessions = useMemo(() => {
    const archivedSet = new Set(getArchivedPaths());
    if (showArchived) {
      return snapshot.sessions.filter((s) => archivedSet.has(s.path));
    }
    return snapshot.sessions.filter((s) => !archivedSet.has(s.path));
  }, [snapshot.sessions, showArchived, listRevision]);

  const unreadPaths = useMemo(() => {
    const unread = filterUnread(visibleSessions);
    return new Set(unread.map((s) => s.path));
  }, [visibleSessions]);

  const groups = useMemo(
    () => groupSessionsByWorkspace(visibleSessions),
    [visibleSessions]
  );

  const archivedCount = useMemo(() => getArchivedPaths().length, [listRevision, snapshot.sessions]);

  const handleSelect = (session: PiSession) => {
    hapticTap();
    if (session.isCurrentWorkspace === false) {
      const path = session.workspaceSlug
        ? workspaceSlugToPath(session.workspaceSlug)
        : "that project folder";
      setHint(`Start pi-remote from ${path}`);
      return;
    }
    setHint(null);
    bridge.switchSession(session);
  };

  const handleTogglePin = (session: PiSession) => {
    togglePin(session.path);
    setListRevision((n) => n + 1);
  };

  const handleArchive = (session: PiSession) => {
    toggleArchive(session.path);
    setListRevision((n) => n + 1);
  };

  const handleRename = (session: PiSession) => {
    if (session.isCurrentWorkspace === false) return;
    setRenameTarget(session);
  };

  const handleToggleCollapse = (slug: string) => {
    toggleWorkspaceCollapsed(slug);
    setCollapsed(new Set(getCollapsedWorkspaces()));
  };

  const handleToggleInbox = () => {
    setInboxCollapsed(toggleInboxCollapsed());
  };

  const handleShowMore = (slug: string) => {
    expandWorkspace(slug);
    setExpandedFolders(new Set(getExpandedWorkspaces()));
  };

  return (
    <div className="sessions-view-root flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-canvas">
      <ScreenHeader innerClassName="justify-between">
        <div className="flex items-center gap-1.5">
          <PiLogo size={28} />
          <ConnectionDot phase={snapshot.connectionPhase} className="self-center" />
          <span className="sr-only">pi</span>
        </div>
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
      </ScreenHeader>

      {hint ? (
        <div className="shrink-0 border-b border-hairline bg-mist px-3 py-2 text-[12px] text-graphite">
          {hint}
        </div>
      ) : null}

      <div className="sessions-scroll session-cursor-list min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas py-2">
        {!showArchived ? (
          <InboxFolderSection
            sessions={visibleSessions}
            collapsed={inboxCollapsed}
            activeSessionPath={snapshot.activeSessionPath}
            pinnedPaths={pinnedPaths}
            onToggleCollapse={handleToggleInbox}
            onSelect={handleSelect}
            onTogglePin={handleTogglePin}
            onArchive={handleArchive}
            onRename={handleRename}
          />
        ) : null}

        {groups.length === 0 && showArchived ? (
          <p className="session-list-meta px-3 py-8 text-center text-concrete">No archived sessions</p>
        ) : groups.length === 0 && !showArchived ? (
          unreadPaths.size === 0 ? (
            <p className="session-list-meta px-3 py-4 text-center text-concrete">No sessions</p>
          ) : null
        ) : (
          groups.map((group) => (
            <WorkspaceFolderSection
              key={group.workspaceSlug ?? group.label}
              group={group}
              collapsed={collapsed.has(group.workspaceSlug ?? group.label)}
              expanded={expandedFolders.has(group.workspaceSlug ?? group.label)}
              activeSessionPath={snapshot.activeSessionPath}
              pinnedPaths={pinnedPaths}
              excludePaths={showArchived ? undefined : unreadPaths}
              onToggleCollapse={handleToggleCollapse}
              onShowMore={handleShowMore}
              onSelect={handleSelect}
              onTogglePin={handleTogglePin}
              onArchive={handleArchive}
              onRename={handleRename}
              isUnread={isSessionUnread}
            />
          ))
        )}

        {archivedCount > 0 ? (
          <button
            type="button"
            className="session-list-meta mt-2 flex w-full items-center gap-1.5 px-2 py-2 text-left text-concrete hover:text-graphite"
            onClick={() => {
              hapticTap();
              setShowArchived((v) => !v);
            }}
          >
            {showArchived ? (
              <ArchiveRestore className="size-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
            ) : (
              <Archive className="size-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
            )}
            {showArchived ? "Hide archived" : `Archived (${archivedCount})`}
          </button>
        ) : null}
      </div>

      {renameTarget ? (
        <SessionRenameSheet
          open={Boolean(renameTarget)}
          initialName={formatSessionName(renameTarget.name)}
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
          onSave={(name) => {
            bridge.renameSession(renameTarget.path, name);
            setRenameTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
