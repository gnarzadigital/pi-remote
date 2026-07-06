import { useEffect, useState } from "react";

/** TEMP standalone-geometry readout. Toggle by tapping the header build marker.
 * Reads REAL device metrics so a single standalone screenshot pins the composer
 * bug that Playwright-WebKit / Safari-in-sim can't reproduce. Remove after diag. */
export function DiagOverlay() {
  const [on, setOn] = useState(() => localStorage.getItem("pi-diag") !== "0"); // TEMP: default ON for standalone diag
  const [text, setText] = useState("");

  useEffect(() => {
    const sync = () => setOn(localStorage.getItem("pi-diag") === "1");
    window.addEventListener("pi-diag-toggle", sync);
    return () => window.removeEventListener("pi-diag-toggle", sync);
  }, []);

  useEffect(() => {
    if (!on) return;
    const read = () => {
      const root = document.documentElement;
      const dock = document.querySelector(".chat-bottom-dock");
      const r = dock?.getBoundingClientRect();
      const cs = dock ? getComputedStyle(dock) : null;
      const vv = window.visualViewport;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const standalone = (navigator as any).standalone;
      setText(
        [
          `standalone=${standalone} dispMode=${matchMedia("(display-mode: standalone)").matches}`,
          `innerH=${window.innerHeight} vvH=${Math.round(vv?.height ?? 0)} vvTop=${Math.round(vv?.offsetTop ?? 0)}`,
          `dockBot=${r ? Math.round(r.bottom) : "-"} gapBelow=${r ? Math.round(window.innerHeight - r.bottom) : "-"}`,
          `dock pos=${cs?.position} bottom=${cs?.bottom} pb=${cs?.paddingBottom}`,
          `kbInset=${root.style.getPropertyValue("--keyboard-inset-bottom") || "unset"} safeBot=${getComputedStyle(root).getPropertyValue("--safe-bottom").trim()} kbOpen=${root.classList.contains("keyboard-open")}`,
        ].join("\n"),
      );
    };
    read();
    const t = window.setInterval(read, 400);
    return () => window.clearInterval(t);
  }, [on]);

  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] whitespace-pre-wrap bg-rose-600 px-2 py-1 font-mono text-[10px] leading-tight text-white">
      {text}
    </div>
  );
}
