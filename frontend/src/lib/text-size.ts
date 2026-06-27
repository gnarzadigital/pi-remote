export const TEXT_SCALE_KEY = "pi-remote-text-scale";
export const TEXT_SCALE_MIN = 0.85;
export const TEXT_SCALE_MAX = 1.35;
export const TEXT_SCALE_DEFAULT = 1;
export const TEXT_SCALE_STEP = 0.05;

export function clampTextScale(value: number): number {
  const n = Number.isFinite(value) ? value : TEXT_SCALE_DEFAULT;
  const stepped = Math.round(n / TEXT_SCALE_STEP) * TEXT_SCALE_STEP;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, stepped));
}

export function getTextScale(): number {
  try {
    const raw = localStorage.getItem(TEXT_SCALE_KEY);
    if (raw == null) return TEXT_SCALE_DEFAULT;
    return clampTextScale(parseFloat(raw));
  } catch {
    return TEXT_SCALE_DEFAULT;
  }
}

const SESSION_LIST_SCALE_SELECTOR = ".session-cursor-list, .session-list-preview";

export function applyTextScale(scale: number): number {
  const clamped = clampTextScale(scale);
  document.querySelectorAll(SESSION_LIST_SCALE_SELECTOR).forEach((el) => {
    (el as HTMLElement).style.setProperty("--session-list-text-scale", String(clamped));
  });
  return clamped;
}

export function setTextScale(scale: number): number {
  const clamped = clampTextScale(scale);
  try {
    localStorage.setItem(TEXT_SCALE_KEY, String(clamped));
  } catch {
    // ignore quota / private mode
  }
  applyTextScale(clamped);
  window.dispatchEvent(new CustomEvent("session-list-text-scale", { detail: clamped }));
  return clamped;
}

export function formatTextScalePercent(scale: number): string {
  return `${Math.round(clampTextScale(scale) * 100)}%`;
}
