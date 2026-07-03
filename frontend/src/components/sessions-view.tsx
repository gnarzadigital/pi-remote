import { Archive, ArchiveRestore } from "lucide-react";
import { ConnectionDot } from "@/components/connection-dot";
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
import { isSessionUnread } from "@/lib/session-read-state";
import {
  expandWorkspace,
  getExpandedWorkspaces,
  isWorkspaceCollapsed,
  toggleWorkspaceCollapsed,
} from "@/lib/session-list-state";
import {
  formatSessionName,
  groupSessionsByWorkspace,
} from "@/lib/session-utils";
import type { PiSession } from "@/lib/types";
import { applyTextScale, getTextScale } from "@/lib/text-size";
import { hapticTap } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

/** Wrap case-insensitive matches of `q` in `text` with a subtle highlight. */
function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  for (;;) {
    const idx = lower.indexOf(ql, i);
    if (idx < 0) {
      out.push(text.slice(i));
      break;
    }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark key={key++} className="rounded bg-mist font-semibold text-graphite">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    i = idx + q.length;
  }
  return out;
}

export function SessionsView() {
  const { snapshot, bridge } = usePiBridge();
  useReadState();
  const [listRevision, setListRevision] = useState(0);
  const [, setCollapseRevision] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState(getExpandedWorkspaces);
  const [hint, setHint] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<PiSession | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => bridge.searchSessions(search), 250);
    return () => window.clearTimeout(t);
  }, [search, bridge]);

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

  const groups = useMemo(
    () => groupSessionsByWorkspace(visibleSessions),
    [visibleSessions]
  );

  const archivedCount = useMemo(() => getArchivedPaths().length, [listRevision, snapshot.sessions]);

  const handleSelect = (session: PiSession) => {
    hapticTap();
    if (session.isCurrentWorkspace === false) {
      setHint(null);
    }
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
    const group = groups.find((g) => (g.workspaceSlug ?? g.label) === slug);
    toggleWorkspaceCollapsed(slug, group?.isCurrentWorkspace ?? false);
    setCollapseRevision((n) => n + 1);
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

      <div className="shrink-0 border-b border-hairline px-3 py-2">
        <div className="flex items-center gap-2 rounded-[10px] border border-hairline bg-mist px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-concrete" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions"
            aria-label="Search sessions"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-graphite outline-none placeholder:text-concrete"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              className="shrink-0 text-concrete hover:text-graphite"
              onClick={() => setSearch("")}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {hint ? (
        <div className="shrink-0 border-b border-hairline bg-mist px-3 py-2 text-[12px] text-graphite">
          {hint}
        </div>
      ) : null}

      <div className="sessions-scroll session-cursor-list min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas py-2">
        {snapshot.searchResults !== null ? (
          snapshot.searchResults.length === 0 ? (
            <p className="session-list-meta px-3 py-8 text-center text-concrete">No matches</p>
          ) : (
            <div className="px-1">
              {snapshot.searchResults.map((hit) => (
                <button
                  key={hit.path}
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 rounded-[8px] px-2 py-2 text-left hover:bg-mist"
                  onClick={() => handleSelect(hit)}
                >
                  <span className="w-full truncate text-[13px] text-graphite">
                    {highlight(formatSessionName(hit.name), search)}
                  </span>
                  {hit.snippet ? (
                    <span className="line-clamp-2 w-full text-[12px] text-concrete">
                      {highlight(hit.snippet, search)}
                    </span>
                  ) : null}
                  {hit.workspaceLabel ? (
                    <span className="text-[11px] text-concrete">{hit.workspaceLabel}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            {groups.length === 0 ? (
              <p className="session-list-meta px-3 py-8 text-center text-concrete">
                {showArchived ? "No archived sessions" : "No sessions"}
              </p>
            ) : (
              groups.map((group) => (
                <WorkspaceFolderSection
                  key={group.workspaceSlug ?? group.label}
                  group={group}
                  collapsed={isWorkspaceCollapsed(
                    group.workspaceSlug ?? group.label,
                    group.isCurrentWorkspace ?? false
                  )}
                  expanded={expandedFolders.has(group.workspaceSlug ?? group.label)}
                  activeSessionPath={snapshot.activeSessionPath}
                  pinnedPaths={pinnedPaths}
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
          </>
        )}
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
