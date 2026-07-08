import { expect, test } from "bun:test";
import {
  applyCmuxTitles,
  buildAmbientAgents,
  buildSpawnPrompt,
  canonicalizeCwd,
  enumerateTerminalSurfaces,
  extractCmuxTitles,
  findRegistryWorkspace,
  findTreeWorkspace,
  matchRuntimeFromArgs,
  parseSpawnSurface,
  parseTtyRuntimes,
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
              surfaces: [
                { ref: "surface:58", title: "π - pi-remote-diff-test", type: "terminal", tty: "ttys045" },
              ],
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
              surfaces: [
                {
                  ref: "surface:58",
                  title: "⠐ Complete RevOps orchestrator handoff",
                  type: "terminal",
                  tty: "ttys046",
                },
              ],
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

test("enumerateTerminalSurfaces lists every terminal surface with its tty, across windows", () => {
  const surfaces = enumerateTerminalSurfaces(SAMPLE_TREE);
  expect(surfaces).toEqual([
    { workspaceRef: "workspace:1", surfaceRef: "surface:58", tty: "ttys045" },
    { workspaceRef: "workspace:22", surfaceRef: "surface:58", tty: "ttys046" },
  ]);
});

test("enumerateTerminalSurfaces degrades to empty array on malformed/missing input", () => {
  expect(enumerateTerminalSurfaces(null)).toEqual([]);
  expect(enumerateTerminalSurfaces({ windows: "nope" })).toEqual([]);
});

test("matchRuntimeFromArgs recognizes each known agent CLI", () => {
  expect(matchRuntimeFromArgs("/Users/nicholasgarza/.local/bin/pi --session x")).toBe("pi");
  expect(matchRuntimeFromArgs("pi")).toBe("pi"); // bare, exactly as observed live
  expect(matchRuntimeFromArgs("/Users/nicholasgarza/.nvm/.../bin/codex")).toBe("codex");
  expect(matchRuntimeFromArgs("/opt/homebrew/bin/claude-yolo")).toBe("claude");
  expect(matchRuntimeFromArgs("python3 -m hermes_cli.main gateway run")).toBe("hermes");
  expect(matchRuntimeFromArgs("/Users/nicholasgarza/bin/cursor-agent")).toBe("cursor-agent");
  expect(matchRuntimeFromArgs("/Users/nicholasgarza/bin/agy")).toBe("antigravity");
});

test("matchRuntimeFromArgs does not false-positive on an unrelated plain shell", () => {
  expect(matchRuntimeFromArgs("-/bin/zsh")).toBe(null);
  expect(matchRuntimeFromArgs("/usr/bin/login -q -flp nicholasgarza /bin/bash")).toBe(null);
});

test("matchRuntimeFromArgs ignores an incidental env-var mention (regression: the wrapper line that launches EVERY session, including pi ones, contains the literal string 'claude-yolo' in an unrelated CMUX_CUSTOM_CLAUDE_PATH env var — only the deepest/actual process should ever be checked, not this wrapper line)", () => {
  const wrapperLine =
    "/bin/zsh -lic /usr/bin/env CMUX_CUSTOM_CLAUDE_PATH=/opt/homebrew/bin/claude-yolo /bin/zsh -lc { cd -- x } && /Users/nicholasgarza/.local/bin/pi --session y";
  // This documents the risk: the wrapper line DOES match "claude-yolo" if checked directly.
  // parseTtyRuntimes avoids this by only ever checking the deepest (highest-pid) process
  // per tty, never the wrapper line itself — covered in the next test.
  expect(matchRuntimeFromArgs(wrapperLine)).toBe("claude");
});

test("parseTtyRuntimes only matches the deepest (highest-pid) process per tty, avoiding the wrapper-line false positive", () => {
  const psOutput = [
    "  PID TTY      COMM           ARGS",
    " 2590 ttys033  /usr/bin/login /usr/bin/login -q -flp nicholasgarza /bin/bash",
    " 2738 ttys033  -/bin/zsh      -/bin/zsh",
    " 3359 ttys033  /bin/zsh       /bin/zsh -lic CMUX_CUSTOM_CLAUDE_PATH=/opt/homebrew/bin/claude-yolo /bin/zsh -lc pi",
    "19421 ttys033  pi             pi",
  ].join("\n");
  const result = parseTtyRuntimes(psOutput);
  expect(result.get("ttys033")).toEqual({ runtime: "pi", pid: 19421 });
});

test("parseTtyRuntimes finds the matching agent even when a later, non-agent subprocess has a higher pid (regression: a Claude Code session's MCP server children, or an until-done loop's periodic 'sleep' heartbeat, can fork with a higher pid than the actual agent process itself — 2026-07-08, revops-architect and opportunity-lifecycle were both silently dropped from the live agent list because the OLD logic picked whichever process had the highest pid on the tty first, THEN checked if it matched anything; here that was 'sleep 1', which matches no runtime, so the whole tty vanished even though a real agent was running on it)", () => {
  const psOutput = [
    "  PID TTY      COMM           ARGS",
    " 5531 ttys008  /usr/bin/login /usr/bin/login -q -flp nicholasgarza /bin/bash",
    " 5536 ttys008  -/bin/zsh      -/bin/zsh",
    " 8096 ttys008  -/bin/zsh      -/bin/zsh",
    " 8098 ttys008  pi             pi",
    "26028 ttys008  sleep          sleep 1",
  ].join("\n");
  expect(parseTtyRuntimes(psOutput).get("ttys008")).toEqual({ runtime: "pi", pid: 8098 });
});

test("parseTtyRuntimes omits a tty whose deepest process isn't a known agent (idle shell)", () => {
  const psOutput = ["  PID TTY      COMM           ARGS", "58287 ttys046  -/bin/zsh      -/bin/zsh"].join("\n");
  expect(parseTtyRuntimes(psOutput).has("ttys046")).toBe(false);
});

test("parseTtyRuntimes ignores processes with no controlling terminal ('??')", () => {
  const psOutput = ["  PID TTY      COMM           ARGS", "  100 ??       python3        python3 -m hermes_cli.main"].join(
    "\n"
  );
  expect(parseTtyRuntimes(psOutput).size).toBe(0);
});

test("buildAmbientAgents surfaces a terminal running a known agent CLI that isn't already known", () => {
  const titles = extractCmuxTitles(SAMPLE_TREE);
  const surfaces = enumerateTerminalSurfaces(SAMPLE_TREE);
  const ttyRuntimes = new Map([["ttys045", { runtime: "pi", pid: 111 }]]);
  const agents = buildAmbientAgents(surfaces, ttyRuntimes, new Set(), titles, () => "/Users/nicholasgarza/repos/pi-remote");
  expect(agents.length).toBe(1);
  expect(agents[0]).toMatchObject({
    id: "workspace:1/surface:58",
    workspace: "workspace:1",
    surface: "surface:58",
    runtime: "pi",
    label: "π - pi-remote-diff-test", // cmux's own title, same overlay as everywhere else
    cwd: "/Users/nicholasgarza/repos/pi-remote",
  });
});

test("buildAmbientAgents skips a surface already known (in the store or registry), and one with no matching tty runtime", () => {
  const titles = extractCmuxTitles(SAMPLE_TREE);
  const surfaces = enumerateTerminalSurfaces(SAMPLE_TREE);
  const known = new Set(["workspace:1/surface:58"]);
  const ttyRuntimes = new Map([["ttys046", { runtime: "claude", pid: 222 }]]);
  const agents = buildAmbientAgents(surfaces, ttyRuntimes, known, titles, () => null);
  // workspace:1 is already known (skipped); workspace:22's tty has no runtime match... wait it does (ttys046).
  expect(agents.map((a) => a.id)).toEqual(["workspace:22/surface:58"]);
});

test("buildAmbientAgents only resolves cwd (via lsof) for pi-runtime matches — other runtimes don't need it (steer works without a cwd)", () => {
  const titles = extractCmuxTitles(SAMPLE_TREE);
  const surfaces = enumerateTerminalSurfaces(SAMPLE_TREE);
  const ttyRuntimes = new Map([["ttys046", { runtime: "claude", pid: 222 }]]);
  let resolverCalled = false;
  const agents = buildAmbientAgents(surfaces, ttyRuntimes, new Set(), titles, () => {
    resolverCalled = true;
    return "/should-not-be-used";
  });
  expect(resolverCalled).toBe(false);
  expect(agents[0].cwd).toBe("");
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
