import { expect, test } from "bun:test";
import { sessionSwitchScrollBaseline } from "./chat-scroll";
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
