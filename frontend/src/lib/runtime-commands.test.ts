import { describe, expect, test } from "bun:test";
import { commandsForRuntime, RUNTIME_COMMANDS } from "./runtime-commands";

const piCmds = [{ name: "new", description: "from rpc" }];

describe("commandsForRuntime", () => {
  test("pi runtime returns the live RPC list", () => {
    expect(commandsForRuntime("pi", piCmds)).toBe(piCmds);
  });

  test("terminal runtimes return their static catalog", () => {
    expect(commandsForRuntime("claude", piCmds)).toBe(RUNTIME_COMMANDS.claude);
    expect(commandsForRuntime("hermes", piCmds)).toBe(RUNTIME_COMMANDS.hermes);
    expect(commandsForRuntime("codex", piCmds)).toBe(RUNTIME_COMMANDS.codex);
  });

  test("unknown or missing runtime returns empty (no picker)", () => {
    expect(commandsForRuntime("cursor-agent", piCmds)).toEqual([]);
    expect(commandsForRuntime(undefined, piCmds)).toEqual([]);
  });

  test("catalogs have unique, slash-free names", () => {
    for (const list of Object.values(RUNTIME_COMMANDS)) {
      const names = list.map((c) => c.name);
      expect(new Set(names).size).toBe(names.length);
      for (const n of names) expect(n.startsWith("/")).toBe(false);
    }
  });
});
