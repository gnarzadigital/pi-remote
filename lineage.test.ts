import { expect, test } from "bun:test";
import { buildAgentTree, flattenTree, type AgentInfo } from "./lineage";

const mk = (id: string, parentId?: string): AgentInfo => ({
  id,
  parentId,
  label: id,
  status: "active",
});

test("nests orchestrator → agents → subagent", () => {
  const roots = buildAgentTree([mk("orch"), mk("a", "orch"), mk("b", "orch"), mk("sub", "a")]);
  expect(roots.length).toBe(1);
  expect(roots[0].id).toBe("orch");
  expect(roots[0].children.map((c) => c.id)).toEqual(["a", "b"]);
  const a = roots[0].children[0];
  expect(a.children.map((c) => c.id)).toEqual(["sub"]);
  expect(a.children[0].depth).toBe(2);
});

test("orphan (missing parent) is promoted to root", () => {
  const roots = buildAgentTree([mk("x", "ghost"), mk("y")]);
  expect(roots.map((r) => r.id)).toEqual(["x", "y"]);
});

test("self-parent is treated as root, not infinite loop", () => {
  const roots = buildAgentTree([mk("z", "z")]);
  expect(roots.length).toBe(1);
  expect(roots[0].id).toBe("z");
});

test("flattenTree yields depth-first order", () => {
  const roots = buildAgentTree([mk("orch"), mk("a", "orch"), mk("sub", "a"), mk("b", "orch")]);
  expect(flattenTree(roots).map((n) => n.id)).toEqual(["orch", "a", "sub", "b"]);
});
