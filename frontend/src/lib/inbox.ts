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

const GROUP_URGENCY: Record<InboxGroupKey, number> = {
  "needs-you": 0,
  working: 1,
  review: 2,
  done: 3,
};

export interface WorkspaceCollapseResult {
  /** DFS-ordered flat list, ready for groupInbox — one family kept per
   *  workspace (plus every family with no resolved workspace, untouched). */
  visible: AgentTreeNode[];
  /** workspace ref -> how many sibling sessions were folded into the kept row. */
  extraByWorkspace: Map<string, number>;
}

/** A cmux workspace commonly holds several terminal panes (a task spawned
 *  alongside the one you're already in). Ambient discovery surfaces every pane
 *  as its own root agent, which floods the inbox with siblings that all say
 *  the same workspace. When `enabled`, keep only the most urgent (then most
 *  recent) family per workspace and report how many were folded in, so the
 *  row can say "+N in this workspace" instead of silently hiding them.
 *  `enabled: false` is a no-op passthrough (nothing hidden, nothing counted). */
export function collapseFamiliesByWorkspace(
  agents: AgentTreeNode[],
  enabled: boolean
): WorkspaceCollapseResult {
  const extraByWorkspace = new Map<string, number>();
  if (!enabled) return { visible: agents, extraByWorkspace };

  const byWorkspace = new Map<string, AgentTreeNode[][]>();
  const kept: AgentTreeNode[][] = [];
  for (const family of toFamilies(agents)) {
    const ws = family[0]!.workspace;
    if (!ws) {
      kept.push(family);
      continue;
    }
    const list = byWorkspace.get(ws);
    if (list) list.push(family);
    else byWorkspace.set(ws, [family]);
  }

  for (const [ws, families] of byWorkspace) {
    const sorted = [...families].sort((a, b) => {
      const ua = GROUP_URGENCY[rootGroup(a[0]!) ?? "done"];
      const ub = GROUP_URGENCY[rootGroup(b[0]!) ?? "done"];
      if (ua !== ub) return ua - ub;
      return (b[0]!.spawnedAt ?? 0) - (a[0]!.spawnedAt ?? 0);
    });
    kept.push(sorted[0]!);
    if (sorted.length > 1) extraByWorkspace.set(ws, sorted.length - 1);
  }

  return { visible: kept.flat(), extraByWorkspace };
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
