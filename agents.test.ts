import { expect, test } from "bun:test";
import {
  applyCmuxTitles,
  buildSpawnPrompt,
  canonicalizeCwd,
  extractCmuxTitles,
  findRegistryWorkspace,
  findTreeWorkspace,
  parseSpawnSurface,
  type SpawnedAgent,
} from "./agents";

// Trimmed to the fields extractCmuxTitles/findTreeWorkspace read, matching the
// real shape of `cmux --json tree --all` captured live
// (windows[].workspaces[].panes[].surfaces[]). Refs use cmux's REAL scheme
// ("workspace:N") — confirmed live that cmux's tree NEVER uses the string
// "default" (that's a cmux-agent registry-only alias for the same workspace,
// which is exactly the mismatch that broke the title overlay — see
// findTreeWorkspace's doc comment). Includes the SAME bare surface number
// ("surface:58") in two different workspaces, mirroring the real collision
// confirmed live — the composite key must disambiguate.
const SAMPLE_TREE = {
  windows: [
    {
      ref: "window:1",
      workspaces: [
        {
          ref: "workspace:1",
          title: "🦷 opportunity-architecture",
          panes: [
            {
              ref: "pane:54",
              surfaces: [{ ref: "surface:58", title: "π - pi-remote-diff-test" }],
            },
          ],
        },
      ],
    },
    {
      ref: "window:3",
      workspaces: [
        {
          ref: "workspace:22",
          title: "🔮 opportunity-lifecycle",
          panes: [
            {
              ref: "pane:56",
              surfaces: [{ ref: "surface:58", title: "⠐ Complete RevOps orchestrator handoff" }],
            },
          ],
        },
      ],
    },
  ],
};

test("task mode = just the task", () => {
  expect(buildSpawnPrompt("task", "  fix the bug  ")).toBe("fix the bug");
});

test("scoped mode prepends orchestrator summary when given", () => {
  const p = buildSpawnPrompt("scoped", "do X", { parentSummary: "we decided Y" });
  expect(p).toContain("Context from the orchestrator:");
  expect(p).toContain("we decided Y");
  expect(p).toContain("do X");
});

test("scoped mode without summary falls back to task", () => {
  expect(buildSpawnPrompt("scoped", "do X")).toBe("do X");
});

test("full mode references the orchestrator session to continue the thread", () => {
  const p = buildSpawnPrompt("full", "continue", {
    parentSummary: "history so far",
    parentSessionPath: "/s.jsonl",
  });
  expect(p).toContain("Full context");
  expect(p).toContain("/s.jsonl");
  expect(p).toContain("continue that thread");
});

test("parseSpawnSurface extracts the surface ref", () => {
  expect(parseSpawnSurface("spawned: pi in surface:88")).toBe("surface:88");
  expect(parseSpawnSurface("no surface here")).toBe(null);
});

test("canonicalizeCwd resolves a symlinked path (regression: /tmp -> /private/tmp)", () => {
  const resolver = (p: string) => (p === "/tmp/foo" ? "/private/tmp/foo" : p);
  expect(canonicalizeCwd("/tmp/foo", resolver)).toBe("/private/tmp/foo");
});

test("canonicalizeCwd falls back to the literal path when unresolvable", () => {
  const resolver = () => {
    throw new Error("ENOENT");
  };
  expect(canonicalizeCwd("/does/not/exist", resolver)).toBe("/does/not/exist");
});

test("findRegistryWorkspace disambiguates a colliding surface number by cwd (regression: same bare surface live in two workspaces simultaneously)", () => {
  const registry = {
    "default/surface:58": { surface_ref: "surface:58", cwd: "/tmp/mine", registered_at: 200 },
    "workspace:26/surface:58": { surface_ref: "surface:58", cwd: "/other/project", registered_at: 100 },
  };
  expect(findRegistryWorkspace(registry, "surface:58", "/tmp/mine")).toBe("default");
  expect(findRegistryWorkspace(registry, "surface:58", "/other/project")).toBe("workspace:26");
});

test("findRegistryWorkspace returns null when the surface isn't found", () => {
  expect(findRegistryWorkspace({}, "surface:99", "/x")).toBe(null);
});

test("extractCmuxTitles reads surface titles keyed by workspace, and workspace names", () => {
  const titles = extractCmuxTitles(SAMPLE_TREE);
  expect(titles.bySurfaceKey.get("workspace:1/surface:58")).toBe("π - pi-remote-diff-test");
  expect(titles.bySurfaceKey.get("workspace:22/surface:58")).toBe(
    "⠐ Complete RevOps orchestrator handoff"
  );
  expect(titles.byWorkspaceRef.get("workspace:1")).toBe("🦷 opportunity-architecture");
  expect(titles.byWorkspaceRef.get("workspace:22")).toBe("🔮 opportunity-lifecycle");
});

test("findTreeWorkspace resolves the canonical workspace:N ref for a surface, disambiguating by which workspace actually contains it (regression: registry's 'default' alias never matches cmux's own tree ref scheme)", () => {
  expect(findTreeWorkspace(SAMPLE_TREE, "surface:58")).toBe("workspace:1"); // first match, matches applyCmuxTitles' precedence
});

test("findTreeWorkspace returns null when the surface isn't in the tree yet (just spawned, pane not rendered)", () => {
  expect(findTreeWorkspace(SAMPLE_TREE, "surface:999")).toBe(null);
  expect(findTreeWorkspace(null, "surface:58")).toBe(null);
});

test("extractCmuxTitles degrades to empty maps on malformed/missing input, never throws", () => {
  expect(extractCmuxTitles(null).bySurfaceKey.size).toBe(0);
  expect(extractCmuxTitles({}).bySurfaceKey.size).toBe(0);
  expect(extractCmuxTitles({ windows: "not an array" }).bySurfaceKey.size).toBe(0);
  expect(extractCmuxTitles({ windows: [{ workspaces: [{ ref: "w", panes: "nope" }] }] }).bySurfaceKey.size).toBe(0);
});

function mkAgent(overrides: Partial<SpawnedAgent> = {}): SpawnedAgent {
  return {
    id: "a1",
    parentId: null,
    label: "original task text",
    cwd: "/x",
    contextMode: "task",
    surface: "surface:58",
    workspace: "workspace:1",
    runtime: "pi",
    status: "active",
    spawnedAt: 0,
    ...overrides,
  };
}

test("applyCmuxTitles overrides label + adds workspaceLabel from cmux's own names", () => {
  const titles = extractCmuxTitles(SAMPLE_TREE);
  const [out] = applyCmuxTitles([mkAgent()], titles);
  expect(out.label).toBe("π - pi-remote-diff-test");
  expect(out.workspaceLabel).toBe("🦷 opportunity-architecture");
});

test("applyCmuxTitles disambiguates the identical bare surface number across workspaces (regression)", () => {
  const titles = extractCmuxTitles(SAMPLE_TREE);
  const [inFirst, inOther] = applyCmuxTitles(
    [mkAgent({ workspace: "workspace:1" }), mkAgent({ id: "a2", workspace: "workspace:22" })],
    titles
  );
  expect(inFirst.label).toBe("π - pi-remote-diff-test");
  expect(inOther.label).toBe("⠐ Complete RevOps orchestrator handoff");
});

test("applyCmuxTitles falls back to the original label when cmux has nothing for that surface (tree call failed, or just spawned)", () => {
  const empty = extractCmuxTitles(null);
  const [out] = applyCmuxTitles([mkAgent()], empty);
  expect(out.label).toBe("original task text");
  expect(out.workspaceLabel).toBeUndefined();
});

test("applyCmuxTitles is a no-op passthrough for agents with no surface/workspace (never crashes on foreign/legacy entries)", () => {
  const titles = extractCmuxTitles(SAMPLE_TREE);
  const agent = mkAgent({ surface: null, workspace: null });
  const [out] = applyCmuxTitles([agent], titles);
  expect(out).toEqual(agent);
});
