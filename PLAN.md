# PLAN — pi-remote parity + mobile multi-agent (loop-executable)

Goal: see GOAL.md. Research + architecture: see findings.md.
Chosen model: **C (hybrid), built A-first** — bridge-broker + nested picker core, then wire cmux.

## How to run this
Loop runner: `ralph-loop` (pick next unchecked card → build → Verify → validation gate → commit → loop).
Escalate Phase 3 bridge cards to `/until-done` (TDD contract). One card = one iteration.

**Validation gate (run after every card, must be green):**
```
cd ~/repos/pi-remote && \
  bun test $(find . -name '*.test.ts' -not -path '*/node_modules/*') && \
  (cd frontend && npx tsc --noEmit -p tsconfig.app.json) && \
  pnpm run build:ui
```
(Scope `bun test` to `*.test.ts` — Playwright e2e uses `*.spec.ts` under qa/ and runs
separately via `pnpm playwright`; plain `bun test` wrongly globs both + dep tests.)
UI-touching cards additionally require a browser screenshot check (ui-verification rule).
Bridge cards additionally require a WS smoke pass (extend /tmp/ws-check.ts).

Status: [ ] todo · [~] wip · [x] done · [!] blocked. Cards are ordered; respect deps.

---

## Phase 0 — Foundations
- [x] **0.1 Serif + theme tokens.** `--font-serif` (Georgia stack) added; `Theme` type
  ("light"|"dark"|"console") in lib/types.ts; `applyTheme()` helper in lib/utils.ts applies
  `.dark`+`.theme-console`; App.tsx + client use it.
- [x] **0.2 Console theme tokens.** `.theme-console` block (parchment #EAE0D5 on #0A0908,
  surface #22333B, hairline #3B4A50) added after `.dark`; console session-row overrides.
  Verify: bun 2/2, tsc clean, build clean.

## Phase 1 — Calm Console design (hermes parity)  [dep: 0.1, 0.2]  — gate green, visual verify pending
- [x] **1.1 Split typography.** Assistant prose → serif (text-[15px]/1.6 font-serif) with
  prose-code/pre pinned mono; user bubble explicit font-sans. conversation-view.tsx.
- [x] **1.2 Console theme in settings.** Console option (Terminal icon) added to the 3-col
  theme grid in settings-panel.tsx; `bridge.setTheme("console")`; persists.
- [x] **1.3 Frosted headers.** `.screen-header` now translucent (color-mix 78%) + backdrop
  blur/saturate; removed opaque bg-canvas from the header element.
- [x] **1.4 Quiet Activity row.** Multi-tool disclosure relabeled "Activity · N tools", quieter.
- [x] **1.5 Transcript de-shadow.** Already compliant — transcript cards are border-based; only
  shadow is the floating ScrollButton (allowed by DESIGN.md). No change needed.

## Phase 2 — Picot features (mobile-relevant)  [independent of Phase 3]
- [x] **2.1 Session search.** Bridge `search_sessions` greps name + jsonl content (2MB cap,
  40-hit cap), returns hits with a snippet. sessions-view has a debounced search bar; results
  render as a flat list with the query highlighted. Verify: WS smoke — "airtable" 27 hits (name),
  "opportunity lifecycle" hits with real content snippets. Gate green.
- [x] **2.2 Inline diff viewer.** `lib/diff-parse.ts` (parseEditArgs for pi edit/write oldText/
  newText + LCS lineDiff + diffStat, O(m*n) capped at 2000 lines) + `components/ui/diff.tsx`
  (collapsed +/- summary, expands to colored add/del lines). conversation-view routes edit/write
  blocks to DiffView, falls back to generic Tool if args unparseable. diff-parse.test.ts (5 tests).
  Verify: gate green (16/16). Live diff render pending on-device.
- [x] **2.3 Message queuing.** `shouldQueue()` (message-queue.ts + test) gates: plain prompt
  typed mid-stream with no images → queued; steer/follow-up/images send now. Client holds a
  FIFO `messageQueue`, flushes one on `agent_end`; `queuedMessages` in snapshot; cancel-able
  chips above composer. Also excluded `*.test.ts` from tsconfig.app so co-located tests don't
  break tsc/build. Gate green (6/6). Live queued-chip visual pending on-device stream.
- [x] **2.4 Context-window meter.** `context-meter.tsx` renders used/max token bar + % + cost
  in the overflow menu, reusing message-utils token math (getContextUsedTokens /
  getModelContextWindowTokens). message-utils.test.ts covers the math. Gate green (9/9).
- [x] **2.5 Voice input.** `lib/speech.ts` typed wrapper over webkitSpeechRecognition (no `any`);
  mic button in composer dictates live transcript into the input. speech.test.ts covers the
  transcript join. Gate green (11/11); grep confirms no cloud STT endpoint. Device test pending.
- [x] **2.6 Git branch in header.** Bridge `get_git_branch` (execSync `git branch --show-current`
  in CWD); client fetches on connect; shown as a GitBranch subtitle under the chat title.
  Verify: WS smoke returns {"branch":"master"}; gate green.

## Phase 3 — Mobile multi-agent / cmux (flagship)  [dep: research done]
Build A-mechanics first (3.1–3.5), then cmux + context (3.6–3.9).
- [x] **3.1 Broker envelope + routing (pure).** `broker-route.ts`: `resolveRoute(cmd, routes,
  liveAgents)` — explicit agentId → session route → single-live fallback → refuse-to-guess when
  2+ live; `setRoute` keeps sessionId→agent 1:1. broker-route.test.ts (7 tests incl F3/F4).
- [x] **3.2 Bridge multi-process.** Done — see the full writeup below (ADDITIVE N-process
  RPC agents alongside the untouched primary pi). Superseded this stub.
- [x] **3.3 Spawn-on-demand (cmux path).** Bridge `spawn_agent {cwd, task, contextMode, parentId}`
  shells to `cmux-agent spawn` (real cmux pane), records lineage. Client spawn sheet.
- [x] **3.4 Lineage graph (pure).** `lineage.ts`: `buildAgentTree(agents)` nests
  orchestrator→agents→subagents by parentId, promotes orphans/self-parents to roots, assigns
  depth; `flattenTree` for list rendering. lineage.test.ts (4 tests).
- [x] **3.5 Nested session picker.** `agents-panel.tsx` renders the depth-indented agent tree in
  the sessions view (Agents section above workspaces): status dot (active/awaiting/done),
  context-mode badge, steer + confirm actions, spawn sheet. Polls list_agents every 5s while
  live. Verify: screenshot — Agents section renders with spawn +; gate green. Nested indentation
  by depth confirmed in code; live nesting shows once agents are spawned.
- [x] **3.6 cmux spawn wiring.** `spawnAgent` runs `cmux-agent spawn --agent pi --prompt <brief>
  --cwd <cwd>`, parses the surface ref (parseSpawnSurface, tested), records surface + parent.
- [x] **3.7 Context-handoff modes (prompt-shaping).** `buildSpawnPrompt` maps Full/Task/Scoped to
  the spawn prompt (tested); spawn sheet has the 3-way selector with descriptions; picker badges
  each agent's mode. (True RPC fork/clone for Full = the deeper hybrid, ties to 3.2/3.8.)
- [~] **3.8 Attach + steer.** Steer works now via `send_to_agent` → `cmux-agent send` (mobile
  message input per agent node). Full RPC chat-attach (rich streaming per spawned agent) = the
  hybrid deep path, still to do (needs 3.2 N-process bridge).
- [x] **3.9 Done-protocol from mobile.** Picker shows active/awaiting-confirm/done via 5s status
  poll; a Check button on awaiting-confirm runs `confirm_agent` → `cmux-agent confirm`.

## Phase 3 complete. All cards below are done and verified.
- [x] **3.2 Bridge N-process RPC (ADDITIVE).** Primary single `pi` + its routing untouched.
  Added `Map<agentId,{proc,ws,sessionPath}>` for attachable RPC agents: `attach_agent
  {agentId, sessionPath}` spawns `pi --mode rpc --session <path>` with the shared
  PI_SPAWN_ENV; per-process stdout reader tags events `{type:"agent_event", agentId, event}`
  sent ONLY to the attaching client (no broadcast); `agent_command`/`detach_agent` handlers;
  torn down on WS close via detachAgentsForClient. Routes via broker-route.resolveRoute.
  Verify: WS smoke — attached a real session, received 2 tagged agent_event frames + clean
  detach; primary path (list_sessions, pi alive) confirmed unregressed. Gate green.
- [x] **3.8-full RPC chat attach (UI).** Tapping an agent's label in the picker now:
  resolves its pi session file (agents.ts `resolveAgentSessionPath`, matches newest .jsonl
  under the agent's cwd slug modified at/after spawn), attaches an RPC process to it
  (existing 3.2 path), and opens a new `agent-chat` view rendering its live tagged
  `agent_event` stream — reusing ConversationView's turn-block rendering via new optional
  `lines`/`streaming` override props (agent-turn-reducer.ts, a pure fold of agent_start/
  agent_end/message_update/tool_execution_* into ChatLine[], mirrors the primary client's
  logic; 6 unit tests incl. the "last thinking block" case). Extension permission dialogs
  from an attached agent route through the SAME ExtensionDialog UI, tagged with agentId so
  the response goes back to that agent instead of the primary pi (real gap found + fixed
  during e2e testing — these dialogs are pi's normal extension-confirmation flow, not
  something safe to auto-bypass).
  Verify: FULL LIVE END-TO-END — spawned a real pi agent, resolved its session file, attached,
  injected a prompt through the exact `sendToAttachedAgent` code path, observed agent_start →
  streamed text ("pong") → agent_end, all correctly tagged/routed. Gate green (38/38, tsc,
  build). Primary chat path confirmed unregressed throughout. Test agents cleaned up after.
  Known scope limit: only one attached agent's dialog can show at a time (shares the single
  `extensionDialog` snapshot field with the primary session) — acceptable for this ship,
  noted for later if it proves to matter.

## Fixes from live device feedback (2026-07-03, same session)
- [x] Empty-state hero: brand-new sessions no longer show a blank body + bottom-pinned input
  (the reported "black gap"). Centered π mark + greeting + composer when !activeSessionPath.
- [x] Fixed a latent bug the hero exposed: useChatBottomInset only attached once (stable ref
  dep) — added an `active` toggle so it re-attaches when the dock mounts later.
- [x] Header decluttered: Stop button only renders while streaming (was an always-visible
  disabled ghost icon).
- [x] Agents picker was pi-remote-spawned-only; now surfaces the FULL cmux registry across
  every runtime (verified live: 9 real claude/codex sessions appear as roots).

## /validate deep functional check (2026-07-03) — 3 real bugs found + fixed
Ran the `/validate` skill properly (claude-in-chrome, no chrome-devtools MCP available in
this env): render/console/network on every surface, interaction sweep, and live e2e spawns
to exercise 2.2/3.2/3.8-full end to end rather than trusting unit tests alone. Full report:
`.validate/reports/report-2026-07-03-multi-agent-deep-check.md`.

- [x] **BUG (build pipeline): code-block chunk deleted every build.** `post-build.mjs`'s
  stale-asset cleanup scanned only index.html + CSS for "keep" refs, missing any chunk only
  reachable via runtime `import()` (markdown.tsx's lazy code-block load). Result: 20 real
  console exceptions ("Failed to fetch dynamically imported module") on every session with
  markdown content, every single build, silently, since this cleanup script was introduced.
  Fix: `vite.config.ts` `build.manifest: true` + post-build.mjs reads `.vite/manifest.json`
  as ground truth for every chunk a build actually emits. Verified: 0 exceptions on the exact
  navigation that threw 20 before; confirmed a genuinely-new build still discards genuinely
  stale hashes (correct behavior preserved).
- [x] **BUG (diff-parse.ts schema): real pi edit-tool shape never matched.** My original
  `parseEditArgs` assumed flat `{oldText, newText}`. A real live edit tool call captured
  during e2e testing showed pi's actual shape: `{"path":...,"edits":[{oldText,newText}, ...]}`
  — a batch array. The diff viewer silently fell back to the generic tool card on every real
  edit call. Fixed `parseEditArgs`/`ParsedEdit` to handle the batch shape (flat shape kept as
  a normalize-to-single-element fallback for `write`/legacy); `diff.tsx` renders one labeled
  hunk ("EDIT 1 OF 2" etc.) per edit. Verified live: real session shows scratch.txt +3/-1 with
  two correctly-labeled hunks, plus a second new-file.txt card — full visual confirmation.
- [x] **BUG (agents.ts): cmux surface numbers collide across workspaces.** Confirmed live:
  the identical bare "surface:58" existed simultaneously in two different cmux workspaces.
  Every agents.ts function treated surface as globally unique — status refresh, the
  known/foreign dedup set, and critically `sendToAgent`/`confirmAgent` (steer/confirm) never
  passed `--workspace`, so a steer/confirm action could silently target the wrong agent.
  Fixed: capture `workspace` at spawn time (`findRegistryWorkspace`, matches by surface+cwd
  against the live registry immediately post-spawn); `listAgents()` keys status-refresh and
  dedup by the registry's own `workspace/surface` composite key; `sendToAgent`/`confirmAgent`
  accept and pass `--workspace`; threaded end-to-end through bridge.ts and the frontend
  (`AgentTreeNode.workspace`, `steerAgent`/`confirmAgent` client methods, agents-panel.tsx).
  Verified live: confirm via the bridge stuck on the FIRST attempt post-fix (previously needed
  a manual retry with an explicit `--workspace` flag to take effect).
- Also cleaned up: 3 leftover test session files + 6 leftover test cmux agents created during
  this and earlier e2e verification (confirmed the RIGHT ones after correctly distinguishing
  them from pre-existing entries that predate this session).

Gate green throughout (43/43 tests, tsc, build). Bridge restarted multiple times; primary
chat path confirmed unregressed at every step.

## Agent naming — single source of truth (2026-07-03)
Nik flagged that cmux's own tab titles and pi-remote's Agents panel showed different names
for the same agent. Root cause: pi-remote invented its own naming (frozen task-text slice at
spawn) instead of reading the name cmux already tracks and displays. Fix, applying the
explicit engineering rules given (solve at the right layer, simplest viable form, reject
complexity without value, reuse existing patterns, don't guess load-bearing facts, one
best-fit path):

- [x] **cmux's own live title becomes the display name, read-only.** `agents.ts` now also
  calls `cmux --json tree --all` (structured, first-class cmux output — not scraping text)
  inside the existing `listAgents()` poll, alongside the already-existing `cmux-agent list
  --all` call. `extractCmuxTitles` (pure) builds `workspace/surface -> title` and
  `workspace -> human name` maps; `applyCmuxTitles` (pure) overlays them onto the display
  label, falling back to the original label when cmux has nothing yet. Never writes back to
  cmux — read-only was the correct call (rejected bidirectional sync: no concrete value,
  adds a write-path failure mode for zero gain). Rejected capturing pi's `setTitle` RPC event
  instead: only covers the one currently-attached agent (0 or 1 at a time), not the common
  case of agents just sitting in the list.
- [x] **BUG found mid-implementation, fixed at the actual layer:** `cmux-agent`'s registry
  sometimes reports a workspace as the alias `"default"` for a workspace cmux's own tree
  JSON only ever calls `"workspace:N"` (confirmed live — same pane, two different ID
  schemes). This silently broke every title lookup keyed by workspace ref. Fixed by adding
  `findTreeWorkspace` (pure) and using it at spawn time to resolve the CANONICAL
  `workspace:N` ref directly from cmux's own tree, before ever falling back to the
  registry's `findRegistryWorkspace`. This is the same root layer as the earlier
  cross-workspace-collision fix, tightened further: `.workspace` is now always in the one
  format every consumer (title lookup, send, confirm) actually needs.
  Assumption flagged: cmux's tracked title is a snapshot per poll, not confirmed continuously
  live-updating mid-task — still strictly fixes the reported mismatch either way.
- Workspace's human name (e.g. "🦷 opportunity-architecture") now shows as a subtitle under
  the agent name in the picker, reusing the same call — same PR, no extra cost.
- No icon-for-runtime change bundled (separate visual concern, not the naming bug — flagged
  as a distinct, optional future item, not built).

Verified live: fresh real spawn shows `workspace: workspace:1` (canonical, not "default"),
`label: π - pi-remote` (cmux's own title, not the frozen task text), `workspaceLabel: 🦷
opportunity-architecture` — confirmed via WS smoke and a live picker screenshot across
multiple real agents/workspaces (opportunity-architecture, gmux, gws-auth, boomcloud), zero
console errors. 8 new unit tests (51/51 total pass), tsc clean, build clean.

## "Can't click into my sessions under Agents" (2026-07-03)
Reported by Nik, reproduced exactly: tapping any agent NOT spawned by pi-remote itself
(i.e. most of what's in the list — pre-existing claude/codex/ambient-pi agents from cmux)
did nothing at all, with zero visible feedback. Two real, distinct bugs, both fixed:

- [x] **`resolveAgentSessionPath` only worked for pi-remote's own spawns.** It looked up
  `store[agentId]`, but foreign agents (the majority) are never persisted there — they're
  synthesized fresh from the cmux registry on every poll. Fixed by decoupling the function
  from the store entirely: it now takes `cwd`/`spawnedAt` directly, both already present on
  every `AgentTreeNode` the client already has. Works identically for a self-spawned or a
  fully ambient pi agent. Verified live: attached to "π - pi-remote", an agent pi-remote never
  spawned — header shows LIVE, composer works, no errors.
- [x] **`statusError` was set on failure but never rendered anywhere.** So even the
  "not ready yet" fallback message was 100% silent — a tap on a claude/codex agent (which
  fundamentally can't attach a pi-RPC chat, different protocol entirely) just looked like
  nothing happened. Added: a `runtime` field (`SpawnedAgent`/`AgentInfo`/`AgentTreeNode`,
  set at spawn and for foreign entries) + `canAttachChat(runtime)` (pure, tested) routes
  the tap correctly — pi agents attach the rich chat, everything else opens the steer input
  instead (the one action that works for any runtime via `cmux send`). Also made
  `statusError` visible in the Agents panel so any future failure isn't silent again.
- Also found and fixed in passing: the backend (`agents.ts`/`bridge.ts`/`lineage.ts`) has
  no tsconfig and had never been type-checked all session (only bun's transpile-and-run,
  which doesn't type-check) — a real type mismatch (`AgentInfo.surface` didn't accept `null`,
  which `SpawnedAgent.surface` actually is) had been silently present. Fixed; spot-checked
  the backend with `frontend/node_modules/.bin/tsc` directly (no new tsconfig introduced —
  noted as a gap, not solved, out of scope for this bug).

Verified live: tapped the exact "claude · clients/clerri" row that previously did nothing —
now opens the steer input correctly. Tapped "π - pi-remote" (ambient, not self-spawned) —
now attaches and opens the live chat correctly. 54/54 tests pass (5 new), frontend + backend
tsc clean, build clean, zero console errors on both paths.

## Ambient agent discovery — surface every terminal session, not just registered ones (2026-07-03)
Nik clarified the actual goal: pi-remote should surface ANY agent terminal session running in
cmux (codex, hermes, claude code, pi, cursor-agent, antigravity), not just ones spawned via
`/cmux-agents` or hooked into cmux-agent's registry. Measured the real gap first: **46 live
terminal panes existed in cmux, the registry only actively tracked 5.**

- [x] **Detection is independent of cmux-agent's registry/hooks entirely.** For every terminal
  surface in `cmux --json tree --all`, resolve its `tty`, then ask the OS what's actually
  running there via a single system-wide `ps -eo pid,tty,args` call (grouped by tty client-side —
  one call, not N). Verified real binary paths before matching (not guessed): pi, codex,
  claude (aliased to claude-yolo), hermes (a Python shebang — matched via args, comm alone
  shows "python3"), cursor-agent, antigravity (via its "agy" alias). "zcode" was investigated
  and found to not be a persistent binary at all (the real `zai-coding`/`zai` scripts are
  one-shot, non-interactive) — not built, flagged instead of guessed.
- [x] **Real bug found and fixed during verification: matching the whole process chain gives
  false positives.** cmux's own launch wrapper sets a `CMUX_CUSTOM_CLAUDE_PATH` env var
  containing the literal string "claude-yolo" in EVERY session's command line — including ones
  actually running pi. Fixed by only ever matching the DEEPEST (highest-pid) process per tty,
  never the wrapper chain in front of it. Regression-tested with the exact wrapper line that
  would have false-positived.
- [x] **Operational risk found and fixed: the new shell-outs would have periodically stalled
  the live chat.** Measured the real latency (~350-400ms for tree+ps combined) and confirmed
  bridge.ts is a single-process event loop where `execFileSync` blocks it entirely — a ~400ms
  stall every 5s poll would have hit the ACTIVE pi chat's streaming too. Fixed with a 10s TTL
  cache around the expensive, knownKeys-independent data (tree+ps); the cheap per-call
  filtering still runs fresh every time. Verified live: first call 125-155ms, cached calls
  67-96ms — no longer a noticeable stall.
- [x] **Data-integrity bug found and fixed in passing:** 8 pre-existing store entries (my own
  earlier test spawns, persisted before the `runtime` field existed) showed up as
  `runtime: undefined`. Fixed the root cause (`load()` now backfills a sensible default for
  any legacy entry missing a since-added field, not just this one instance) and cleaned the
  stale data. Also hardened the status-refresh loop: it was missing status updates for
  self-spawned agents whenever cmux-agent's registry re-keyed the same surface under the
  "default" alias after spawn (the same alias inconsistency as the earlier workspace-collision
  fix, but recurring — extended the existing legacy-entry fallback to always apply, not just
  when `.workspace` was unset).
- cwd for ambient agents (needed only for pi-runtime attach; steer needs nothing) is resolved
  via `lsof -a -d cwd -p <pid>`, called only for pi matches — verified working live.

Verified live: agent count went from ~11 (registry-only) to 30 real agents (after cleaning up
my own 8 stale test entries) to 38 (before cleanup) — a real, large, confirmed coverage
increase. Zero `runtime: undefined` after the backfill fix. Zero console errors. 65/65 tests
pass (11 new), frontend + backend tsc clean, build clean, cache verified reducing latency from
~400ms (uncached) to 67-155ms (measured across repeated live calls).

---

## Sessions redesign: unified next-action inbox + workspace picker + iOS composer fix (2026-07-04/05)
Nik asked to rethink the sessions screen after direct confusion complaints ("how do I message
a conversation I can't see", "what does Task mean", "what's the paper plane"). Deep research
across Claude Agent View, Codex, Cursor, Devin/Jules/Copilot/Factory converged on one answer:
a single list grouped by next-action, not a stacked accordion. Locked with Nik: unified inbox
(Needs you / Working / Ready for review / Recent chats), no blind steer — tap opens the FULL
conversation (Nik explicitly rejected a "peek" preview sheet).

- [x] **Unified next-action inbox** replacing the Agents-accordion-over-session-groups layout.
  `frontend/src/lib/inbox.ts` (pure grouping/filtering logic, tested), `agent-inbox.tsx`,
  `agent-inbox-row.tsx` (runtime badge, status glyph, unread dot). Removed the paper-plane
  steer, the Task/Scoped/Full row chip, and the standalone Agents accordion header.
- [x] **Open full conversation, not a preview.** pi-runtime agents open the existing rich RPC
  chat; terminal-runtime agents (codex/claude/hermes/cursor via cmux) open a new full-screen
  `agent-terminal-view.tsx` using `cmux capture-pane` (with scrollback) + a reply box that
  steers the pane. Auto-refreshes every 3s but only auto-scrolls if the user is already at the
  bottom (real bug found: it used to yank you back down while reading).
- [x] **Ghost-agent bug found and fixed.** "Could not read this pane" on tap was stale
  `cmux-agent` registry entries (dead panes from old test spawns under the "default" workspace
  alias). Fixed by filtering `listAgents()` to only surfaces present in the LIVE cmux tree, and
  deduping when the same live pane arrives from both the registry and the ambient-discovery
  path.
- [x] **Workspace/directory picker for new sessions.** `workspace-picker.tsx` + backend
  `list_dirs` command (bridge.ts) — browses the real filesystem from Home, with shortcuts.
  Confirmed pi's RPC protocol has NO chdir/cwd command (checked the actual package's rpc-mode
  command list) — cwd is fixed per-process, so a folder pick respawns `pi --mode rpc` in the
  new cwd (`respawnPi()`), re-bootstraps, then creates the session there. Verified live via a
  real WS round-trip: `git_branch` after respawn returned the NEW workspace's branch. Scoped to
  new-session-only per Nik's choice (no mid-session directory change, which would kill a live
  chat).
- [x] **Per-agent model picker.** Existing `ModelPickerAction` made reusable (`onPick`/
  `activeModel` override) and added to the agent-chat composer, routing `/model` to that
  specific agent via `agent_command` — not just the primary session.
- [x] **iOS composer black-bar bug — root cause, not cosmetic.** Five compounding causes, all
  fixed (full detail in Claude memory `pi-remote-ios-bottom-bar-root-cause-fix`, kept there
  since it's a "never regress this" rule, not just a changelog entry):
  1. Double bottom padding (dock + nested footer both padding — was ~42px).
  2. `interactive-widget=resizes-content` in the viewport meta broke iOS layout-viewport
     restore after keyboard close — removed (hermes-webui, the working reference, omits it).
  3. `agent-chat-view.tsx`'s composer was in normal document flow, not a fixed dock like the
     primary chat — converted to the same `chat-bottom-dock` pattern.
  4. **Real "won't even start" bug:** `index.html` had no `Cache-Control`, so a phone could
     cache an old HTML pointing at a JS hash `post-build.mjs` had since pruned → 404 on the
     main bundle → blank/frozen PWA. Fixed: `index.html`/`sw.js`/`manifest.json` → `no-cache`;
     `/assets/*` → `immutable`. `sw.js` CACHE_NAME bumped through the fix cycle (now v12).
  5. Verification itself was the root problem — early "fixed" claims came from Chrome desktop
     `visualViewport` overrides, which doesn't reproduce real Mobile Safari/PWA behavior.
     Installed Playwright's real WebKit engine (`playwright install webkit`) and added
     `qa/webkit-composer-bottom.spec.ts` (iPhone device descriptor, real rendering engine) as
     the new minimum bar for any future iOS layout claim. Nik confirmed fixed live on his
     actual iPhone.
- Also fixed in passing: serif font removed app-wide (assistant prose was accidentally
  Georgia-serif; now Inter sans everywhere, `--font-serif` aliased to the sans stack so nothing
  can drift back), Prompt/Steer mode chip replaced with queue-by-default + explicit Interrupt
  action while streaming.

Verified: 71 unit tests + 7 Playwright specs (including the new real-WebKit one) green. Core
chat send→stream→receive verified live over a real WS round-trip. Everything on branch
`redesign/sessions-inbox`, checkpoint-committed 2026-07-05.

---

## iOS composer bug — ACTUAL root cause + final fix (2026-07-06)

**Correction to the record above:** the "iOS composer black-bar bug" item logged 2026-07-04/05
as fixed with "Nik confirmed fixed live on his actual iPhone" was real progress but NOT the
full fix — it regressed, because none of that session's verification (Chrome, Playwright
WebKit, even Safari-in-Simulator) can render Apple's real standalone-PWA WKWebView mode. Full
honest postmortem in Claude memory `debugging-enumerate-research-reference-first`.

**The actual root cause, found by reference-diffing Hermes WebUI's CONTAINER (not just its
CSS):** Apple's "installed standalone app" WKWebView display mode itself — entered via
`apple-mobile-web-app-capable` + manifest.json `display: standalone` — has multiple
documented, CSS-unfixable WebKit bugs: `position:fixed` breaking after a viewport recalc,
`100dvh` mismeasuring, and (caught via new device telemetry) `window.innerHeight` silently
diverging from `window.screen.height` by 62px with zero DOM-visible cause. Hermes WebUI's
`index.html` has ZERO app-install metadata — it never enters that mode at all, which is why
it never hit any of these bugs.

- [x] **Removed `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style`**
  from `frontend/index.html`; changed `frontend/public/manifest.json`'s `display` from
  `"standalone"` to `"browser"` — matching Hermes exactly. Trade-off accepted: "Add to Home
  Screen" now opens plain Safari chrome instead of a borderless fullscreen look.
- [x] **Dropped the `env(safe-area-inset-bottom)` padding on `.chat-bottom-dock`** — another
  reference-diff finding (Hermes's composer has zero such padding; the one `env()` usage in
  its whole codebase is explicitly non-chat-route-scoped).
- [x] **Added `pwa-container.test.ts`** (repo root, `bun test`) — mechanical regression guard:
  fails immediately if the meta tag or standalone display mode ever comes back.
- [x] **Added permanent device telemetry** (`diag-overlay.tsx`) — the app POSTs its real
  layout geometry to `/api/diag` on every load, logged to `/tmp/pi-remote-diag.jsonl`, so any
  future device-only layout bug is diagnosable without a screenshot round-trip.
- [x] **`sw.js` rewritten network-only** (v18+) — no `fetch` handler at all, purges old caches
  on activate. This is a LAN/tailnet tool, always online in use; caching was pure downside and
  was independently causing "still on the old build" confusion throughout this saga.

**Confirmed fixed on Nik's real iPhone (2026-07-06), this time via device telemetry, not a
screenshot.** Tagged `ios-standalone-fix-2026-07-06`. Full incident + regression rules in
Claude memory: `pi-remote-ios-bottom-bar-root-cause-fix`, `pi-remote-must-test-on-real-iphone`,
`debugging-enumerate-research-reference-first`. Cross-project rule promoted to
`~/.agents/RULES.md` ("Research + Reference-Diff BEFORE Hypothesizing") and synced to every
agent runtime.

---

## Sequencing
Phase 1 and 2 are independent and low-risk — run them first for visible progress. Phase 3 is
the multi-session arc; 3.1 and 3.4 are pure functions (fast TDD wins) that de-risk the bridge
refactor before it touches live processes. Commit after every green card.

---

## Phase 4 — assistant-ui port hardening + feature adoption (feat/assistant-ui-port only)

**Scope guard (non-negotiable for every card below):** work only in this worktree
(`~/repos/pi-remote-port`), branch `feat/assistant-ui-port`. Never edit, build, or restart
anything in `~/repos/pi-remote` (the live checkout serving the launchd bridge on :7700 — Nik's
phone talks to that process). Never merge to `main`. Commit + push to `origin
feat/assistant-ui-port` per card; never force-push.

**Validation gate (must be green before any commit):**
```
cd ~/repos/pi-remote-port && \
  bun test $(find . -name '*.test.ts' -not -path '*/node_modules/*') && \
  (cd frontend && npx tsc --noEmit -p tsconfig.app.json) && \
  pnpm run build:ui
```
UI-touching cards additionally run the relevant `qa/*.spec.ts` Playwright specs. Real-device
keyboard checks (checklist section 2) are out of scope for this headless loop — label anything
that needs them "unverified for keyboard interaction (device-only)" instead of claiming done.

**Self-review pass (every card, before the gate):** re-read your own diff once, adversarially,
as if reviewing a stranger's PR. For this domain (React/TS chat UI over a stateful WebSocket)
the recurring failure modes already found in this phase are: state not re-synced against a
live poll, a cleanup/finalize path missing on one of several exit routes (disconnect vs normal
end vs error), a queue/flag never cleared on a side-door state transition, and a response
handler not correlated to its request. Check for those specifically before running the gate,
not just "does it compile."

- [x] **4.0 Bug hunt on the ported chat shell (repeats until dry).** Each pass: run the full
  gate above, then actively probe the assistant-ui-backed transcript/composer for behavior gaps
  vs. the pre-port UI — message ordering, scroll/focus on new messages, error/disconnect states,
  reconnect handling, tool-card/diff rendering through the line-id lookup, terminal-agent view,
  queue-while-streaming. Fix anything real, commit, and append one line to
  `.ralph-state/bug-hunt-log.txt`: `FOUND: <one-line bug>` or `DRY`. Only mark this card `[x]`
  once the log's last two lines both read `DRY`. Until then it stays `[ ]` and gets picked again.
- [x] **4.1 Edit-and-resubmit / regenerate last reply.** Wire `ExternalStoreRuntime`'s `onEdit`/
  `onReload` against the existing bridge send path; add the UI affordance on user + assistant
  messages (reuse existing icon/button patterns, don't invent a new visual language).
- [x] **4.2 Inline tool-approval prompts — implemented.** Nik's decision (2026-07-07): option
  (a) from the open question below — re-skin the EXISTING `ExtensionDialog` gate to render
  inline in the transcript instead of as a modal, no new bridge/pi protocol. Implementation: pi's
  `extension_ui_request` methods observed in `pi-bridge-client.ts` are `setStatus`/`setWidget`/
  `setTitle` (no-ops, already filtered out), `notify` (fire-and-forget, already auto-acked), and
  `input`/`editor`/`confirm` — there is no separate server-side tag distinguishing "tool
  permission" from other blocking asks within that remaining set, so all of them (the actual
  gate that blocks pi) now render inline; this is the honest reading of "the subset that are
  tool-permission prompts vs other extension UI uses" given what pi actually sends. Added
  `InlineExtensionDialog` in `pi-chat-shell.tsx`, rendered as the last item in
  `AssistantChatShell`'s transcript, scoped to primary-session dialogs only (`!d.agentId`) —
  attached-agent dialogs (`AgentChatView`, not part of the assistant-ui port) keep using the
  existing modal. "Turn position" anchor: simply the end of the transcript, since pi blocks the
  current turn on this response so nothing else can arrive above it meanwhile. `ExtensionDialog`
  (the global modal in `App.tsx`) now no-ops when `!d.agentId && isSpikeMode() && snapshot.view
  === "chat"` — i.e. whenever `AssistantChatShell` is actually the thing on screen and owns this
  dialog — so there's no double-render; non-spike `ChatView`, `AgentChatView`, and the sessions
  view are unaffected. Gate green: 120/120 bun tests, clean `tsc --noEmit`, `pnpm run build:ui`.
  No qa/*.spec.ts covers extension dialogs; not a composer/keyboard change.
- [x] **4.3 Keyboard shortcuts + accessibility pass.** Arrow-key composer history recall; verify
  assistant-ui's exposed ARIA roles/focus management are actually wired through our custom
  renderers, not just present in the primitives we didn't touch. Arrow-key recall was already
  wired (`unstable_useComposerInputHistory` in `pi-composer.tsx`, present since the initial port).
  Audited every custom renderer against the primitive source in `node_modules/@assistant-ui`
  (CmdPicker's listbox/option roles, action buttons, composer input) and found two real gaps,
  both fixed: (1) `EditingMessage`'s edit textarea (`pi-chat-shell.tsx`) never set `autoFocus`
  (default `false` on `ComposerPrimitive.Input`), so clicking Edit never moved keyboard focus into
  the field; (2) the ported shell dropped `ChatScrollController`'s sr-only `aria-live` "still
  responding" announcer because it's coupled to `use-stick-to-bottom`'s context, which
  `ThreadPrimitive.Viewport` doesn't use — added `StreamingLiveRegion` as a dependency-free
  equivalent tied to `snapshot.streaming`. No Playwright spec needed (ARIA/focus change, not
  composer layout/keyboard geometry).
- [ ] **4.4 Thread/session switcher — RESOLVED, rescoped.** Nik's decision (2026-07-07): option
  (a) from the open question below — add a correlated `new_session` response in `bridge.ts`
  (mirror `rename_session`'s `id` → pending-map pattern, tracked in the open question) that
  reports the real session path once pi assigns one. THEN swap `AssistantChatShell` to
  `useRemoteThreadListRuntime` with a `RemoteThreadListAdapter` whose `initialize()` awaits that
  correlated response honestly (no client-side placeholder id — the earlier trace explicitly
  found that unsafe, don't reintroduce it). Two sub-steps, do both in this one card: bridge
  protocol change first (with its own test), then the runtime swap on top of it. Full gate
  (bun test + tsc + build:ui) after each sub-step, not just at the end.
- [x] **4.5 Markdown/syntax-highlighting renderer — implement.** Traced the actual pipeline
  first: message text never goes through assistant-ui's `MessagePrimitive.Content`/message-part
  tree at all — `pi-chat-shell.tsx`'s `ShellMessage` renders `ConversationLine` directly off the
  live `ChatLine` (deliberately, per its own comment, so the bespoke tool/diff renderers stay
  plug-ins). `@assistant-ui/react-markdown`'s `MarkdownTextPrimitive` reads its text via
  `useMessagePartText()`, which needs a message-part context we don't have. Fixed the gap with
  `@assistant-ui/react`'s own `TextMessagePartProvider` (an exported escape hatch that wraps an
  ad-hoc `{text, isRunning}` pair into that context for exactly this standalone case) — installed
  `@assistant-ui/react-markdown@0.14.5` (peer-compatible with the installed
  `@assistant-ui/react@0.14.26`) and rewrote `frontend/src/components/ui/markdown.tsx`'s
  `Markdown` component to wrap `TextMessagePartProvider` + `MarkdownTextPrimitive` instead of a
  hand-rolled `ReactMarkdown` + `marked.lexer` block-splitter. `Markdown`'s external API
  (`children`, `className`, `components`) is unchanged, plus one new `streaming?: boolean` prop
  wired from `block.streaming` at both call sites (`conversation-view.tsx`'s text blocks,
  `thinking-chain.tsx`'s reasoning items) so assistant-ui's built-in typewriter smoothing
  (`useSmooth`) only animates while actually streaming — non-streaming content still renders
  instantly, matching the old behavior exactly (verified in `useSmooth.ts`: `displayedText`
  initializes to the full text whenever `status !== "running"`). Code blocks now go through
  `MarkdownTextPrimitive`'s `SyntaxHighlighter` extension point (our existing shiki-based
  `code-block.tsx`, still lazy-loaded, same chunk) instead of overriding `code`/`pre` directly;
  inline code and the external-link `Source` popover and scrollable-table wrapper carried over
  unchanged since those are plain `components` overrides on the same underlying `react-markdown`.
  Removed the now-unused `marked` dependency. Diff hunks (`diff.tsx`) and tool cards (`tool.tsx`)
  were already markdown-free and untouched, per the card's own scope note. Gate green: 120/120
  bun tests, clean `tsc --noEmit`, `pnpm run build:ui` (code-block chunk still splits correctly).
  No qa/*.spec.ts is relevant (none cover markdown rendering); not a composer/keyboard change.
- [x] **4.6 Native slash-command / input-history — RESOLVED, keep current implementation.**
  Nik's decision (2026-07-07): decline to adopt the library's slash-command primitives — they're
  explicitly `Unstable_`-prefixed with proven doc/implementation drift within this one installed
  version (see the open question below for the trace). Composer-history half stays adopted
  (`unstable_useComposerInputHistory`, done in 4.3). `CmdPicker` stays as-is, no further action.

**4.4/4.5/4.6 completion rule:** these are IMPLEMENT cards, not evaluate-and-decide. "Ours is
already fine" is not a reason to skip — only a genuine hard blocker (a real incompatibility with
pi's data shape, a regression the gate catches and can't be fixed in-scope) is. Any such blocker
gets logged under `## Open questions for Nik` with specifics, and the card stays `[ ]` rather
than being marked done-by-skipping.

Each iteration: pick the first unchecked card above, do only that card's work, gate, commit,
push, log to `.ralph-state/iteration-log.md`, stop. No scope creep across cards.

**Stop conditions (in addition to the 3-strikes-per-card rule):** if a card requires a genuine
product decision this loop cannot make on its own (e.g. exactly which tool calls should require
approval in 4.2), do not guess — implement the safe default (off/no-op), note the open question
plainly in PLAN.md under a new `## Open questions for Nik` heading at the bottom of this file,
and move on to the next card.

## Open questions for Nik

**All three below RESOLVED by Nik (2026-07-07) via /decisions — see the rescoped 4.2/4.4/4.6
cards above for what to actually build. Kept the original analysis below for reference; do not
re-derive it.**

- **4.1 (edit/regenerate) — no true history rewind.** pi's bridge protocol (`bridge.ts`) only
  ever appends (`prompt`/`follow_up`/`steer`); there's no "forget this turn and everything after
  it" command, so the underlying agent process keeps whatever it already ingested. `onEdit` and
  `onReload` are wired to resubmit the edited/original text as a new prompt through the normal
  send path (same as typing a fresh message) rather than truly replacing the original turn in the
  agent's own context. The UI will show the edited text as a new message below the original, not
  in place of it. If you want a true rewind, the bridge protocol needs a new command that resets
  the agent session or otherwise drops trailing turns before resubmitting — flag if that's worth
  building.

- **4.2 (inline tool-approval prompts) — real gate already exists, isn't what the card assumes.**
  Traced the actual approval path before writing any UI: pi's own permission prompts already
  arrive as `extension_ui_request` events and are already rendered as a blocking modal
  (`ExtensionDialog`, wired through `pi-bridge-client.ts`'s `extensionDialog` state) — that IS the
  live gate; tools that need confirmation already pause on it today. Two things block building
  the card as written (an inline approve/deny control anchored to a specific tool card via
  assistant-ui's `onAddToolResult`):
  1. `ExtensionDialogState` (`types.ts`) has no `toolCallId` — it's a generic
     title/message/options/input/editor dialog, not correlated to any specific tool block in the
     transcript, so there's no key to anchor an inline control to.
  2. `tool_execution_start`/`tool_execution_end` events (bridge.ts) are pure fire-and-forget
     status updates; the bridge has no "pause this tool, wait for a response, then let it
     proceed" primitive for the general case. Worse, `handleCommand` in `bridge.ts` forwards
     every command type straight to `sendToPi(cmd)` with no allowlist — sending a made-up
     "approve/deny this tool call" command type down to the live pi process to build inert
     plumbing isn't safe, it just hands pi an unrecognized command it wasn't built to handle.
  Given that, "implement the plumbing behind a flag" isn't a safe no-op here the way it would be
  for a pure front-end feature — the only genuinely inert version of this card is documentation,
  which is what this entry is. Two real paths forward, need Nik's call:
  - (a) Re-skin the existing `ExtensionDialog` to render inline in the transcript (anchored by
    `agentId` + turn position) instead of as a modal, for the subset of `extension_ui_request`s
    that are actually tool-permission prompts (vs. other extension UI uses) — this reuses the
    real, already-working gate and needs no bridge/pi changes.
  - (b) A true `onAddToolResult`-style per-tool-call gate needs a new bridge+pi protocol
    (tag `tool_execution_start` with an "awaiting approval" state, add a real
    `approve_tool_call`/`deny_tool_call` command bridge.ts explicitly handles) — bigger, touches
    pi itself, not just this repo.
  Card 4.2 is marked `[!]` blocked pending this decision rather than `[ ]`, so future loop
  iterations skip it and move to 4.3 instead of re-deriving this same analysis.

- **4.4 (thread/session switcher) — `ThreadListPrimitive` needs a runtime primitive pi's
  protocol can't back.** Traced the actual mechanics before writing any UI, since "ours already
  works" isn't a valid reason to skip this card:
  1. `ThreadListPrimitive.Items`/`ItemByIndex` read from `useAssistantRuntime().threads`, a
     `ThreadListRuntime`. The only runtime factories in this `@assistant-ui/react@0.14.26`
     install that populate a real (switchable, multi-item) `.threads` are
     `useRemoteThreadListRuntime` and `useCloudThreadListRuntime` (the latter needs Assistant
     Cloud, not applicable here). Plain `useExternalStoreRuntime` — what `pi-chat-shell.tsx`
     uses today — backs `.threads` with `SingleThreadList`, a single fixed entry with no
     switch/list capability, so it can't drive a real switcher.
  2. `useRemoteThreadListRuntime` requires a `RemoteThreadListAdapter` with
     `initialize(threadId): Promise<{remoteId, externalId}>`. This fires whenever the runtime is
     on a not-yet-persisted local thread and a message is sent — which includes the app's default
     state: `threadId: undefined` ("switch to new thread") is exactly what a fresh session is
     today (`snapshot.activeSessionPath === null`), and that's the most common entry point, not
     an edge case (every "New chat" starts here).
  3. pi's bridge protocol has no correlated response for session creation:
     `bridge.ts`'s `new_session` handler (same-cwd path) never sends a `type: "response",
     command: "new_session"` success payload carrying the new session's path (contrast
     `rename_session`, which does correlate via `id` → `pendingRenames`), and
     `pi-bridge-client.ts`'s `handleResponse` switch has no `case "new_session"` at all. The
     frontend only ever learns a new session's real path later, indirectly, when the user
     manually reopens Sessions and the periodic `fetchSessions()` list happens to include it.
  4. A workaround — minting a client-side placeholder id in `initialize()` so the promise
     resolves — was considered and rejected: the real backend-assigned session would show up as a
     *second*, separate entry once `fetchSessions()` polls, while the live thread keeps pointing
     at the placeholder. That's precisely the "state not re-synced against a live poll" failure
     mode this phase's self-review pass exists to catch, not a safe no-op.
  Given that, swapping `AssistantChatShell`'s runtime to `useRemoteThreadListRuntime` isn't a
  contained UI change — it's blocked on a real protocol gap on the app's default path. Two paths
  forward, need Nik's call:
  - (a) Add a correlated `new_session` response in `bridge.ts` (mirror `rename_session`'s `id` →
    pending-map pattern) that reports the real session path once pi assigns one, so
    `initialize()` can await it honestly. Unblocks a full `ThreadListPrimitive` swap.
  - (b) Skip the full runtime swap; build a narrower switcher using `ThreadListPrimitive`'s
    presentational pieces against a hand-rolled list model (not `useRemoteThreadListRuntime`) that
    only ever operates on already-persisted sessions, explicitly excluding
    `ThreadListPrimitive.New` — functionally close to what `sessions-view.tsx` already does today,
    so the payoff over the existing UI would be mostly cosmetic.
  Card 4.4 is marked `[!]` blocked pending this decision, same pattern as 4.2.

- **4.6 (native slash-command adoption) — the primitive family is explicitly unstable and
  already drifting within this exact installed version.** Traced the real API in
  `node_modules/@assistant-ui/react@0.14.26` before writing any UI (composer-history half was
  already adopted in 4.3, this is only about the slash-command half). Findings:
  1. Every symbol involved — `ComposerPrimitive.Unstable_TriggerPopoverRoot`,
     `.Unstable_TriggerPopover`, `.Directive`, `.Action`, `.Unstable_TriggerPopoverItems`,
     `.Unstable_TriggerPopoverCategories`, and the convenience hook
     `unstable_useSlashCommandAdapter` — is `Unstable_`/`unstable_`-prefixed.
     `unstable_useSlashCommandAdapter`'s own JSDoc reads: "@deprecated Under active development
     and may change without notice."
  2. That same hook's own bundled usage example (`useSlashCommandAdapter.d.ts`) references
     `<ComposerTriggerPopover char="/" {...slash} />` — a component name that does not exist
     anywhere in this installed version's exports (confirmed via runtime introspection of
     `ComposerPrimitive`'s actual keys). The real name is
     `ComposerPrimitive.Unstable_TriggerPopover`. The API has already drifted out from under its
     own shipped docs within a single published version — concrete evidence "may change without
     notice" isn't just a boilerplate disclaimer here.
  3. Functionally, adopting it isn't a drop-in swap: `ComposerPrimitive.Input` does not wire
     trigger keyboard handling itself (confirmed by reading `ComposerInput.js` — no reference to
     the trigger module), so ArrowUp/Down/Enter/Escape navigation has to be manually delegated
     from our own `onKeyDown` to `resource.handleKeyDown()` via
     `unstable_useTriggerPopoverScopeContext()`, and trigger detection is cursor-position-based
     (`detectTrigger.js`), requiring manual `setCursorPosition()` calls on every selection change
     since our composer doesn't use `ComposerPrimitive.Root`/a wrapped input that tracks this
     automatically (deliberately, per `pi-composer.tsx`'s own comment: the pi chrome buttons
     aren't form-aware). That's a from-scratch reimplementation of keyboard nav and ARIA wiring
     this codebase already built and accessibility-audited in 4.3 (`CmdPicker`'s listbox/option
     roles), on top of an API region that isn't stable across its own current version.
  4. Adapter shape does fit conceptually (`categories()`/`categoryItems()`/`search()` can wrap
     `snapshot.commands`, and `Action.onExecute` with `removeOnExecute: true` could call
     `composer.setText(bridge.selectCommand(item.id))` to match pi's "insert `/name `, don't
     execute" behavior) — the blocker isn't a data-shape mismatch, it's shipping a
     constantly-used, load-bearing input path on a primitive family that documents itself as
     liable to change without notice and already has internal doc/implementation drift.
  Given that, this card stays `[!]` blocked rather than adopted. If Nik wants it anyway despite
  the instability, the adapter wiring in point 4 above is the concrete starting point for a
  future card.
