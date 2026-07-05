/**
 * Visual layout QA — sessions + chat headers, footer gap, viewport lock.
 * Run: npx playwright test qa/visual-layout.spec.ts
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700";
const EVIDENCE = join(process.cwd(), ".validate", "evidence");

mkdirSync(EVIDENCE, { recursive: true });

test.describe("pi-remote layout", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  test("sessions header symmetric padding and no bottom gap", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (/404|Failed to load resource/i.test(text)) return;
        errors.push(text);
      }
    });

    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(EVIDENCE, "sessions-mobile.png"), fullPage: true });

    const header = page.locator(".screen-header").first();
    await expect(header).toBeVisible();

    const inner = page.locator(".screen-header-inner").first();
    const innerBox = await inner.boundingBox();
    expect(innerBox).not.toBeNull();
    const logo = page.locator(".screen-header img[alt='pi']").first();
    const logoBox = await logo.boundingBox();
    if (innerBox && logoBox) {
      const topGap = logoBox.y - innerBox.y;
      const bottomGap = innerBox.y + innerBox.height - (logoBox.y + logoBox.height);
      expect(Math.abs(topGap - bottomGap)).toBeLessThan(2);
      expect(topGap).toBeGreaterThan(8);
      expect(topGap).toBeLessThan(14);
    }

    const shell = page.locator(".app-shell");
    const shellBox = await shell.boundingBox();
    const viewport = page.viewportSize();
    if (shellBox && viewport) {
      expect(shellBox.height).toBeGreaterThan(viewport.height - 4);
    }

    expect(errors).toEqual([]);
  });

  test("chat view footer flush with viewport", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "networkidle" });

    // Open an existing session — a docked composer (.chat-bottom-dock) requires a
    // session WITH messages; a brand-new session shows the centered hero instead.
    const firstSession = page.locator("button.session-list-name").first();
    await firstSession.waitFor({ state: "visible", timeout: 5000 });
    await firstSession.click();
    await page.waitForTimeout(800);

    await page.screenshot({ path: join(EVIDENCE, "chat-mobile.png"), fullPage: false });

    // The dock is the surface that fills to the viewport bottom (canvas, no void).
    // The composer inside it is intentionally inset above the home indicator.
    const footer = page.locator(".chat-bottom-dock").first();
    await expect(footer).toBeVisible();

    const metrics = await page.evaluate(() => {
      const dock = document.querySelector(".chat-bottom-dock");
      const footer = dock ?? document.querySelector(".input-footer");
      const body = document.body;
      const footerRect = footer?.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const y = window.innerHeight - 2;
      const el = document.elementFromPoint(window.innerWidth / 2, y);
      return {
        innerHeight: window.innerHeight,
        bodyBottom: bodyRect.bottom,
        footerBottom: footerRect?.bottom ?? null,
        bottomBg: el ? getComputedStyle(el).backgroundColor : "none",
        bottomTag: el?.tagName ?? null,
        footerPb: footer ? getComputedStyle(footer).paddingBottom : null,
      };
    });

    console.log("chat footer metrics", metrics);

    const footerBox = await footer.boundingBox();
    const viewport = page.viewportSize();
    if (footerBox && viewport) {
      const gap = viewport.height - (footerBox.y + footerBox.height);
      expect(gap).toBeLessThan(3);
    }

    expect(metrics.bodyBottom).toBeGreaterThan((viewport?.height ?? 0) - 3);
    expect(metrics.footerBottom).toBeGreaterThan((viewport?.height ?? 0) - 3);

    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewportMeta).toContain("user-scalable=no");
    // interactive-widget=resizes-content must stay ABSENT: on iOS it shrinks the
    // layout viewport with the keyboard and often fails to restore, stranding the
    // fixed composer above the real bottom (hermes-webui omits it too).
    expect(viewportMeta).not.toContain("interactive-widget");
    expect(viewportMeta).toContain("viewport-fit=cover");
  });
});
