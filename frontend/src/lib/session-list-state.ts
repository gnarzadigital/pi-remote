const COLLAPSED_KEY = "pi-remote-collapsed-workspaces";
const EXPANDED_KEY = "pi-remote-expanded-workspaces";
const INBOX_COLLAPSED_KEY = "pi-remote-inbox-collapsed";

export function getInboxCollapsed(): boolean {
  return localStorage.getItem(INBOX_COLLAPSED_KEY) === "true";
}

export function toggleInboxCollapsed(): boolean {
  const next = !getInboxCollapsed();
  localStorage.setItem(INBOX_COLLAPSED_KEY, String(next));
  return next;
}

export function getCollapsedWorkspaces(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : []);
  } catch {
    return new Set();
  }
}

export function toggleWorkspaceCollapsed(slug: string): boolean {
  const set = getCollapsedWorkspaces();
  if (set.has(slug)) set.delete(slug);
  else set.add(slug);
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
  return set.has(slug);
}

export function getExpandedWorkspaces(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : []);
  } catch {
    return new Set();
  }
}

export function expandWorkspace(slug: string) {
  const set = getExpandedWorkspaces();
  set.add(slug);
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...set]));
}

export function isWorkspaceExpanded(slug: string): boolean {
  return getExpandedWorkspaces().has(slug);
}
