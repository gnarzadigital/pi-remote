import { expect, test } from "bun:test";
import { buildCorrelatedSessionResponse } from "./session-file-correlation";

test("merges real sessionFile from get_state into the original new_session response", () => {
  const merged = buildCorrelatedSessionResponse(
    { originalId: "client-1", originalCommand: "new_session", originalData: { cancelled: false } },
    { sessionFile: "/home/nik/.pi/agent/sessions/abc.jsonl" }
  );
  expect(merged).toEqual({
    type: "response",
    command: "new_session",
    id: "client-1",
    success: true,
    data: { cancelled: false, sessionFile: "/home/nik/.pi/agent/sessions/abc.jsonl" },
  });
});

test("preserves switch_session as the command and id", () => {
  const merged = buildCorrelatedSessionResponse(
    { originalId: "client-2", originalCommand: "switch_session", originalData: { cancelled: false } },
    { sessionFile: "/s.jsonl" }
  );
  expect(merged.command).toBe("switch_session");
  expect(merged.id).toBe("client-2");
});

test("handles missing originalData (non-object)", () => {
  const merged = buildCorrelatedSessionResponse(
    { originalId: "client-3", originalCommand: "new_session", originalData: undefined },
    { sessionFile: "/s.jsonl" }
  );
  expect(merged.data).toEqual({ sessionFile: "/s.jsonl" });
});

test("handles a failed chained get_state (no sessionFile)", () => {
  const merged = buildCorrelatedSessionResponse(
    { originalId: "client-4", originalCommand: "new_session", originalData: { cancelled: false } },
    undefined
  );
  expect(merged.data).toEqual({ cancelled: false, sessionFile: undefined });
});
