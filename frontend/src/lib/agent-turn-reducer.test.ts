import { expect, test } from "bun:test";
import { initialAgentChatState, reduceAgentEvent, shouldReattachAgentOnReconnect } from "./agent-turn-reducer";

test("agent_start opens a streaming turn", () => {
  const s = reduceAgentEvent(initialAgentChatState(), { type: "agent_start" });
  expect(s.streaming).toBe(true);
  expect(s.lines.length).toBe(1);
  expect(s.lines[0].kind).toBe("turn");
});

test("text_delta accumulates into the last text block", () => {
  let s = reduceAgentEvent(initialAgentChatState(), { type: "agent_start" });
  s = reduceAgentEvent(s, { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "Hel" } });
  s = reduceAgentEvent(s, { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "lo" } });
  const line = s.lines[0];
  expect(line.kind === "turn" && line.blocks[0]).toEqual({ kind: "text", text: "Hello", streaming: true });
});

test("agent_end finalizes streaming off", () => {
  let s = reduceAgentEvent(initialAgentChatState(), { type: "agent_start" });
  s = reduceAgentEvent(s, { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "hi" } });
  s = reduceAgentEvent(s, { type: "agent_end" });
  expect(s.streaming).toBe(false);
  expect(s.turnId).toBe(null);
  const line = s.lines[0];
  expect(line.kind === "turn" && line.streaming).toBe(false);
  expect(line.kind === "turn" && line.blocks[0].kind === "text" && line.blocks[0].streaming).toBe(false);
});

test("agent_end also finalizes streaming off for a thinking block, not just text", () => {
  let s = reduceAgentEvent(initialAgentChatState(), { type: "agent_start" });
  s = reduceAgentEvent(s, { type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "hmm" } });
  s = reduceAgentEvent(s, { type: "agent_end" });
  const line = s.lines[0];
  expect(line.kind === "turn" && line.blocks[0].kind === "thinking" && line.blocks[0].streaming).toBe(false);
});

test("agent_end flips a still-running tool block to error instead of leaving it spinning forever", () => {
  let s = reduceAgentEvent(initialAgentChatState(), { type: "agent_start" });
  s = reduceAgentEvent(s, {
    type: "message_update",
    assistantMessageEvent: { type: "toolcall_end", toolCall: { id: "t1", name: "bash" } },
  });
  s = reduceAgentEvent(s, { type: "agent_end" });
  const line = s.lines[0];
  expect(line.kind === "turn" && line.blocks[0]).toMatchObject({ status: "error", output: "Interrupted" });
});

test("toolcall_end creates a tool block, tool_execution_end marks it done with output", () => {
  let s = reduceAgentEvent(initialAgentChatState(), { type: "agent_start" });
  s = reduceAgentEvent(s, {
    type: "message_update",
    assistantMessageEvent: { type: "toolcall_end", toolCall: { id: "t1", name: "bash", arguments: { cmd: "ls" } } },
  });
  let line = s.lines[0];
  expect(line.kind === "turn" && line.blocks[0]).toMatchObject({ kind: "tool", id: "t1", name: "bash", status: "running" });

  s = reduceAgentEvent(s, {
    type: "tool_execution_end",
    toolCallId: "t1",
    isError: false,
    result: { content: [{ type: "text", text: "file.txt" }] },
  });
  line = s.lines[0];
  expect(line.kind === "turn" && line.blocks[0]).toMatchObject({ status: "done", output: "file.txt" });
});

test("thinking_delta finds the LAST thinking block, not the first", () => {
  let s = reduceAgentEvent(initialAgentChatState(), { type: "agent_start" });
  s = reduceAgentEvent(s, { type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "a" } });
  s = reduceAgentEvent(s, {
    type: "message_update",
    assistantMessageEvent: { type: "toolcall_end", toolCall: { id: "t1", name: "x" } },
  });
  s = reduceAgentEvent(s, { type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "b" } });
  const line = s.lines[0];
  const thinkingBlocks = line.kind === "turn" ? line.blocks.filter((b) => b.kind === "thinking") : [];
  expect(thinkingBlocks.length).toBe(1);
  expect(thinkingBlocks[0].kind === "thinking" && thinkingBlocks[0].text).toBe("ab");
});

test("unknown event type is a no-op", () => {
  const s0 = initialAgentChatState();
  const s1 = reduceAgentEvent(s0, { type: "something_else" });
  expect(s1).toEqual(s0);
});

test("shouldReattachAgentOnReconnect only fires when both agentId and sessionPath survived", () => {
  expect(shouldReattachAgentOnReconnect("agent-1", "/tmp/session.jsonl")).toBe(true);
  expect(shouldReattachAgentOnReconnect(null, "/tmp/session.jsonl")).toBe(false);
  expect(shouldReattachAgentOnReconnect("agent-1", null)).toBe(false);
  expect(shouldReattachAgentOnReconnect(null, null)).toBe(false);
});
