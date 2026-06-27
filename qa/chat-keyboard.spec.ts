/**
 * Chat input stays above simulated iOS keyboard (visualViewport shrink).
 */
import { test, expect } from "@playwright/test";
import { join } from "path";

const BASE = process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700";
const EVIDENCE = join(process.cwd(), ".validate", "evidence");

test.describe("chat keyboard avoidance", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });

  test("input footer stays within visible viewport when keyboard opens", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "networkidle" });

    const sessionBtn = page.getByRole("button").filter({ hasText: /HANDOFF|Session|pi update|Untitled/i }).first();
    if (await sessionBtn.count()) {
      await sessionBtn.click();
    } else {
      await page.getByRole("button", { name: "New" }).click();
    }
    await page.waitForTimeout(400);

    const input = page.locator("#msg-input");
    await input.focus();
    await page.waitForTimeout(400);

    // Simulate keyboard shrinking visual viewport (iOS behavior)
    await page.evaluate(() => {
      const keyboardH = 320;
      const inner = window.innerHeight;
      Object.defineProperty(window.visualViewport, "height", {
        get: () => inner - keyboardH,
        configurable: true,
      });
      Object.defineProperty(window.visualViewport, "offsetTop", {
        get: () => 0,
        configurable: true,
      });
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await page.waitForTimeout(400);

    const metrics = await page.evaluate(() => {
      const vv = window.visualViewport!;
      const dock = document.querySelector(".chat-bottom-dock")!.getBoundingClientRect();
      const visibleBottom = vv.offsetTop + vv.height;
      return {
        keyboardOpen: document.documentElement.classList.contains("keyboard-open"),
        visibleHeight: vv.height,
        visibleBottom,
        dockBottom: dock.bottom,
        dockTop: dock.top,
        keyboardInset: getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset-bottom"),
      };
    });

    console.log("keyboard metrics", metrics);

    await page.screenshot({ path: join(EVIDENCE, "chat-keyboard-open.png") });

    expect(metrics.keyboardOpen).toBe(true);
    expect(metrics.visibleHeight).toBeLessThan(844);
    expect(metrics.dockBottom).toBeLessThanOrEqual(metrics.visibleBottom + 2);
    expect(metrics.dockTop).toBeGreaterThan(0);
  });

  test("does not shrink viewport when input focused but keyboard dismissed", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "networkidle" });

    const sessionBtn = page.getByRole("button").filter({ hasText: /HANDOFF|Session|pi update|Untitled/i }).first();
    if (await sessionBtn.count()) await sessionBtn.click();
    else await page.getByRole("button", { name: "New" }).click();
    await page.waitForTimeout(300);

    await page.locator("#msg-input").focus();
    await page.waitForTimeout(200);

    const metrics = await page.evaluate(() => ({
      keyboardOpen: document.documentElement.classList.contains("keyboard-open"),
      bodyHeight: document.body.getBoundingClientRect().height,
      innerHeight: window.innerHeight,
      dockBottom: document.querySelector(".chat-bottom-dock")?.getBoundingClientRect().bottom ?? 0,
    }));

    console.log("focus no keyboard", metrics);

    expect(metrics.keyboardOpen).toBe(false);
    expect(metrics.bodyHeight).toBeGreaterThan(metrics.innerHeight - 4);
    expect(metrics.dockBottom).toBeGreaterThan(metrics.innerHeight - 4);
  });
});
