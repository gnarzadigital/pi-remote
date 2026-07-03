import { expect, test } from "bun:test";
import { isJunkWorkspace } from "./workspace-filter";

const HOME = "--Users-nicholasgarza--";

test("hides junk workspaces", () => {
  for (const junk of [
    "----",
    HOME,
    "--Users-nicholasgarza-.codex-memories--",
    "--private-tmp--",
    "--private-tmp-cmux-agent-live-smoke--",
    "--private-tmp-claude-501--Users-nicholasgarza-Projects-x-scratchpad-cmux-fix-verify--",
  ]) {
    expect(isJunkWorkspace(junk, HOME)).toBe(true);
  }
});

test("keeps real project workspaces", () => {
  for (const real of [
    "--Users-nicholasgarza-Projects-gnarza-digital-projects-airtable-assignment--",
    "--Users-nicholasgarza-Projects-gnarza-digital-clients-clerri--",
    "--Users-nicholasgarza-Documents--",
  ]) {
    expect(isJunkWorkspace(real, HOME)).toBe(false);
  }
});
