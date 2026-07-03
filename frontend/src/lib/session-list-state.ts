const COLLAPSED_KEY = "pi-remote-collapsed-workspaces";
const OPENED_KEY = "pi-remote-opened-workspaces";
const EXPANDED_KEY = "pi-remote-expanded-workspaces";

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : []);
  } catch {
    return new Set();
  }
}

export function getCollapsedWorkspaces(): Set<string> {
  return loadSet(COLLAPSED_KEY);
}

export function getOpenedWorkspaces(): Set<string> {
  return loadSet(OPENED_KEY);
}

/**
 * Effective collapse state. Default: only the current workspace is open; every
 * other workspace is a collapsed folder row. Explicit user toggles win over the
 * default (opened/collapsed sets), so a project you open stays open.
 */
export function isWorkspaceCollapsed(slug: string, isCurrent: boolean): boolean {
  if (getCollapsedWorkspaces().has(slug)) return true;
  if (getOpenedWorkspaces().has(slug)) return false;
  return !isCurrent;
}

/** Toggle a workspace's collapse state, recording the explicit choice. */
export function toggleWorkspaceCollapsed(slug: string, isCurrent: boolean): void {
  const collapsed = getCollapsedWorkspaces();
  const opened = getOpenedWorkspaces();
  if (isWorkspaceCollapsed(slug, isCurrent)) {
    collapsed.delete(slug);
    opened.add(slug);
  } else {
    opened.delete(slug);
    collapsed.add(slug);
  }
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  localStorage.setItem(OPENED_KEY, JSON.stringify([...opened]));
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
