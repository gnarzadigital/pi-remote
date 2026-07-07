import { expect, test } from "bun:test";
import { sessionSwitchScrollBaseline, withinSessionSwitchWindow } from "./chat-scroll";
import type { ChatLine } from "./types";

test("baseline treats a session ending on a user turn as already seen", () => {
  const lines: ChatLine[] = [
    { id: "a", kind: "user", text: "hi" },
    { id: "b", kind: "turn", blocks: [] },
    { id: "c", kind: "user", text: "still there?" },
  ];
  expect(sessionSwitchScrollBaseline(lines)).toEqual({ lineCount: 3, lastUserId: "c" });
});

test("baseline has no last-user-id when the session ends on an assistant turn", () => {
  const lines: ChatLine[] = [
    { id: "a", kind: "user", text: "hi" },
    { id: "b", kind: "turn", blocks: [] },
  ];
  expect(sessionSwitchScrollBaseline(lines)).toEqual({ lineCount: 2, lastUserId: null });
});

test("baseline for an empty session", () => {
  expect(sessionSwitchScrollBaseline([])).toEqual({ lineCount: 0, lastUserId: null });
});

test("session-switch window covers the real history landing after the transitional patch", () => {
  const switchedAt = 1_000;
  expect(withinSessionSwitchWindow(switchedAt, 1_000)).toBe(true);
  expect(withinSessionSwitchWindow(switchedAt, 1_000 + 2_999)).toBe(true);
});

test("session-switch window expires so an unrelated later update isn't re-baselined", () => {
  const switchedAt = 1_000;
  expect(withinSessionSwitchWindow(switchedAt, 1_000 + 3_000)).toBe(false);
  expect(withinSessionSwitchWindow(switchedAt, 1_000 + 10_000)).toBe(false);
});
