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
- [ ] **3.2 Bridge multi-process.** Refactor bridge.ts single `pi` → `Map<agentId,{child,stdin}>`;
  per-process stdout reader tags events with agentId; response routing scoped by agentId.
  Verify: WS smoke — two agents spawned, each client sees only its agent's events; no cross-talk.
- [x] **3.3 Spawn-on-demand (cmux path).** Bridge `spawn_agent {cwd, task, contextMode, parentId}`
  shells to `cmux-agent spawn` (real cmux pane), records lineage. Client spawn sheet. (Full N
  `pi --mode rpc` bridge-owned processes = 3.2, still to do; cmux path chosen per Nik's ask.)
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

---

## Sequencing
Phase 1 and 2 are independent and low-risk — run them first for visible progress. Phase 3 is
the multi-session arc; 3.1 and 3.4 are pure functions (fast TDD wins) that de-risk the bridge
refactor before it touches live processes. Commit after every green card.
