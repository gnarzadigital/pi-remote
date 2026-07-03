import { expect, test } from "bun:test";
import { transcriptFromEvent } from "./speech";

function ev(results: Array<{ transcript: string; isFinal: boolean }>) {
  const list: Record<number, unknown> & { length: number } = { length: results.length };
  results.forEach((r, i) => {
    list[i] = { 0: { transcript: r.transcript }, isFinal: r.isFinal };
  });
  return { results: list } as unknown as Parameters<typeof transcriptFromEvent>[0];
}

test("joins interim results, not final", () => {
  const r = transcriptFromEvent(ev([{ transcript: "hello ", isFinal: false }]));
  expect(r.text).toBe("hello ");
  expect(r.isFinal).toBe(false);
});

test("joins multiple results and marks final when any is final", () => {
  const r = transcriptFromEvent(
    ev([
      { transcript: "hello ", isFinal: true },
      { transcript: "world", isFinal: false },
    ])
  );
  expect(r.text).toBe("hello world");
  expect(r.isFinal).toBe(true);
});
