/** Fit-to-width for terminal captures. cmux capture-pane returns lines
 * hard-wrapped at the PANE's column width (often ~45 cols in a split), which
 * at a fixed 11px mono fills only part of a phone screen. Scale the font so
 * the longest captured line spans the container — like a real terminal viewer. */

export const TERMINAL_FONT_DEFAULT_PX = 11;
export const TERMINAL_FONT_MIN_PX = 8;
export const TERMINAL_FONT_MAX_PX = 16;
/** Width of one mono character relative to font-size; measured at runtime,
 * this is the fallback for ui-monospace stacks. */
export const MONO_CH_RATIO_FALLBACK = 0.602;

export function maxLineLength(text: string): number {
  let max = 0;
  for (const line of text.split("\n")) {
    const len = line.trimEnd().length;
    if (len > max) max = len;
  }
  return max;
}

/**
 * Fitted font-size in px. Only fits genuine terminal-layout captures
 * (10..100 columns); reflowed paragraph text (very long lines, wraps anyway)
 * and trivial captures keep the default. `scale` is the user's terminal
 * text-size preference, applied in both modes.
 */
export function fitTerminalFontPx(
  maxLen: number,
  containerWidth: number,
  chRatio: number = MONO_CH_RATIO_FALLBACK,
  scale: number = 1,
  fit: boolean = true
): number {
  const base = TERMINAL_FONT_DEFAULT_PX * scale;
  if (!fit || maxLen < 10 || maxLen > 100 || containerWidth <= 0) {
    return clamp(base, TERMINAL_FONT_MIN_PX, TERMINAL_FONT_MAX_PX);
  }
  const fitted = (containerWidth / (maxLen * chRatio)) * scale;
  return clamp(fitted, TERMINAL_FONT_MIN_PX, TERMINAL_FONT_MAX_PX);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Measured width-per-font-size ratio of the element's actual mono font. */
export function measureChRatio(el: HTMLElement): number {
  try {
    const style = getComputedStyle(el);
    const fontPx = parseFloat(style.fontSize);
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx || !fontPx) return MONO_CH_RATIO_FALLBACK;
    ctx.font = `${style.fontSize} ${style.fontFamily}`;
    const ratio = ctx.measureText("0".repeat(100)).width / 100 / fontPx;
    return ratio > 0.3 && ratio < 1.2 ? ratio : MONO_CH_RATIO_FALLBACK;
  } catch {
    return MONO_CH_RATIO_FALLBACK;
  }
}
