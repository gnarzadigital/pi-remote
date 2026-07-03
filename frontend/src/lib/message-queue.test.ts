import { expect, test } from "bun:test";
import { shouldQueue } from "./message-queue";

test("queues a plain prompt typed mid-stream", () => {
  expect(shouldQueue(true, "prompt", false)).toBe(true);
});

test("does not queue when idle", () => {
  expect(shouldQueue(false, "prompt", false)).toBe(false);
});

test("steer and follow-up always send immediately", () => {
  expect(shouldQueue(true, "steer", false)).toBe(false);
  expect(shouldQueue(true, "follow_up", false)).toBe(false);
});

test("messages with images send immediately", () => {
  expect(shouldQueue(true, "prompt", true)).toBe(false);
});
