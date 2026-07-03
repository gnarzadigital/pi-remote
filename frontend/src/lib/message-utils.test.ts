import { expect, test } from "bun:test";
import { getContextUsedTokens, getModelContextWindowTokens } from "./message-utils";

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
