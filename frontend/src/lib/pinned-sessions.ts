const PINNED_KEY = "pi-remote-pinned-sessions";

export function getPinnedPaths(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function isPinned(path: string): boolean {
  return getPinnedPaths().includes(path);
}

/** Toggle pin; returns true if now pinned. */
export function togglePin(path: string): boolean {
  const pinned = getPinnedPaths();
  const next = pinned.includes(path)
    ? pinned.filter((p) => p !== path)
    : [path, ...pinned];
  localStorage.setItem(PINNED_KEY, JSON.stringify(next));
  return next.includes(path);
}

export function sortWithPinsFirst<T extends { path: string }>(items: T[]): T[] {
  const pinned = new Set(getPinnedPaths());
  return [...items].sort((a, b) => {
    const aPin = pinned.has(a.path);
    const bPin = pinned.has(b.path);
    if (aPin !== bPin) return aPin ? -1 : 1;
    return 0;
  });
}
