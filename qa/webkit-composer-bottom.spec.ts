/**
 * Real-WebKit ground truth for the composer's bottom position (iPhone-shaped
 * viewport, actual `env(safe-area-inset-bottom)` support — not Chromium's fake
 * emulation). Run: npx playwright test qa/webkit-composer-bottom.spec.ts --project=webkit
 */
import { test, expect, devices } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700";
const EVIDENCE = join(process.cwd(), ".validate", "evidence");
mkdirSync(EVIDENCE, { recursive: true });

test.use({ ...devices["iPhone 15"], colorScheme: "dark" });

test("composer sits flush at the bottom on a real iPhone viewport (WebKit)", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // Open a saved chat session (reliable, no attach round-trip) — same fixed
  // .chat-bottom-dock / composer classes as the agent-chat view.
  await page.locator("button.session-list-name").first().click();
  await page.waitForTimeout(1200);

  await page.screenshot({ path: join(EVIDENCE, "webkit-iphone-composer.png"), fullPage: false });

  const metrics = await page.evaluate(() => {
    const dock = document.querySelector(".chat-bottom-dock");
    const box = dock?.querySelector('div[class*="rounded-"]');
    const dr = dock?.getBoundingClientRect();
    const br = box?.getBoundingClientRect();
    return {
      innerHeight: window.innerHeight,
      safeAreaBottomVar: getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom"),
      dockPaddingBottom: dock ? getComputedStyle(dock).paddingBottom : null,
      dockBottomGap: dr ? Math.round(window.innerHeight - dr.bottom) : null,
      composerBoxBottomGap: br ? Math.round(window.innerHeight - br.bottom) : null,
      composerFullyOnscreen: br ? br.bottom <= window.innerHeight && br.bottom > 0 : null,
    };
  });
  console.log("webkit iphone composer metrics", metrics);

  expect(metrics.dockBottomGap).toBeLessThanOrEqual(2);
  expect(metrics.composerFullyOnscreen).toBe(true);
  // A small margin (not literal 0, not a fat bar) — matches the intended ~16px.
  expect(metrics.composerBoxBottomGap).toBeGreaterThan(4);
  expect(metrics.composerBoxBottomGap).toBeLessThan(28);
});
