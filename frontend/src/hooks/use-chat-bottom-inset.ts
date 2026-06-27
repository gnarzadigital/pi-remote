import { useEffect, type RefObject } from "react";

/** Publishes --chat-bottom-height for scroll padding under the fixed mobile dock. */
export function useChatBottomInset(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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
  }, [ref]);
}
