import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { PiSession } from "@/lib/types";
import { formatWorkspaceLabel, workspaceSlugToPath } from "@/lib/session-utils";
import { cn, hapticTap } from "@/lib/utils";

export type WorkspaceFilter = "all" | string;

export type WorkspaceOption = {
  slug: string;
  label: string;
  sessionCount: number;
  latestMtime: number;
  isCurrent: boolean;
};

export function deriveWorkspaces(sessions: PiSession[]): WorkspaceOption[] {
  const map = new Map<string, WorkspaceOption>();

  for (const session of sessions) {
    const slug = session.workspaceSlug ?? "unknown";
    const existing = map.get(slug);
    if (existing) {
      existing.sessionCount += 1;
      existing.latestMtime = Math.max(existing.latestMtime, session.mtime);
    } else {
      map.set(slug, {
        slug,
        label: formatWorkspaceLabel(session),
        sessionCount: 1,
        latestMtime: session.mtime,
        isCurrent: session.isCurrentWorkspace ?? false,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return b.latestMtime - a.latestMtime;
  });
}

function shortLabel(label: string, max = 22): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

type Props = {
  sessions: PiSession[];
  value: WorkspaceFilter;
  onChange: (filter: WorkspaceFilter) => void;
  onForeignSelect?: (pathHint: string) => void;
};

export function WorkspaceSwitcher({ sessions, value, onChange, onForeignSelect }: Props) {
  const [query, setQuery] = useState("");
  const workspaces = useMemo(() => deriveWorkspaces(sessions), [sessions]);

  const currentLabel =
    value === "all"
      ? "All workspaces"
      : shortLabel(workspaces.find((w) => w.slug === value)?.label ?? "Workspace");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(
      (w) =>
        w.label.toLowerCase().includes(q) ||
        w.slug.toLowerCase().includes(q)
    );
  }, [workspaces, query]);

  const pick = (slug: WorkspaceFilter, isCurrent: boolean) => {
    hapticTap();
    if (slug !== "all" && !isCurrent) {
      onForeignSelect?.(workspaceSlugToPath(slug));
    }
    onChange(slug);
    setQuery("");
  };

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 max-w-[min(200px,46vw)] gap-1 px-2 text-[13px] font-medium text-graphite"
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="size-3.5 shrink-0 text-concrete" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(320px,92vw)]">
        {workspaces.length > 6 ? (
          <div className="flex items-center gap-2 border-b border-hairline px-2 py-2">
            <Search className="size-3.5 shrink-0 text-concrete" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter workspaces…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-graphite outline-none placeholder:text-concrete"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        ) : null}

        <DropdownMenuItem
          onClick={() => pick("all", true)}
          className={cn(value === "all" && "bg-mist")}
        >
          All workspaces
          <span className="ml-auto text-[11px] text-concrete">{sessions.length}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {filtered.length === 0 ? (
          <DropdownMenuLabel className="font-normal text-concrete">No matches</DropdownMenuLabel>
        ) : (
          filtered.map((w) => (
            <DropdownMenuItem
              key={w.slug}
              onClick={() => pick(w.slug, w.isCurrent)}
              className={cn(value === w.slug && "bg-mist")}
            >
              <span className="min-w-0 flex-1 truncate">{w.label}</span>
              {w.isCurrent ? (
                <span className="ml-1 shrink-0 rounded-full bg-mist px-1.5 py-0.5 text-[10px] text-graphite">
                  live
                </span>
              ) : null}
              <span className="ml-auto shrink-0 pl-2 text-[11px] text-concrete">
                {w.sessionCount}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
