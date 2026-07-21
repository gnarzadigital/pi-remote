import { expect, test } from "bun:test";
import { canAttachChat, canOpenRichAgentChat } from "./agent-runtime";

test("pi runtime can attach the rich chat", () => {
  expect(canAttachChat("pi")).toBe(true);
  expect(canAttachChat("PI")).toBe(true); // case-insensitive, matches how runtime strings vary
});

test("other runtimes cannot attach (claude/codex use a different session protocol)", () => {
  expect(canAttachChat("claude")).toBe(false);
  expect(canAttachChat("codex")).toBe(false);
  expect(canAttachChat("agent")).toBe(false); // unknown-runtime fallback label
});

test("undefined runtime defaults to pi-like (self-spawned agents before this field existed)", () => {
  expect(canAttachChat(undefined)).toBe(true);
});

test("rich chat only opens for pi agents with resolvable pi-remote metadata", () => {
  expect(canOpenRichAgentChat({ runtime: "pi", spawnedAt: Date.now(), cwd: "/tmp/project" })).toBe(true);
  expect(canOpenRichAgentChat({ runtime: "pi", spawnedAt: 0, cwd: "/tmp/project" })).toBe(false);
  expect(canOpenRichAgentChat({ runtime: "pi", spawnedAt: Date.now(), cwd: "" })).toBe(false);
  expect(canOpenRichAgentChat({ runtime: "claude", spawnedAt: Date.now(), cwd: "/tmp/project" })).toBe(false);
});
