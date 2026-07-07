import { expect, test } from "bun:test";
import { canAttachChat, terminalWatchKey } from "./agent-runtime";

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

test("terminalWatchKey is stable across a poll refresh that changes unrelated fields", () => {
  // Simulates AgentInbox's 5s poll: a brand-new object for the same agent,
  // with e.g. activitySummary/status updated but id/surface/workspace unchanged.
  const before = { id: "a1", surface: "3", workspace: "ws1", activitySummary: "reading files" };
  const after = { id: "a1", surface: "3", workspace: "ws1", activitySummary: "writing tests" };
  expect(terminalWatchKey(before)).toBe(terminalWatchKey(after));
});

test("terminalWatchKey changes when the pane target actually moves", () => {
  const a = { id: "a1", surface: "3", workspace: "ws1" };
  const differentSurface = { id: "a1", surface: "4", workspace: "ws1" };
  const differentWorkspace = { id: "a1", surface: "3", workspace: "ws2" };
  const differentAgent = { id: "a2", surface: "3", workspace: "ws1" };
  expect(terminalWatchKey(a)).not.toBe(terminalWatchKey(differentSurface));
  expect(terminalWatchKey(a)).not.toBe(terminalWatchKey(differentWorkspace));
  expect(terminalWatchKey(a)).not.toBe(terminalWatchKey(differentAgent));
});
