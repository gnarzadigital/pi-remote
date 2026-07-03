import { expect, test } from "bun:test";
import { diffStat, lineDiff, parseEditArgs } from "./diff-parse";

test("parseEditArgs reads oldText/newText + path", () => {
  const p = parseEditArgs(JSON.stringify({ path: "a.ts", oldText: "x", newText: "y" }));
  expect(p).toEqual({ path: "a.ts", oldText: "x", newText: "y" });
});

test("parseEditArgs falls back to alt keys and content", () => {
  const p = parseEditArgs(JSON.stringify({ file: "b.md", content: "hello" }));
  expect(p?.path).toBe("b.md");
  expect(p?.newText).toBe("hello");
  expect(p?.oldText).toBe("");
});

test("parseEditArgs returns null on junk / empty", () => {
  expect(parseEditArgs("not json")).toBe(null);
  expect(parseEditArgs(JSON.stringify({ path: "x" }))).toBe(null);
  expect(parseEditArgs(undefined)).toBe(null);
});

test("lineDiff marks changed lines, keeps context", () => {
  const d = lineDiff("a\nb\nc", "a\nB\nc");
  expect(d).toEqual([
    { type: "ctx", text: "a" },
    { type: "del", text: "b" },
    { type: "add", text: "B" },
    { type: "ctx", text: "c" },
  ]);
});

test("lineDiff handles pure additions and stat", () => {
  const d = lineDiff("a", "a\nb\nc");
  expect(diffStat(d)).toEqual({ added: 2, removed: 0 });
});
