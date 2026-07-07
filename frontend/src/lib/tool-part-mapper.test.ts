import { expect, test } from "bun:test";
import { mapToolBlock } from "./tool-part-mapper";
import type { TurnBlock } from "./types";

function toolBlock(overrides: Partial<Extract<TurnBlock, { kind: "tool" }>>): Extract<TurnBlock, { kind: "tool" }> {
  return { kind: "tool", id: "tc-1", name: "bash", status: "done", ...overrides };
}

test("mapToolBlock surfaces the tool call args as input", () => {
  const part = mapToolBlock(toolBlock({ args: JSON.stringify({ command: "ls -la" }) }));
  expect(part.input).toEqual({ command: "ls -la" });
  expect(part.toolCallId).toBe("tc-1");
});

test("mapToolBlock omits input when args is absent or unparsable", () => {
  expect(mapToolBlock(toolBlock({ args: undefined })).input).toBeUndefined();
  expect(mapToolBlock(toolBlock({ args: "not json" })).input).toBeUndefined();
  expect(mapToolBlock(toolBlock({ args: JSON.stringify(["a", "b"]) })).input).toBeUndefined();
});
