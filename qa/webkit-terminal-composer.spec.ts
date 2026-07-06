/**
 * Real-WebKit ground truth for the TERMINAL-agent overlay (AgentTerminalView),
 * the view that regressed the bottom black bar. iPhone-shaped WebKit viewport
 * with real env(safe-area-inset-bottom). Mirrors webkit-composer-bottom.spec.ts
 * but drives a live claude/codex/hermes agent row instead of a pi chat.
 * Run: npx playwright test qa/webkit-terminal-composer.spec.ts
 */
import { test, expect, devices } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700";
const EVIDENCE = join(process.cwd(), ".validate", "evidence");
mkdirSync(EVIDENCE, { recursive: true });

test.use({ ...devices["iPhone 15"], colorScheme: "dark" });

test("terminal-agent overlay composer sits flush at the bottom (WebKit iPhone)", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Target the runtime BADGE span, whose full text is exactly the runtime label
  // (chat titles that merely mention "claude" won't have a span == "claude").
  // Its parent <button> is the agent row that opens the AgentTerminalView overlay.
  const badge = page
    .locator("button span")
    .filter({ hasText: /^(claude|codex|hermes|cursor|agy|agent)$/ })
    .first();
  await badge.waitFor({ state: "visible", timeout: 15000 });
  await badge.click(); // bubbles to the row button's onClick
  await page.waitForTimeout(1400);

  // Confirm the terminal overlay mounted: "Agents" back button + a mono <pre>.
  await expect(page.getByText("Agents", { exact: true })).toBeVisible();
  const dock = page.locator(".chat-bottom-dock");
  await expect(dock).toBeVisible();

  await page.screenshot({ path: join(EVIDENCE, "webkit-terminal-composer.png"), fullPage: false });

  // Root-cause proof: the overlay must be portaled to <body>, NOT nested inside
  // .sessions-scroll (an overflow container) — that nesting is what floated the
  // composer above the home indicator on real iOS.
  const placement = await page.evaluate(() => {
    const root = document.querySelector(".chat-view-root.fixed");
    return {
      parentIsBody: root?.parentElement === document.body,
      insideSessionsScroll: !!root?.closest(".sessions-scroll"),
    };
  });
  console.log("terminal overlay placement", placement);
  expect(placement.parentIsBody).toBe(true);
  expect(placement.insideSessionsScroll).toBe(false);

  const metrics = await page.evaluate(() => {
    const dock = document.querySelector(".chat-bottom-dock");
    const box = dock?.querySelector('div[class*="rounded-"]');
    const input = dock?.querySelector("input");
    const pre = document.querySelector("pre.chat-scroll-zone");
    const dr = dock?.getBoundingClientRect();
    const br = box?.getBoundingClientRect();
    return {
      innerHeight: window.innerHeight,
      safeAreaBottomVar: getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom"),
      dockBottomGap: dr ? Math.round(window.innerHeight - dr.bottom) : null,
      composerBoxBottomGap: br ? Math.round(window.innerHeight - br.bottom) : null,
      composerFullyOnscreen: br ? br.bottom <= window.innerHeight && br.bottom > 0 : null,
      inputFontPx: input ? parseFloat(getComputedStyle(input).fontSize) : null,
      preExists: !!pre,
      prePaddingBottomPx: pre ? parseFloat(getComputedStyle(pre).paddingBottom) : null,
    };
  });
  console.log("webkit terminal composer metrics", metrics);

  expect(metrics.dockBottomGap).toBeLessThanOrEqual(2); // dock flush to true viewport bottom
  expect(metrics.composerFullyOnscreen).toBe(true);
  expect(metrics.composerBoxBottomGap).toBeGreaterThan(4); // small intentional lift, not literal 0
  expect(metrics.composerBoxBottomGap).toBeLessThan(28); // NOT a fat black bar
  expect(metrics.inputFontPx).toBeGreaterThanOrEqual(16); // 16px kills iOS focus-zoom
  expect(metrics.preExists).toBe(true); // scroll zone class present
  expect(metrics.prePaddingBottomPx ?? 0).toBeGreaterThan(20); // reserves room under fixed dock
});
