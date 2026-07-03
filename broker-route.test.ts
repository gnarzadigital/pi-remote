import { expect, test } from "bun:test";
import { resolveRoute, setRoute } from "./broker-route";

test("explicit live agentId routes directly", () => {
  expect(resolveRoute({ agentId: "a1" }, new Map(), new Set(["a1", "a2"]))).toEqual({
    ok: true,
    agentId: "a1",
  });
});

test("dead explicit agentId is unknown_agent", () => {
  expect(resolveRoute({ agentId: "gone" }, new Map(), new Set(["a1"]))).toEqual({
    ok: false,
    reason: "unknown_agent",
  });
});

test("session route wins", () => {
  const routes = new Map([["/s.jsonl", "a2"]]);
  expect(resolveRoute({ sessionId: "/s.jsonl" }, routes, new Set(["a1", "a2"]))).toEqual({
    ok: true,
    agentId: "a2",
  });
});

test("single-live fallback when no route", () => {
  expect(resolveRoute({}, new Map(), new Set(["only"]))).toEqual({ ok: true, agentId: "only" });
});

test("refuses to guess when 2+ live and no route (F3/F4)", () => {
  expect(resolveRoute({}, new Map(), new Set(["a1", "a2"]))).toEqual({
    ok: false,
    reason: "ambiguous",
  });
});

test("no live agents → no_route", () => {
  expect(resolveRoute({}, new Map(), new Set())).toEqual({ ok: false, reason: "no_route" });
});

test("setRoute keeps map 1:1 — evicts old session on same agent", () => {
  const routes = new Map([["/old.jsonl", "a1"]]);
  setRoute(routes, "/new.jsonl", "a1");
  expect(routes.has("/old.jsonl")).toBe(false);
  expect(routes.get("/new.jsonl")).toBe("a1");
});
