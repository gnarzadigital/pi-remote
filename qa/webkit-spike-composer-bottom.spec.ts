/**
 * Real-WebKit ground truth for the spike/assistant-ui-shell composer
 * (spike/assistant-ui-shell branch). Mirrors qa/webkit-composer-bottom.spec.ts
 * but targets ?spike=1's assistant-ui Thread composer, which uses
 * `position: sticky` (ThreadPrimitive.ViewportFooter) rather than the
 * production dock's flex-last-child pattern — this spec proves whether that
 * different mechanism also avoids the iOS gap bug, or whether it needs the
 * same intervention.
 * Run: npx playwright test qa/webkit-spike-composer-bottom.spec.ts --project=webkit
 *
 * KNOWN LIMITATION: this sends a real message to whatever session the bridge
 * currently has active, shared with any other live user/test hitting the same
 * bridge — can be flaky if run concurrently with other suites touching the
 * same session (observed once in a full-suite run, passed in isolation and on
 * retry). Spike-scoped acceptable risk; a hardened version would create a
 * dedicated throwaway session first.
 */
import { test, expect, devices } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700";
const EVIDENCE = join(process.cwd(), ".validate", "evidence");
mkdirSync(EVIDENCE, { recursive: true });

test.use({ ...devices["iPhone 15"], colorScheme: "dark" });

test("spike composer sits flush at the bottom on a real iPhone viewport (WebKit)", async ({ page }) => {
  await page.goto(`${BASE}/?spike=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const composerInput = page.locator('textarea[placeholder="Send a message..."]');
  await expect(composerInput).toBeVisible({ timeout: 8000 });

  // The empty/welcome state (no messages yet) centers the composer — same
  // pattern as pi-remote's own NewSessionHero. That's expected, not a bug.
  // The geometry claim only applies once a real conversation exists, so send
  // one real message through the live bridge first.
  await composerInput.fill("pwd");
  await composerInput.press("Enter");
  await page.waitForTimeout(1500); // let the turn start streaming

  await page.screenshot({ path: join(EVIDENCE, "webkit-spike-composer.png"), fullPage: false });

  const metrics = await page.evaluate(() => {
    const input = document.querySelector('textarea[placeholder="Send a message..."]');
    const footer = input?.closest("[data-slot], form, div"); // ViewportFooter wrapper, whatever it resolves to
    const footerRect = footer?.getBoundingClientRect();
    return {
      innerHeight: window.innerHeight,
      footerBottom: footerRect ? Math.round(footerRect.bottom) : null,
      footerGap: footerRect ? Math.round(window.innerHeight - footerRect.bottom) : null,
      inputFontPx: input ? parseFloat(getComputedStyle(input).fontSize) : null,
    };
  });
  console.log("webkit spike composer metrics", metrics);

  expect(metrics.footerGap).not.toBeNull();
  // Proven live (real message sent, real streaming reply): gap measures 16px —
  // a small intentional lift, not the ~230px float the old position:fixed bug
  // produced. Bound matches the same convention as the other webkit specs.
  expect(metrics.footerGap!).toBeLessThanOrEqual(28);
  expect(metrics.footerGap!).toBeGreaterThanOrEqual(0); // never floats ABOVE the true bottom
  expect(metrics.inputFontPx).toBeGreaterThanOrEqual(16); // kills iOS focus-zoom
});
