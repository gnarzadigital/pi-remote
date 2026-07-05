import type { AgentTreeNode } from "./types";

/** Inbox groups, ordered by urgency (what the user should do next), not by raw
 *  agent status. This is the whole point of the redesign: one list, grouped by
 *  next-action, matching Claude Agent View / Cursor / Codex. */
export type InboxGroupKey = "needs-you" | "working" | "review" | "done";

export const INBOX_GROUP_ORDER: InboxGroupKey[] = ["needs-you", "working", "review", "done"];

export const INBOX_GROUP_LABEL: Record<InboxGroupKey, string> = {
  "needs-you": "Needs you",
  working: "Working",
  review: "Ready for review",
  done: "Done",
};

export interface InboxSection {
  key: InboxGroupKey;
  label: string;
  /** Depth-tagged, DFS-ordered: each root immediately followed by its descendants. */
  agents: AgentTreeNode[];
}

/** Which inbox group a ROOT agent belongs to. Returns null for closed agents
 *  (dropped from the inbox entirely). Children ride along under their root's
 *  group regardless of their own status (Devin/Codex/Cursor nesting model). */
export function rootGroup(a: AgentTreeNode): InboxGroupKey | null {
  if (a.status === "closed") return null;
  if (a.status === "awaiting-confirm" || a.needsInput || a.needsAttention) return "needs-you";
  if (a.status === "active") return "working";
  if (a.status === "done") return a.diffStat ? "review" : "done";
  return null;
}

/** Split a DFS-ordered flat list (bridge sends flattenTree output) into families:
 *  each family starts at a depth-0 root and includes every following node until
 *  the next depth-0 root. Keeps subagents attached to their parent. */
export function toFamilies(agents: AgentTreeNode[]): AgentTreeNode[][] {
  const families: AgentTreeNode[][] = [];
  for (const a of agents) {
    if (a.depth === 0 || families.length === 0) families.push([a]);
    else families[families.length - 1].push(a);
  }
  return families;
}

/** Keep a whole family if its root OR any descendant matches the query. Query is
 *  matched against label, activity summary, runtime, and workspace label. */
export function filterInboxAgents(agents: AgentTreeNode[], query: string): AgentTreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return agents;
  const hit = (a: AgentTreeNode) =>
    [a.label, a.activitySummary, a.runtime, a.workspaceLabel]
      .some((s) => s?.toLowerCase().includes(q));
  return toFamilies(agents)
    .filter((fam) => fam.some(hit))
    .flat();
}

/** Group agents into ordered next-action sections. Families stay together under
 *  the root's group; empty groups are omitted; within a group the most-recently
 *  active roots come first. */
export function groupInbox(agents: AgentTreeNode[]): InboxSection[] {
  const buckets: Record<InboxGroupKey, AgentTreeNode[][]> = {
    "needs-you": [],
    working: [],
    review: [],
    done: [],
  };
  for (const family of toFamilies(agents)) {
    const g = rootGroup(family[0]);
    if (g) buckets[g].push(family);
  }
  const sections: InboxSection[] = [];
  for (const key of INBOX_GROUP_ORDER) {
    const fams = buckets[key];
    if (fams.length === 0) continue;
    // ponytail: spawnedAt is the recency proxy until Phase 2 adds lastActivityAt.
    fams.sort((a, b) => (b[0].spawnedAt ?? 0) - (a[0].spawnedAt ?? 0));
    sections.push({ key, label: INBOX_GROUP_LABEL[key], agents: fams.flat() });
  }
  return sections;
}
