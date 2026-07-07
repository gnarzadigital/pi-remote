import type { ChatLine } from "@/lib/types";

export function findLastUserLineId(lines: ChatLine[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].kind === "user") return lines[i].id;
  }
  return null;
}

/**
 * Baseline for the "new user message" scroll-to-top tracker when a session switch
 * lands. Without re-baselining, switching to a session whose last line already is
 * a user turn (in-flight, or a session left mid-exchange) gets misread as a brand
 * new user message on the very first render, fighting the reconnect/session-load
 * scroll-to-bottom effect for control of the viewport.
 */
export function sessionSwitchScrollBaseline(lines: ChatLine[]): {
  lineCount: number;
  lastUserId: string | null;
} {
  const lastLine = lines[lines.length - 1];
  return {
    lineCount: lines.length,
    lastUserId: lastLine?.kind === "user" ? lastLine.id : null,
  };
}

/** Place a transcript line near the top of the scroll viewport (shadcn #4, #11). */
export function scrollLineToViewportStart(
  scrollRoot: HTMLElement,
  lineId: string,
  offsetPx = 12
): boolean {
  const target = scrollRoot.querySelector(`[data-line-id="${lineId}"]`);
  if (!target) return false;

  const rootRect = scrollRoot.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  scrollRoot.scrollTop += targetRect.top - rootRect.top - offsetPx;
  return true;
}
