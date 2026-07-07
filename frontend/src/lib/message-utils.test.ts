import { expect, test } from "bun:test";
import {
  finalizeTurnBlocks,
  getContextUsedTokens,
  getModelContextWindowTokens,
  isLatestAttachRequest,
  isLatestCapturePaneRequest,
  shouldApplyCapturePaneResponse,
  shouldAutoCancelPendingDialog,
} from "./message-utils";
import type { TurnBlock } from "./types";

test("context used reads first available token field", () => {
  expect(getContextUsedTokens({ tokens: { context: 1234 } })).toBe(1234);
  expect(getContextUsedTokens({ tokens: { contextTokens: 500 } })).toBe(500);
  expect(getContextUsedTokens({ tokens: { context_tokens: 42 } })).toBe(42);
  expect(getContextUsedTokens(null)).toBe(null);
  expect(getContextUsedTokens({ tokens: {} })).toBe(null);
});

test("model context window reads first positive field", () => {
  expect(getModelContextWindowTokens({ contextWindow: 200000 })).toBe(200000);
  expect(getModelContextWindowTokens({ context_window: 128000 })).toBe(128000);
  expect(getModelContextWindowTokens({ maxContextTokens: 32000 })).toBe(32000);
  expect(getModelContextWindowTokens({ contextWindow: 0 })).toBe(null);
  expect(getModelContextWindowTokens(null)).toBe(null);
});

test("percent math clamps to 100", () => {
  const used = getContextUsedTokens({ tokens: { context: 250000 } })!;
  const max = getModelContextWindowTokens({ contextWindow: 200000 })!;
  expect(Math.min(100, Math.round((used / max) * 100))).toBe(100);
});

test("finalizeTurnBlocks clears streaming on text/thinking and flips a running tool to error", () => {
  const blocks: TurnBlock[] = [
    { kind: "text", text: "hi", streaming: true },
    { kind: "thinking", text: "hmm", streaming: true },
    { kind: "tool", id: "t1", name: "bash", status: "running" },
    { kind: "tool", id: "t2", name: "read", status: "done", output: "ok" },
  ];
  const out = finalizeTurnBlocks(blocks);
  expect(out[0]).toEqual({ kind: "text", text: "hi", streaming: false });
  expect(out[1]).toEqual({ kind: "thinking", text: "hmm", streaming: false });
  expect(out[2]).toEqual({ kind: "tool", id: "t1", name: "bash", status: "error", output: "Interrupted" });
  // Already-finished tool blocks are left alone.
  expect(out[3]).toEqual({ kind: "tool", id: "t2", name: "read", status: "done", output: "ok" });
});

test("shouldApplyCapturePaneResponse drops a stale response from a since-abandoned agent", () => {
  // Same agent still being viewed: apply it.
  expect(shouldApplyCapturePaneResponse("agent-a", "agent-a")).toBe(true);
  // User switched to viewing a different agent before this response arrived: drop it.
  expect(shouldApplyCapturePaneResponse("agent-a", "agent-b")).toBe(false);
  // No peek open anymore: drop it.
  expect(shouldApplyCapturePaneResponse("agent-a", null)).toBe(false);
  // Unknown/untracked request id: drop it rather than guessing.
  expect(shouldApplyCapturePaneResponse(undefined, "agent-a")).toBe(false);
});

test("isLatestCapturePaneRequest drops a slower, superseded request's response", () => {
  // A manual refresh (req-2) fires after the poll's req-1, and resolves first;
  // req-1's response then lands late — it's no longer the latest for the agent.
  expect(isLatestCapturePaneRequest("req-1", "agent-a", "req-2")).toBe(false);
  // The latest request's own response applies normally.
  expect(isLatestCapturePaneRequest("req-2", "agent-a", "req-2")).toBe(true);
  // Untracked/unknown ids: drop rather than guessing.
  expect(isLatestCapturePaneRequest(undefined, "agent-a", "req-2")).toBe(false);
  expect(isLatestCapturePaneRequest("req-1", undefined, "req-2")).toBe(false);
});

test("isLatestAttachRequest drops a stale attach tap superseded by a newer one", () => {
  // Tap agent A (req-1), then agent B (req-2) before A's slower response lands.
  // req-1's response arrives late — it's no longer the latest tap, drop it.
  expect(isLatestAttachRequest("req-1", "req-2")).toBe(false);
  // req-2 (the latest tap) applies normally.
  expect(isLatestAttachRequest("req-2", "req-2")).toBe(true);
  // Untracked/unknown request id: drop rather than guessing.
  expect(isLatestAttachRequest(undefined, "req-2")).toBe(false);
  // detachFromAgent() nulls out the tracker so a late response for the agent
  // the user just left can never pass as "latest" and resurrect it.
  expect(isLatestAttachRequest("req-1", null)).toBe(false);
});

test("shouldAutoCancelPendingDialog only cancels a different, still-unresolved request", () => {
  // A second extension_ui_request lands before the first was resolved: cancel it.
  expect(shouldAutoCancelPendingDialog("req-1", "req-2")).toBe(true);
  // Same request re-delivered (e.g. a redundant resend): nothing to cancel.
  expect(shouldAutoCancelPendingDialog("req-1", "req-1")).toBe(false);
  // No dialog currently pending: nothing to cancel.
  expect(shouldAutoCancelPendingDialog(undefined, "req-1")).toBe(false);
});
