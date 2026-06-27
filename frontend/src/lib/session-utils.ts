import type { PiSession } from "@/lib/types";

export function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Cursor-style compact relative time: 3m, 6h, 1d */
export function formatRelativeTimeShort(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatSessionName(raw: string): string {
  if (!raw) return "Untitled session";
  const firstLine = raw.split("\n")[0].trim();
  if (
    !firstLine.startsWith("# HANDOFF:") &&
    !firstLine.includes("<") &&
    !firstLine.includes("/.pi/agent/") &&
    firstLine.length <= 72
  ) {
    return firstLine;
  }
  if (firstLine.startsWith("# HANDOFF:")) {
    const title = firstLine.replace(/^#\s*/, "");
    return title.length > 52 ? `${title.slice(0, 49)}…` : title;
  }
  const fileMatch = firstLine.match(/<file name=["']([^"']+)["']/);
  if (fileMatch) {
    const parts = fileMatch[1].split("/");
    return prettifySessionFilename(parts[parts.length - 1] || fileMatch[1]);
  }
  if (firstLine.includes("/.pi/agent/")) {
    const parts = firstLine.split("/");
    return prettifySessionFilename(parts[parts.length - 1]);
  }
  if (firstLine.length > 48) return `${firstLine.slice(0, 45)}…`;
  return firstLine;
}

function prettifySessionFilename(leaf: string): string {
  if (!leaf) return "Session";
  let name = leaf.replace(/\.jsonl.*$/, "");
  if (name.startsWith("--")) {
    name = name.slice(2).replace(/-/g, " ");
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length > 6) name = words.slice(-6).join(" ");
  }
  if (name.length > 48) return `${name.slice(0, 45)}…`;
  return name || "Session";
}

export type SessionGroupMode = "inbox" | "recent" | "workspace";

export type SessionGroup = {
  label: string;
  items: PiSession[];
  /** Workspace slug when grouping by workspace */
  workspaceSlug?: string;
  isCurrentWorkspace?: boolean;
};

export function workspaceSlugToLabel(slug: string): string {
  const parts = slug.replace(/^--/, "").replace(/--$/, "").split("-").filter(Boolean);
  if (parts.length === 0) return slug;
  if (parts.length >= 2) return parts.slice(-2).join("/");
  return parts[parts.length - 1] ?? slug;
}

/** Derive workspace slug + label from a pi session file path when bridge metadata is missing. */
export function parseWorkspaceFromSessionPath(path: string): { slug: string; label: string } | null {
  if (!path) return null;

  const sessionsMarker = "/.pi/agent/sessions/";
  const markerIdx = path.indexOf(sessionsMarker);
  if (markerIdx >= 0) {
    const rest = path.slice(markerIdx + sessionsMarker.length);
    const slash = rest.indexOf("/");
    if (slash > 0) {
      const slug = rest.slice(0, slash);
      return { slug, label: workspaceSlugToLabel(slug) };
    }
  }

  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const slug = segments[segments.length - 2]!;
    if (slug.startsWith("--") || slug.endsWith("--")) {
      return { slug, label: workspaceSlugToLabel(slug) };
    }
  }

  return null;
}

export function enrichSessionWorkspace(session: PiSession): PiSession {
  if (session.workspaceSlug && session.workspaceLabel) return session;
  const parsed = parseWorkspaceFromSessionPath(session.path);
  if (!parsed) return session;
  return {
    ...session,
    workspaceSlug: session.workspaceSlug ?? parsed.slug,
    workspaceLabel: session.workspaceLabel ?? parsed.label,
  };
}

export function workspaceSlugToPath(slug: string): string {
  return "/" + slug.replace(/^--/, "").replace(/--$/, "").replace(/-/g, "/");
}

export function formatWorkspaceFolderName(session: PiSession): string {
  return formatWorkspaceLabel(session);
}

export function formatWorkspaceLabel(session: PiSession): string {
  if (session.workspaceLabel) return session.workspaceLabel;
  if (session.workspaceSlug) return workspaceSlugToLabel(session.workspaceSlug);
  const parsed = parseWorkspaceFromSessionPath(session.path);
  if (parsed) return parsed.label;
  return "Workspace";
}

export function groupSessionsByDay(sessions: PiSession[]): SessionGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  const groups: SessionGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const s of sessions) {
    if (s.mtime >= today) groups[0].items.push(s);
    else if (s.mtime >= yesterday) groups[1].items.push(s);
    else if (s.mtime >= weekAgo) groups[2].items.push(s);
    else groups[3].items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function groupSessionsByWorkspace(sessions: PiSession[]): SessionGroup[] {
  const byWorkspace = new Map<string, PiSession[]>();

  for (const session of sessions) {
    const enriched = enrichSessionWorkspace(session);
    const key = enriched.workspaceSlug ?? "unknown";
    const bucket = byWorkspace.get(key);
    if (bucket) bucket.push(enriched);
    else byWorkspace.set(key, [enriched]);
  }

  const groups: SessionGroup[] = [...byWorkspace.entries()].map(([slug, items]) => {
    const sorted = [...items].sort((a, b) => b.mtime - a.mtime);
    const sample = sorted[0]!;
    return {
      label: formatWorkspaceLabel(sample),
      workspaceSlug: slug === "unknown" ? undefined : slug,
      isCurrentWorkspace: sample.isCurrentWorkspace ?? false,
      items: sorted,
    };
  });

  groups.sort((a, b) => {
    if (a.isCurrentWorkspace !== b.isCurrentWorkspace) {
      return a.isCurrentWorkspace ? -1 : 1;
    }
    const aMax = a.items[0]?.mtime ?? 0;
    const bMax = b.items[0]?.mtime ?? 0;
    return bMax - aMax;
  });

  return groups;
}

const CURSOR_FOLDER_LIMIT = 12;

/** Pinned first, then by mtime within a workspace folder. */
export function sortSessionsForFolder(
  items: PiSession[],
  pinnedPaths: Set<string>
): PiSession[] {
  return [...items].sort((a, b) => {
    const aPin = pinnedPaths.has(a.path);
    const bPin = pinnedPaths.has(b.path);
    if (aPin !== bPin) return aPin ? -1 : 1;
    return b.mtime - a.mtime;
  });
}

export function sliceFolderSessions(
  items: PiSession[],
  expanded: boolean
): { visible: PiSession[]; hiddenCount: number } {
  if (expanded || items.length <= CURSOR_FOLDER_LIMIT) {
    return { visible: items, hiddenCount: 0 };
  }
  return {
    visible: items.slice(0, CURSOR_FOLDER_LIMIT),
    hiddenCount: items.length - CURSOR_FOLDER_LIMIT,
  };
}

export function formatTimeShort(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
