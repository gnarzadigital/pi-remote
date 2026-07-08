import { expect, test } from "bun:test";
import { collapseFamiliesByWorkspace, filterInboxAgents, groupInbox, rootGroup, toFamilies } from "./inbox";
import type { AgentTreeNode } from "./types";

function mk(p: Partial<AgentTreeNode> & { id: string }): AgentTreeNode {
  return {
    parentId: null,
    label: p.id,
    surface: `surface:${p.id}`,
    status: "active",
    depth: 0,
    ...p,
  };
}

test("rootGroup maps status + signals to next-action groups", () => {
  expect(rootGroup(mk({ id: "a", status: "awaiting-confirm" }))).toBe("needs-you");
  expect(rootGroup(mk({ id: "b", status: "active", needsInput: true }))).toBe("needs-you");
  expect(rootGroup(mk({ id: "c", status: "active", needsAttention: true }))).toBe("needs-you");
  expect(rootGroup(mk({ id: "d", status: "active" }))).toBe("working");
  expect(rootGroup(mk({ id: "e", status: "done" }))).toBe("done");
  expect(rootGroup(mk({ id: "f", status: "done", diffStat: { added: 1, removed: 0 } }))).toBe("review");
  expect(rootGroup(mk({ id: "g", status: "closed" }))).toBeNull();
});

test("toFamilies groups a DFS list by depth-0 boundaries", () => {
  const flat = [
    mk({ id: "root1", depth: 0 }),
    mk({ id: "child1", depth: 1 }),
    mk({ id: "grand1", depth: 2 }),
    mk({ id: "root2", depth: 0 }),
  ];
  const fams = toFamilies(flat);
  expect(fams.map((f) => f.map((a) => a.id))).toEqual([
    ["root1", "child1", "grand1"],
    ["root2"],
  ]);
});

test("groupInbox keeps a family together under the root's group even if a child differs", () => {
  const flat = [
    mk({ id: "root", depth: 0, status: "active" }), // working
    mk({ id: "child", depth: 1, status: "awaiting-confirm" }), // would be needs-you alone
  ];
  const sections = groupInbox(flat);
  expect(sections).toHaveLength(1);
  expect(sections[0].key).toBe("working");
  expect(sections[0].agents.map((a) => a.id)).toEqual(["root", "child"]);
});

test("groupInbox omits empty groups and orders needs-you before working before done", () => {
  const flat = [
    mk({ id: "w", status: "active" }),
    mk({ id: "n", status: "awaiting-confirm" }),
    mk({ id: "d", status: "done" }),
    mk({ id: "closed", status: "closed" }),
  ];
  const sections = groupInbox(flat);
  expect(sections.map((s) => s.key)).toEqual(["needs-you", "working", "done"]);
});

test("groupInbox sorts most-recently-spawned root first within a group", () => {
  const flat = [
    mk({ id: "old", status: "active", spawnedAt: 100 }),
    mk({ id: "new", status: "active", spawnedAt: 200 }),
  ];
  const [working] = groupInbox(flat);
  expect(working.agents.map((a) => a.id)).toEqual(["new", "old"]);
});

test("filterInboxAgents keeps the whole family when any member matches, drops the rest", () => {
  const flat = [
    mk({ id: "root", depth: 0, label: "auth refactor" }),
    mk({ id: "child", depth: 1, label: "write tests" }),
    mk({ id: "other", depth: 0, label: "schema migration" }),
  ];
  const kept = filterInboxAgents(flat, "tests");
  expect(kept.map((a) => a.id)).toEqual(["root", "child"]);
  expect(filterInboxAgents(flat, "schema").map((a) => a.id)).toEqual(["other"]);
  expect(filterInboxAgents(flat, "").map((a) => a.id)).toEqual(["root", "child", "other"]);
});

test("collapseFamiliesByWorkspace is a no-op passthrough when disabled", () => {
  const flat = [
    mk({ id: "a", workspace: "workspace:5", status: "active" }),
    mk({ id: "b", workspace: "workspace:5", status: "awaiting-confirm" }),
  ];
  const { visible, extraByWorkspace } = collapseFamiliesByWorkspace(flat, false);
  expect(visible).toBe(flat);
  expect(extraByWorkspace.size).toBe(0);
});

test("collapseFamiliesByWorkspace keeps one family per workspace, prefers needs-you over working", () => {
  const flat = [
    mk({ id: "working-one", workspace: "workspace:5", status: "active", spawnedAt: 100 }),
    mk({ id: "needs-you-one", workspace: "workspace:5", status: "awaiting-confirm", spawnedAt: 50 }),
    mk({ id: "working-two", workspace: "workspace:5", status: "active", spawnedAt: 200 }),
  ];
  const { visible, extraByWorkspace } = collapseFamiliesByWorkspace(flat, true);
  expect(visible.map((a) => a.id)).toEqual(["needs-you-one"]);
  expect(extraByWorkspace.get("workspace:5")).toBe(2);
});

test("collapseFamiliesByWorkspace ties on urgency by most-recent spawnedAt", () => {
  const flat = [
    mk({ id: "old", workspace: "workspace:9", status: "active", spawnedAt: 100 }),
    mk({ id: "new", workspace: "workspace:9", status: "active", spawnedAt: 300 }),
  ];
  const { visible, extraByWorkspace } = collapseFamiliesByWorkspace(flat, true);
  expect(visible.map((a) => a.id)).toEqual(["new"]);
  expect(extraByWorkspace.get("workspace:9")).toBe(1);
});

test("collapseFamiliesByWorkspace leaves distinct workspaces and unresolved workspaces alone", () => {
  const flat = [
    mk({ id: "ws-a", workspace: "workspace:1", status: "active" }),
    mk({ id: "ws-b", workspace: "workspace:2", status: "active" }),
    mk({ id: "no-ws", workspace: null, status: "active" }),
  ];
  const { visible, extraByWorkspace } = collapseFamiliesByWorkspace(flat, true);
  expect(visible.map((a) => a.id).sort()).toEqual(["no-ws", "ws-a", "ws-b"]);
  expect(extraByWorkspace.size).toBe(0);
});

test("collapseFamiliesByWorkspace keeps a workspace's children attached to its kept root", () => {
  const flat = [
    mk({ id: "root1", workspace: "workspace:5", status: "active", depth: 0, spawnedAt: 200 }),
    mk({ id: "child1", workspace: "workspace:5", status: "active", depth: 1, parentId: "root1" }),
    mk({ id: "root2", workspace: "workspace:5", status: "active", depth: 0, spawnedAt: 100 }),
  ];
  const { visible } = collapseFamiliesByWorkspace(flat, true);
  expect(visible.map((a) => a.id)).toEqual(["root1", "child1"]);
});
