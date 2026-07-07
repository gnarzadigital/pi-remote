import { expect, test } from "bun:test";
import { shouldFlushQueueOnReconnect, shouldQueue } from "./message-queue";

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

test("flushes a stuck queue once reconnected and no longer streaming", () => {
  expect(shouldFlushQueueOnReconnect(1, false)).toBe(true);
});

test("does not flush an empty queue", () => {
  expect(shouldFlushQueueOnReconnect(0, false)).toBe(false);
});

test("does not flush while a turn is still marked streaming", () => {
  expect(shouldFlushQueueOnReconnect(1, true)).toBe(false);
});
