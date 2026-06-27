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

export function formatSessionName(raw: string): string {
  if (!raw) return "Untitled session";
  const firstLine = raw.split("\n")[0].trim();
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

export function groupSessionsByDay(sessions: { name: string; path: string; mtime: number }[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  const groups: { label: string; items: typeof sessions }[] = [
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

export function formatTimeShort(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
