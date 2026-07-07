/** Mobile UI preferences beyond the session-list scale (which keeps its own
 * lib/text-size.ts mechanism): chat text scale, terminal text scale, and the
 * terminal fit-to-width toggle. Persisted in localStorage, applied as CSS
 * vars on :root (chat) and read directly by agent-terminal-view (terminal). */

export const UI_PREFS_KEY = "pi-remote-ui-prefs";
export const UI_SCALE_MIN = 0.85;
export const UI_SCALE_MAX = 1.4;
export const UI_SCALE_STEP = 0.05;

export interface UiPrefs {
  chatScale: number;
  terminalScale: number;
  terminalFit: boolean;
}

export const UI_PREFS_DEFAULT: UiPrefs = {
  chatScale: 1,
  terminalScale: 1,
  terminalFit: true,
};

export function clampUiScale(value: number): number {
  const n = Number.isFinite(value) ? value : 1;
  // round to 2 decimals — n/step*step accumulates float error (0.9000000000000001)
  const stepped = Math.round(Math.round(n / UI_SCALE_STEP) * UI_SCALE_STEP * 100) / 100;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, stepped));
}

export function normalizeUiPrefs(raw: unknown): UiPrefs {
  const o = (raw ?? {}) as Partial<Record<keyof UiPrefs, unknown>>;
  return {
    chatScale: clampUiScale(typeof o.chatScale === "number" ? o.chatScale : 1),
    terminalScale: clampUiScale(typeof o.terminalScale === "number" ? o.terminalScale : 1),
    terminalFit: typeof o.terminalFit === "boolean" ? o.terminalFit : true,
  };
}

export function getUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (raw == null) return { ...UI_PREFS_DEFAULT };
    return normalizeUiPrefs(JSON.parse(raw));
  } catch {
    return { ...UI_PREFS_DEFAULT };
  }
}

export function applyUiPrefs(prefs: UiPrefs): void {
  document.documentElement.style.setProperty("--chat-text-scale", String(prefs.chatScale));
}

export function setUiPrefs(patch: Partial<UiPrefs>): UiPrefs {
  const next = normalizeUiPrefs({ ...getUiPrefs(), ...patch });
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
  applyUiPrefs(next);
  window.dispatchEvent(new CustomEvent("pi-remote-ui-prefs", { detail: next }));
  return next;
}
