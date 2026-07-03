import { useEffect, type RefObject } from "react";

/**
 * Publishes --chat-bottom-height for scroll padding under the fixed mobile dock.
 * `active` should flip when the dock element mounts/unmounts (e.g. hidden behind
 * the new-session hero) — the ref object's identity never changes, so without this
 * the effect would only ever attach once and miss a dock that mounts later.
 */
export function useChatBottomInset(ref: RefObject<HTMLElement | null>, active: boolean = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    const apply = () => {
      document.documentElement.style.setProperty("--chat-bottom-height", `${el.offsetHeight}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("resize", apply);

    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("resize", apply);
      document.documentElement.style.removeProperty("--chat-bottom-height");
    };
  }, [ref, active]);
}
