import { expect, test } from "bun:test";
import { chatLinesToThreadMessages } from "./assistant-ui-adapter";
import type { ChatLine } from "./types";

test("user line converts to a user-role text message", () => {
  const lines: ChatLine[] = [{ id: "1", kind: "user", text: "hello" }];
  const out = chatLinesToThreadMessages(lines);
  expect(out).toEqual([{ id: "1", role: "user", content: [{ type: "text", text: "hello" }] }]);
});

test("turn with text block converts to assistant text part, streaming reflected in status", () => {
  const lines: ChatLine[] = [
    { id: "2", kind: "turn", streaming: true, blocks: [{ kind: "text", text: "thinking out loud" }] },
  ];
  const out = chatLinesToThreadMessages(lines);
  expect(out).toEqual([
    {
      id: "2",
      role: "assistant",
      content: [{ type: "text", text: "thinking out loud" }],
      status: { type: "running" },
    },
  ]);
});

test("thinking block converts to a reasoning content part", () => {
  const lines: ChatLine[] = [
    { id: "3", kind: "turn", streaming: false, blocks: [{ kind: "thinking", text: "chain of thought" }] },
  ];
  const out = chatLinesToThreadMessages(lines);
  expect(out[0]?.content).toEqual([{ type: "reasoning", text: "chain of thought" }]);
  expect(out[0]?.status).toEqual({ type: "complete", reason: "stop" });
});

test("tool block converts to a tool-call part with parsed args and error flag", () => {
  const lines: ChatLine[] = [
    {
      id: "4",
      kind: "turn",
      blocks: [
        {
          kind: "tool",
          id: "call-1",
          name: "list_files",
          args: '{"path":"/tmp"}',
          output: "boom",
          status: "error",
        },
      ],
    },
  ];
  const out = chatLinesToThreadMessages(lines);
  expect(out[0]?.content).toEqual([
    {
      type: "tool-call",
      toolCallId: "call-1",
      toolName: "list_files",
      args: { path: "/tmp" },
      result: "boom",
      isError: true,
    },
  ]);
});

test("system and error lines convert to assistant text (no first-class banner type in spike scope)", () => {
  const lines: ChatLine[] = [
    { id: "5", kind: "system", text: "session loaded" },
    { id: "6", kind: "error", text: "bridge error" },
  ];
  const out = chatLinesToThreadMessages(lines);
  expect(out.map((m) => m.role)).toEqual(["assistant", "assistant"]);
  expect(out.map((m) => m.content)).toEqual([
    [{ type: "text", text: "session loaded" }],
    [{ type: "text", text: "bridge error" }],
  ]);
});
