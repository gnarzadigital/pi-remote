import { useEffect, useState } from "react";

const BUILD = "v23";

/** Collect the real device layout geometry (standalone mode, viewport heights,
 * dock position) — the exact numbers needed to diagnose composer/safe-area bugs. */
function readMetrics() {
  const root = document.documentElement;
  const dock = document.querySelector(".chat-bottom-dock");
  const r = dock?.getBoundingClientRect();
  const cs = dock ? getComputedStyle(dock) : null;
  const vv = window.visualViewport;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const standalone = (navigator as any).standalone;
  const view = document.querySelector(".chat-view-root.fixed")
    ? "terminal-overlay"
    : document.querySelector(".chat-view-root")
      ? "chat"
      : "sessions";
  return {
    build: BUILD,
    view,
    standalone: !!standalone,
    dispMode: matchMedia("(display-mode: standalone)").matches,
    innerH: window.innerHeight,
    vvH: Math.round(vv?.height ?? 0),
    vvTop: Math.round(vv?.offsetTop ?? 0),
    appH: root.style.getPropertyValue("--app-height") || "unset",
    bodyH: Math.round(document.body.getBoundingClientRect().height),
    screenH: window.screen.height,
    dockBot: r ? Math.round(r.bottom) : null,
    gapBelow: r ? Math.round(window.innerHeight - r.bottom) : null,
    dockPos: cs?.position ?? null,
    dockPb: cs?.paddingBottom ?? null,
    kbInset: root.style.getPropertyValue("--keyboard-inset-bottom") || "unset",
    safeBot: getComputedStyle(root).getPropertyValue("--safe-bottom").trim(),
    kbOpen: root.classList.contains("keyboard-open"),
    ua: navigator.userAgent.slice(0, 80),
  };
}

/** Permanent layout-regression sentinel, kept after the 2026-07-06 iOS
 * standalone-container saga. Two parts:
 * 1. Telemetry (always on): POSTs real device geometry to /api/diag on load and
 *    every 10s, so any future device-only layout bug is readable server-side
 *    from /tmp/pi-remote-diag.jsonl on the next report — no screenshot
 *    round-trips, no guessing from an emulator that can't see the real bug.
 * 2. Visual strip: off by default, toggled by tapping the header build marker,
 *    for in-the-moment debugging on the actual device. */
export function DiagOverlay() {
  const [on, setOn] = useState(() => localStorage.getItem("pi-diag") === "1");
  const [text, setText] = useState("");

  useEffect(() => {
    const sync = () => setOn(localStorage.getItem("pi-diag") === "1");
    window.addEventListener("pi-diag-toggle", sync);
    return () => window.removeEventListener("pi-diag-toggle", sync);
  }, []);

  // Telemetry: always report, independent of the visual strip.
  useEffect(() => {
    const report = () => {
      try {
        const m = readMetrics();
        void fetch("/api/diag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* never break the app for telemetry */
      }
    };
    const t0 = window.setTimeout(report, 1500); // after first paint/layout
    const t = window.setInterval(report, 10000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!on) return;
    const read = () => {
      const m = readMetrics();
      setText(
        [
          `${m.build} view=${m.view} standalone=${m.standalone} dispMode=${m.dispMode}`,
          `innerH=${m.innerH} vvH=${m.vvH} appH=${m.appH} bodyH=${m.bodyH}`,
          `dockBot=${m.dockBot ?? "-"} gapBelow=${m.gapBelow ?? "-"} pos=${m.dockPos} pb=${m.dockPb}`,
          `kbInset=${m.kbInset} safeBot=${m.safeBot} kbOpen=${m.kbOpen}`,
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
