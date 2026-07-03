import { expect, test } from "bun:test";
import { buildSpawnPrompt, parseSpawnSurface } from "./agents";

test("task mode = just the task", () => {
  expect(buildSpawnPrompt("task", "  fix the bug  ")).toBe("fix the bug");
});

test("scoped mode prepends orchestrator summary when given", () => {
  const p = buildSpawnPrompt("scoped", "do X", { parentSummary: "we decided Y" });
  expect(p).toContain("Context from the orchestrator:");
  expect(p).toContain("we decided Y");
  expect(p).toContain("do X");
});

test("scoped mode without summary falls back to task", () => {
  expect(buildSpawnPrompt("scoped", "do X")).toBe("do X");
});

test("full mode references the orchestrator session to continue the thread", () => {
  const p = buildSpawnPrompt("full", "continue", {
    parentSummary: "history so far",
    parentSessionPath: "/s.jsonl",
  });
  expect(p).toContain("Full context");
  expect(p).toContain("/s.jsonl");
  expect(p).toContain("continue that thread");
});

test("parseSpawnSurface extracts the surface ref", () => {
  expect(parseSpawnSurface("spawned: pi in surface:88")).toBe("surface:88");
  expect(parseSpawnSurface("no surface here")).toBe(null);
});
