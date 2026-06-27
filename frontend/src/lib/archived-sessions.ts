const ARCHIVED_KEY = "pi-remote-archived-sessions";

export function getArchivedPaths(): string[] {
  try {
    const raw = localStorage.getItem(ARCHIVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function isArchived(path: string): boolean {
  return getArchivedPaths().includes(path);
}

/** Toggle archive; returns true if now archived. */
export function toggleArchive(path: string): boolean {
  const archived = getArchivedPaths();
  const next = archived.includes(path)
    ? archived.filter((p) => p !== path)
    : [...archived, path];
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify(next));
  return next.includes(path);
}

export function subscribeArchived(_fn: () => void) {
  return () => {};
}
