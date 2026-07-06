/**
 * Composer text-overflow/growth QA — real WebKit (iPhone viewport), Section 1
 * of qa/composer-keyboard-checklist.md. This is the headless-testable slice;
 * Section 2 (real keyboard interaction) has no automatable substitute — see
 * the checklist for why.
 * Run: npx playwright test qa/webkit-composer-overflow.spec.ts --project=webkit
 */
import { test, expect, devices } from "@playwright/test";

const BASE = process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700";

test.use({ ...devices["iPhone 15"], colorScheme: "dark" });

async function openChat(page: import("@playwright/test").Page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.locator("button.session-list-name").first().click();
  await page.waitForTimeout(800);
  return page.locator("#msg-input");
}

test("1.3 long unbroken string wraps, never overflows horizontally", async ({ page }) => {
  const input = await openChat(page);
  const longToken = "a".repeat(300); // no spaces — worst case for overflow-wrap
  await input.fill(longToken);
  const box = await input.boundingBox();
  const scrollWidth = await input.evaluate((el: HTMLTextAreaElement) => el.scrollWidth);
  const clientWidth = await input.evaluate((el: HTMLTextAreaElement) => el.clientWidth);
  expect(box).not.toBeNull();
  // scrollWidth should not exceed clientWidth by more than a few px (no horizontal overflow)
  expect(scrollWidth - clientWidth).toBeLessThan(5);
});

test("1.4 multi-paragraph text grows to cap then scrolls internally, no clipping", async ({ page }) => {
  const input = await openChat(page);
  const paragraph = Array.from({ length: 15 }, (_, i) => `Line ${i + 1} of a long message.`).join("\n");
  await input.fill(paragraph);
  await page.waitForTimeout(100);
  const metrics = await input.evaluate((el: HTMLTextAreaElement) => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    overflowY: getComputedStyle(el).overflowY,
  }));
  // capped at maxHeight={140} in input-area.tsx
  expect(metrics.clientHeight).toBeLessThanOrEqual(140);
  // content taller than the box — must be reachable via scroll, not clipped/hidden
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(["auto", "scroll"]).toContain(metrics.overflowY);
});

test("1.5 emoji and ZWJ sequences render without breaking the textarea", async ({ page }) => {
  const input = await openChat(page);
  const emoji = "👨‍👩‍👧‍👦 🏳️‍🌈 👍🏽 hello";
  await input.fill(emoji);
  const value = await input.inputValue();
  expect(value).toBe(emoji); // no truncation/mangling of grapheme clusters
});

test("1.6 code block pasted — horizontal scroll inside, no page overflow", async ({ page }) => {
  const input = await openChat(page);
  const code = "function veryLongFunctionNameThatWontWrapNaturallyAtAll(argumentOne, argumentTwo) {\n  return argumentOne + argumentTwo;\n}";
  await input.fill(code);
  const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyScrollWidth - viewportWidth).toBeLessThan(5); // page itself never scrolls horizontally
});

test("1.9 whitespace-only input keeps Send disabled", async ({ page }) => {
  const input = await openChat(page);
  await input.fill("   \n  \n   ");
  const sendBtn = page.getByRole("button", { name: /^Send$|^Queue$/ });
  await expect(sendBtn).toBeDisabled();
});

test("1.10 very long single unbroken line stays within viewport width", async ({ page }) => {
  const input = await openChat(page);
  await input.fill("a".repeat(500));
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const box = await input.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(viewportWidth);
  expect(box!.x).toBeGreaterThanOrEqual(0);
});
