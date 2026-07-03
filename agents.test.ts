import { expect, test } from "bun:test";
import { buildSpawnPrompt, canonicalizeCwd, findRegistryWorkspace, parseSpawnSurface } from "./agents";

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

test("canonicalizeCwd resolves a symlinked path (regression: /tmp -> /private/tmp)", () => {
  const resolver = (p: string) => (p === "/tmp/foo" ? "/private/tmp/foo" : p);
  expect(canonicalizeCwd("/tmp/foo", resolver)).toBe("/private/tmp/foo");
});

test("canonicalizeCwd falls back to the literal path when unresolvable", () => {
  const resolver = () => {
    throw new Error("ENOENT");
  };
  expect(canonicalizeCwd("/does/not/exist", resolver)).toBe("/does/not/exist");
});

test("findRegistryWorkspace disambiguates a colliding surface number by cwd (regression: same bare surface live in two workspaces simultaneously)", () => {
  const registry = {
    "default/surface:58": { surface_ref: "surface:58", cwd: "/tmp/mine", registered_at: 200 },
    "workspace:26/surface:58": { surface_ref: "surface:58", cwd: "/other/project", registered_at: 100 },
  };
  expect(findRegistryWorkspace(registry, "surface:58", "/tmp/mine")).toBe("default");
  expect(findRegistryWorkspace(registry, "surface:58", "/other/project")).toBe("workspace:26");
});

test("findRegistryWorkspace returns null when the surface isn't found", () => {
  expect(findRegistryWorkspace({}, "surface:99", "/x")).toBe(null);
});
