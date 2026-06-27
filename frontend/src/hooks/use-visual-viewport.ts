import { useEffect } from "react";

/** Keeps the app shell aligned with iOS visual viewport when the keyboard opens. */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      const keyboardOpen = window.innerHeight - vv.height > 80;
      document.documentElement.style.setProperty("--app-height", `${vv.height}px`);
      document.documentElement.style.setProperty("--vv-offset-top", `${vv.offsetTop}px`);
      document.documentElement.classList.toggle("keyboard-open", keyboardOpen);
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
      document.documentElement.style.removeProperty("--app-height");
      document.documentElement.style.removeProperty("--vv-offset-top");
      document.documentElement.classList.remove("keyboard-open");
    };
  }, []);
}
