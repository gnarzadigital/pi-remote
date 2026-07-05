/**
 * iOS-like viewport: visualViewport shorter than innerHeight (home indicator / PWA gap).
 */
import { test, expect } from "@playwright/test";
import { join } from "path";

const BASE = process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700";

test.describe("sessions bottom gap — iOS viewport sim", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const inset = 34;
      const vv = window.visualViewport;
      if (!vv) return;
      const baseInner = window.innerHeight;
      Object.defineProperty(window.visualViewport, "height", {
        get: () => baseInner - inset,
        configurable: true,
      });
      Object.defineProperty(window.visualViewport, "offsetTop", {
        get: () => 0,
        configurable: true,
      });
    });
  });

  test("no black strip when vv.height < innerHeight", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    const viewport = page.viewportSize()!;
    const shellBox = await page.locator(".app-shell").boundingBox();
    expect(shellBox).not.toBeNull();

    const gap = viewport.height - (shellBox!.y + shellBox!.height);
    const metrics = await page.evaluate(() => ({
      appHeight: document.documentElement.style.getPropertyValue("--vv-offset-bottom"),
      bodyH: document.body.getBoundingClientRect().height,
      inner: window.innerHeight,
      vv: window.visualViewport?.height,
      bottomBg: (() => {
        // Effective rendered color behind any transparent row at the bottom pixel.
        const stack = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight - 2);
        for (const el of stack) {
          const c = getComputedStyle(el).backgroundColor;
          if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
        }
        return "none";
      })(),
    }));
    console.log("ios-sim", { gap, ...metrics });

    expect(gap).toBeLessThan(3);
    expect(metrics.bodyH).toBeGreaterThan(viewport.height - 3);
    expect(metrics.bottomBg).toBe("rgb(10, 10, 10)");
  });
});
