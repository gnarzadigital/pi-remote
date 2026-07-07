import { expect, test } from "bun:test";
import { resolveBootCwd } from "./boot-cwd";

const dirs = new Set(["/real/project"]);
const isDir = (p: string) => dirs.has(p);

test("boots into last-used workspace when it still exists", () => {
  expect(resolveBootCwd("/real/project", "/fallback", isDir)).toBe("/real/project");
});

test("falls back when last-used workspace was deleted", () => {
  expect(resolveBootCwd("/gone/project", "/fallback", isDir)).toBe("/fallback");
});

test("falls back when no last-used workspace is recorded", () => {
  expect(resolveBootCwd(undefined, "/fallback", isDir)).toBe("/fallback");
});
