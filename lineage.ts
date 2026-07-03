// Build the nested agent tree for the session picker: orchestrator → parallel
// agents → subagents. Lineage (parentId) is recorded by the bridge at spawn time
// because cmux's registry is flat (no parent link). Orphans (parent missing) are
// promoted to roots so nothing is ever dropped.

export type AgentStatus = "active" | "awaiting-confirm" | "done" | "closed";
export type ContextMode = "full" | "task" | "scoped";

export interface AgentInfo {
  id: string;
  parentId?: string | null;
  label: string;
  cwd?: string;
  status: AgentStatus;
  contextMode?: ContextMode;
  surface?: string; // cmux surface ref, if spawned into a pane
}

export interface AgentNode extends AgentInfo {
  depth: number;
  children: AgentNode[];
}

export function buildAgentTree(agents: AgentInfo[]): AgentNode[] {
  const byId = new Map<string, AgentNode>();
  for (const a of agents) byId.set(a.id, { ...a, depth: 0, children: [] });

  const roots: AgentNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node); // no/unknown/self parent → root
  }

  // Assign depth + stable child ordering (by id) via DFS.
  const assign = (node: AgentNode, depth: number) => {
    node.depth = depth;
    node.children.sort((x, y) => x.id.localeCompare(y.id));
    for (const c of node.children) assign(c, depth + 1);
  };
  roots.sort((x, y) => x.id.localeCompare(y.id));
  for (const r of roots) assign(r, 0);

  return roots;
}

/** Flatten a tree to a depth-tagged list for simple list rendering. */
export function flattenTree(roots: AgentNode[]): AgentNode[] {
  const out: AgentNode[] = [];
  const walk = (n: AgentNode) => {
    out.push(n);
    for (const c of n.children) walk(c);
  };
  for (const r of roots) walk(r);
  return out;
}
