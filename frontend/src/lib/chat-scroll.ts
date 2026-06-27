import type { ChatLine } from "@/lib/types";

export function findLastUserLineId(lines: ChatLine[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].kind === "user") return lines[i].id;
  }
  return null;
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
