/**
 * Sessions view bottom gap — must be flush with viewport (iOS PWA simulation).
 * Run: npx playwright test qa/sessions-bottom-gap.spec.ts
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700";
const EVIDENCE = join(process.cwd(), ".validate", "evidence");

mkdirSync(EVIDENCE, { recursive: true });

test.describe("sessions bottom gap", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });

  test("sessions list flush to viewport bottom", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
      const vv = window.visualViewport;
      const shell = document.querySelector(".app-shell");
      const scroll = document.querySelector(".sessions-scroll");
      const shellRect = shell?.getBoundingClientRect();
      const scrollRect = scroll?.getBoundingClientRect();
      const appHeight = getComputedStyle(document.documentElement).getPropertyValue("--app-height");
      const bodyRect = document.body.getBoundingClientRect();
      return {
        innerHeight: window.innerHeight,
        vvHeight: vv?.height ?? null,
        vvOffsetTop: vv?.offsetTop ?? null,
        appHeight,
        bodyBottom: bodyRect.bottom,
        shellBottom: shellRect?.bottom ?? null,
        scrollBottom: scrollRect?.bottom ?? null,
        htmlBg: getComputedStyle(document.documentElement).backgroundColor,
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    });

    await page.screenshot({
      path: join(EVIDENCE, "sessions-bottom-gap.png"),
      fullPage: false,
    });

    const viewport = page.viewportSize()!;
    const shell = page.locator(".app-shell");
    const shellBox = await shell.boundingBox();

    expect(shellBox).not.toBeNull();
    const gapBelowShell = viewport.height - (shellBox!.y + shellBox!.height);
    const gapBelowBody = viewport.height - metrics.bodyBottom;

    console.log("metrics", JSON.stringify({ ...metrics, gapBelowShell, gapBelowBody }, null, 2));

    // Shell must fill viewport (max 2px rounding)
    expect(gapBelowShell).toBeLessThan(3);
    expect(gapBelowBody).toBeLessThan(3);

    // Scroll region should extend to shell bottom (flex fill)
    const scroll = page.locator(".sessions-scroll");
    const scrollBox = await scroll.boundingBox();
    expect(scrollBox).not.toBeNull();
    const gapScrollToShell = shellBox!.y + shellBox!.height - (scrollBox!.y + scrollBox!.height);
    expect(Math.abs(gapScrollToShell)).toBeLessThan(4);

    // Bottom of viewport must be canvas (#0a0a0a), not pure black (#000) or a gap
    const bottomPixel = await page.evaluate(() => {
      // Effective rendered color: the topmost element may be a transparent
      // session row — walk the stack for the first opaque background behind it.
      const stack = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight - 2);
      let bg = "none";
      for (const el of stack) {
        const c = getComputedStyle(el).backgroundColor;
        if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") { bg = c; break; }
      }
      const shell = document.querySelector(".app-shell")?.getBoundingClientRect();
      return { bg, shellBottom: shell?.bottom ?? 0, innerHeight: window.innerHeight };
    });
    console.log("bottomPixel", bottomPixel);
    expect(bottomPixel.shellBottom).toBeGreaterThan(bottomPixel.innerHeight - 3);
    expect(bottomPixel.bg).toBe("rgb(10, 10, 10)");
  });
});
