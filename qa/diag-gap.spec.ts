import { test } from "@playwright/test";

const BASE = process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700";

test("diagnose internal bottom void", async ({ page }) => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  await page.goto(BASE, { waitUntil: "networkidle" });
  const r = await page.evaluate(() => {
    const shell = document.querySelector(".app-shell")!.getBoundingClientRect();
    const sv = document.querySelector(".sessions-view-root")?.getBoundingClientRect();
    const scroll = document.querySelector(".sessions-scroll")!.getBoundingClientRect();
    const header = document.querySelector(".screen-header")!.getBoundingClientRect();
    return { shell, sv, scroll, header, inner: window.innerHeight };
  });
  console.log(JSON.stringify(r, null, 2));
});
