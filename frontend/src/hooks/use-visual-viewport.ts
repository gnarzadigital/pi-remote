import { useEffect } from "react";

function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.id === "msg-input" ||
    el.closest(".input-footer") != null ||
    el.closest("[data-keyboard-aware]") != null
  );
}

function isInputObscured(): boolean {
  const input = document.getElementById("msg-input");
  const vv = window.visualViewport;
  if (!input || !vv) return false;
  const rect = input.getBoundingClientRect();
  const visibleBottom = vv.offsetTop + vv.height;
  return rect.bottom > visibleBottom - 4;
}

/** Keeps the app shell aligned with the iOS visual viewport when the keyboard opens. */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let syncTimers: number[] = [];

    const clearSyncTimers = () => {
      for (const id of syncTimers) window.clearTimeout(id);
      syncTimers = [];
    };

    const sync = () => {
      const layoutH = window.innerHeight;
      const visibleH = Math.round(vv.height);
      const top = Math.round(vv.offsetTop);
      const inset = layoutH - visibleH - top;
      const keyboardByViewport = inset > 50 || top > 0;
      const keyboardOpen = keyboardByViewport || (isTextInputFocused() && isInputObscured());

      if (keyboardOpen) {
        const bottomInset = Math.max(0, layoutH - visibleH - top);
        document.documentElement.style.setProperty("--vv-offset-top", `${top}px`);
        document.documentElement.style.setProperty("--vv-offset-bottom", "0px");
        document.documentElement.style.setProperty("--app-visible-height", `${visibleH}px`);
        document.documentElement.style.setProperty("--keyboard-inset-bottom", `${bottomInset}px`);
      } else {
        document.documentElement.style.setProperty("--vv-offset-top", "0px");
        document.documentElement.style.setProperty("--vv-offset-bottom", "0px");
        document.documentElement.style.removeProperty("--app-visible-height");
        document.documentElement.style.setProperty("--keyboard-inset-bottom", "0px");
        if (top > 0) window.scrollTo(0, 0);
      }

      document.documentElement.classList.toggle("keyboard-open", keyboardOpen);
    };

    const deferredSync = () => {
      clearSyncTimers();
      sync();
      for (const ms of [50, 150, 350]) {
        syncTimers.push(window.setTimeout(sync, ms));
      }
    };

    sync();
    vv.addEventListener("resize", deferredSync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", deferredSync);
    window.addEventListener("resize", deferredSync);
    document.addEventListener("focusin", deferredSync);
    const focusoutHandler = () => {
      clearSyncTimers();
      syncTimers.push(window.setTimeout(sync, 120));
    };
    document.addEventListener("focusout", focusoutHandler);

    return () => {
      clearSyncTimers();
      vv.removeEventListener("resize", deferredSync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", deferredSync);
      window.removeEventListener("resize", deferredSync);
      document.removeEventListener("focusin", deferredSync);
      document.removeEventListener("focusout", focusoutHandler);
      document.documentElement.style.removeProperty("--vv-offset-top");
      document.documentElement.style.removeProperty("--vv-offset-bottom");
      document.documentElement.style.removeProperty("--app-visible-height");
      document.documentElement.style.removeProperty("--keyboard-inset-bottom");
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);
}
