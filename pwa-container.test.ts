import { expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression guard for the multi-day iOS standalone-container saga (2026-07-06).
 * Apple's "installed standalone app" WKWebView mode is the root cause of three
 * separate iOS-only bugs hit in this app: position:fixed breaking after a
 * viewport recalc, 100dvh mismeasuring, and window.innerHeight silently
 * diverging from window.screen.height. Hermes WebUI (~/.hermes/hermes-agent/web)
 * never enters that mode — no manifest link, no apple-mobile-web-app-capable —
 * and has never hit any of these bugs. Fixed by matching Hermes exactly
 * (index.html + manifest.json). If either regresses, the WKWebView container
 * bugs return with it. Never re-add apple-mobile-web-app-capable or flip
 * manifest.json's display back to "standalone" without re-litigating this.
 */

const indexHtml = readFileSync(join(import.meta.dir, "frontend/index.html"), "utf8");
const manifest = JSON.parse(readFileSync(join(import.meta.dir, "frontend/public/manifest.json"), "utf8"));

test("index.html never re-adds apple-mobile-web-app-capable", () => {
  // Match the actual <meta> tag, not this test file's own explanatory prose
  // (which references the tag name by name and would false-positive on a plain
  // string search).
  expect(indexHtml).not.toMatch(/<meta\s+name=["']apple-mobile-web-app-capable["']/);
});

test("index.html keeps viewport-fit=cover (required for env(safe-area-inset-*))", () => {
  expect(indexHtml).toContain("viewport-fit=cover");
});

test("manifest.json display is not standalone/fullscreen", () => {
  expect(["standalone", "fullscreen"]).not.toContain(manifest.display);
});
