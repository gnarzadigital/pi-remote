import { Archive, ArchiveRestore, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConnectionDot } from "@/components/connection-dot";
import { PiLogo } from "@/components/pi-logo";
import { ScreenHeader } from "@/components/screen-header";
import { SessionRenameSheet } from "@/components/session-rename-sheet";
import { WorkspaceFolderSection } from "@/components/workspace-folder-section";
import { AgentInbox } from "@/components/agent-inbox";
import { SpawnAgentDialog } from "@/components/spawn-agent-dialog";
import { WorkspacePicker } from "@/components/workspace-picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatSessionName, groupSessionsByWorkspace } from "@/lib/session-utils";
import type { PiSession } from "@/lib/types";
import { applyTextScale, getTextScale } from "@/lib/text-size";
import { hapticTap } from "@/lib/utils";

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
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

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

  // Search is a live IN-PLACE filter over the inbox (F33), not a mode that hides
  // the agents. Chats filter by name here; agents filter inside AgentInbox.
  const q = search.trim().toLowerCase();

  const visibleSessions = useMemo(() => {
    const archivedSet = new Set(getArchivedPaths());
    let list = snapshot.sessions.filter((s) =>
      showArchived ? archivedSet.has(s.path) : !archivedSet.has(s.path)
    );
    if (q) list = list.filter((s) => formatSessionName(s.name).toLowerCase().includes(q));
    return list;
  }, [snapshot.sessions, showArchived, listRevision, q]);

  const groups = useMemo(
    () => groupSessionsByWorkspace(visibleSessions),
    [visibleSessions]
  );

  const archivedCount = useMemo(() => getArchivedPaths().length, [listRevision, snapshot.sessions]);
  const hasLiveAgents = snapshot.agents.some((a) => a.status !== "closed");

  const handleSelect = (session: PiSession) => {
    hapticTap();
    if (session.isCurrentWorkspace === false) setHint(null);
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
          {/* Build marker: shows which build loaded on-device. Tap to toggle the
              standalone geometry diagnostic overlay (DiagOverlay). */}
          <button
            type="button"
            onClick={() => {
              const next = localStorage.getItem("pi-diag") === "1" ? "0" : "1";
              localStorage.setItem("pi-diag", next);
              window.dispatchEvent(new Event("pi-diag-toggle"));
            }}
            className="text-[10px] tabular-nums text-concrete opacity-50"
          >
            v22
          </button>
        </div>
        <div className="flex items-center gap-1">
          <SettingsPanel />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" aria-label="New">
                <Plus className="size-4" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem
                onSelect={() => {
                  hapticTap();
                  bridge.newSession();
                }}
              >
                New chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  hapticTap();
                  setFolderPickerOpen(true);
                }}
              >
                New chat in folder…
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  hapticTap();
                  setSpawnOpen(true);
                }}
              >
                Spawn agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ScreenHeader>

      <div className="shrink-0 border-b border-hairline px-3 py-2">
        <div className="flex items-center gap-2 rounded-[10px] border border-hairline bg-mist px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-concrete" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter agents and chats"
            aria-label="Filter agents and chats"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-graphite outline-none placeholder:text-concrete"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear filter"
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
        {!showArchived && <AgentInbox query={search} />}

        {!showArchived && hasLiveAgents && !q && groups.length > 0 ? (
          <div className="px-2 pb-1 pt-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-concrete">Recent chats</span>
          </div>
        ) : null}

        {groups.length === 0 ? (
          <p className="session-list-meta px-3 py-8 text-center text-concrete">
            {showArchived ? "No archived sessions" : q ? "No matches" : "No sessions"}
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
      </div>

      <SpawnAgentDialog open={spawnOpen} onOpenChange={setSpawnOpen} />
      <WorkspacePicker open={folderPickerOpen} onOpenChange={setFolderPickerOpen} />

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
