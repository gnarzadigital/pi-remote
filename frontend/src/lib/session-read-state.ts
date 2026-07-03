import type { PiSession } from "@/lib/types";

const READ_STATE_KEY = "pi-remote-read-state";
const FORCED_UNREAD_KEY = "pi-remote-forced-unread";
const BASELINE_KEY = "pi-remote-read-baseline-v1";

type ReadState = Record<string, number>;

const listeners = new Set<() => void>();

// Monotonic revision counter — increments on every write, used as the
// useSyncExternalStore snapshot so React sees a stable value between writes.
let revision = 0;

function emit() {
  listeners.forEach((fn) => fn());
}

// Cached reads — invalidated only when we write.
let cachedReadState: ReadState | null = null;
let cachedForcedUnread: Set<string> | null = null;

function loadState(): ReadState {
  if (cachedReadState) return cachedReadState;
  try {
    const raw = localStorage.getItem(READ_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    cachedReadState = parsed as ReadState;
    return cachedReadState;
  } catch {
    return {};
  }
}

function saveState(state: ReadState) {
  cachedReadState = state;
  localStorage.setItem(READ_STATE_KEY, JSON.stringify(state));
  revision++;
  emit();
}

function loadForcedUnread(): Set<string> {
  if (cachedForcedUnread) return cachedForcedUnread;
  try {
    const raw = localStorage.getItem(FORCED_UNREAD_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    const set = new Set(Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : []);
    cachedForcedUnread = set;
    return set;
  } catch {
    return new Set();
  }
}

function saveForcedUnread(set: Set<string>) {
  cachedForcedUnread = set;
  localStorage.setItem(FORCED_UNREAD_KEY, JSON.stringify([...set]));
  revision++;
  emit();
}

export function subscribeReadState(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Returns the current revision counter — stable between writes. */
export function getReadStateRevision(): number {
  return revision;
}

export function getLastReadAt(path: string): number {
  return loadState()[path] ?? 0;
}

/** First launch: treat all existing sessions as already read. */
export function ensureReadBaseline(sessions: PiSession[]) {
  if (localStorage.getItem(BASELINE_KEY)) return;
  const state = loadState();
  for (const session of sessions) {
    if (state[session.path] == null) {
      state[session.path] = session.mtime;
    }
  }
  saveState(state);
  localStorage.setItem(BASELINE_KEY, "1");
}

export function markSessionRead(path: string, at?: number) {
  const forced = loadForcedUnread();
  forced.delete(path);
  saveForcedUnread(forced);

  const state = loadState();
  state[path] = at ?? Date.now();
  saveState(state);
}

/** Agent finished while away from chat, or push received. */
export function markSessionUnread(path: string) {
  const forced = loadForcedUnread();
  forced.add(path);
  saveForcedUnread(forced);
}

export function isSessionUnread(session: PiSession): boolean {
  // Unread = "an agent finished / pushed while you were away" (forced-unread set),
  // NOT "the file changed". mtime bumps on every background agent write and floods
  // the list with false unreads. Forced-unread is set on agent-finish-while-away
  // and manual mark-unread; cleared on read. See markSessionUnread callers.
  return loadForcedUnread().has(session.path);
}

export function countUnread(sessions: PiSession[]): number {
  return sessions.filter(isSessionUnread).length;
}

export function filterUnread(sessions: PiSession[]): PiSession[] {
  return sessions.filter(isSessionUnread).sort((a, b) => b.mtime - a.mtime);
}
