import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./qa",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.PI_REMOTE_URL ?? "http://127.0.0.1:7700",
    trace: "off",
  },
});
