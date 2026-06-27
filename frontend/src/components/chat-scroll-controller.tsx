import { usePiBridge } from "@/hooks/use-pi-bridge";
import { findLastUserLineId, scrollLineToViewportStart } from "@/lib/chat-scroll";
import { useEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

/**
 * Scroll engineering for streaming chat (shadcn scroll principles).
 * @see https://x.com/shadcn/status/2070394918720221522
 */
export function ChatScrollController() {
  const { snapshot } = usePiBridge();
  const { scrollRef, stopScroll, isAtBottom } = useStickToBottomContext();
  const prevLineCount = useRef(0);
  const prevSessionPath = useRef<string | null | undefined>(undefined);
  const prevLastUserId = useRef<string | null>(null);
  const resumeAtUserTurn = useRef(true);

  useEffect(() => {
    if (prevSessionPath.current !== snapshot.activeSessionPath) {
      prevSessionPath.current = snapshot.activeSessionPath;
      resumeAtUserTurn.current = true;
      prevLastUserId.current = null;
    }
  }, [snapshot.activeSessionPath]);

  // Session load / reconnect: open at last user message (#11), not bottom.
  useEffect(() => {
    if (!resumeAtUserTurn.current || snapshot.lines.length === 0) return;

    const lastUserId = findLastUserLineId(snapshot.lines);
    if (!lastUserId) return;

    resumeAtUserTurn.current = false;
    stopScroll();
    requestAnimationFrame(() => {
      const root = scrollRef.current;
      if (root) scrollLineToViewportStart(root, lastUserId);
    });
  }, [snapshot.lines, scrollRef, stopScroll]);

  // New user message: start turn near top of viewport (#4, #6).
  useEffect(() => {
    const lastLine = snapshot.lines[snapshot.lines.length - 1];
    const grew = snapshot.lines.length > prevLineCount.current;
    prevLineCount.current = snapshot.lines.length;

    if (!grew || lastLine?.kind !== "user") return;
    if (lastLine.id === prevLastUserId.current) return;
    prevLastUserId.current = lastLine.id;

    stopScroll();
    requestAnimationFrame(() => {
      const root = scrollRef.current;
      if (root) scrollLineToViewportStart(root, lastLine.id);
    });
  }, [snapshot.lines, scrollRef, stopScroll]);

  // Interactions are intent — stop programmatic follow (#3).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const onLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a[href]")) stopScroll();
    };

    root.addEventListener("click", onLinkClick, true);
    return () => root.removeEventListener("click", onLinkClick, true);
  }, [scrollRef, stopScroll]);

  useEffect(() => {
    const input = document.getElementById("msg-input");
    if (!input) return;

    const onFocus = () => stopScroll();
    input.addEventListener("focus", onFocus);
    return () => input.removeEventListener("focus", onFocus);
  }, [stopScroll]);

  const offViewStreaming =
    snapshot.streaming && !isAtBottom ? "Assistant is still responding" : "";

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {offViewStreaming}
    </div>
  );
}
