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

## Phase 1 — Calm Console design (hermes parity)  [dep: 0.1, 0.2]
- [ ] **1.1 Split typography.** Assistant prose → `--font-serif`; user bubbles + UI → sans;
  keep mono for code/paths. Edit `components/ui/message.tsx` / `conversation-view.tsx`.
  Verify: screenshot — assistant text serif, user bubble sans; tsc + build clean.
- [ ] **1.2 Console theme in settings.** Add "Console" option to `settings-panel.tsx` theme
  picker; wire `bridge.setTheme("console")`; persist in `pi-remote-theme`.
  Verify: screenshot — selecting Console applies warm palette, survives reload.
- [ ] **1.3 Frosted headers.** `backdrop-blur` + translucent bg on `.screen-header` (index.css).
  Verify: screenshot — header blurs content scrolling under it.
- [ ] **1.4 Quiet Activity row.** Collapse multi-tool turns to one "Activity: N tools" disclosure
  in `conversation-view.tsx` (tighten existing `Steps`); persist open/closed per turn.
  Verify: screenshot — a 3-tool turn shows one row; expand reveals tools; tsc + build clean.
- [ ] **1.5 Transcript de-shadow.** Remove routine shadows in transcript; hairline borders only.
  Verify: screenshot diff; grep shows no `shadow-` on transcript cards.

## Phase 2 — Picot features (mobile-relevant)  [independent of Phase 3]
- [ ] **2.1 Session search.** Add a search field to `sessions-view.tsx` filtering by name +
  (bridge) content. Add bridge `search_sessions` RPC scanning session jsonl (see Picot /api/search).
  Verify: bun test on the match/highlight fn; WS smoke returns hits; screenshot highlights.
- [ ] **2.2 Inline diff viewer.** Render agent edit tool-results as add/remove diff blocks.
  New `lib/diff-parse.ts` + `components/ui/diff.tsx`; map in `tool-part-mapper.ts`.
  Verify: bun test on diff-parse (unified-diff → lines); screenshot of a real edit; build clean.
- [ ] **2.3 Message queuing.** Queue sends while `streaming`; flush on `agent_end`. Edit
  `input-area.tsx` + `pi-bridge-client.ts`.
  Verify: bun test on queue drain logic; manual: type mid-stream, confirm flush order.
- [ ] **2.4 Context-window meter.** Render used/cached/free from `get_session_stats` in the
  chat header/overflow. New `components/context-meter.tsx`.
  Verify: bun test on token math; screenshot with real stats.
- [ ] **2.5 Voice input.** webkitSpeechRecognition mic button in `input-area.tsx`, live transcript
  into the composer. LOCAL only — assert no cloud endpoint.
  Verify: manual on device (Safari); tsc + build clean; grep shows no cloud STT url.
- [ ] **2.6 Git branch in header.** Bridge `get_git_branch` (exec `git branch --show-current`
  in cwd) → show in chat header.
  Verify: WS smoke returns branch; screenshot shows it.

## Phase 3 — Mobile multi-agent / cmux (flagship)  [dep: research done]
Build A-mechanics first (3.1–3.5), then cmux + context (3.6–3.9).
- [ ] **3.1 Broker envelope + routing (pure).** New `broker-route.ts`: given a command + a
  `Map<sessionId,port>` + live-port set, return target port | undeliverable, per Picot rules
  (session route → sourcePort hint → active fallback only if ≤1 live). No bridge wiring yet.
  Verify: bun test — the F3/F4 cases (2+ live refuses to guess; 1:1 eviction on switch_session).
- [ ] **3.2 Bridge multi-process.** Refactor bridge.ts single `pi` → `Map<agentId,{child,stdin}>`;
  per-process stdout reader tags events with agentId; response routing scoped by agentId.
  Verify: WS smoke — two agents spawned, each client sees only its agent's events; no cross-talk.
- [ ] **3.3 Spawn-on-demand RPC.** Bridge command `spawn_agent {cwd, contextMode, parent}` that
  starts a `pi --mode rpc` for that cwd/session and registers it. contextMode stubbed to "task".
  Verify: WS smoke — spawn returns agentId; get_state on it works.
- [ ] **3.4 Lineage graph (pure).** New `lineage.ts`: bridge-owned spawn graph (agentId→parent),
  merge with a `cmux tree`/registry snapshot into a nested tree model.
  Verify: bun test — orchestrator→2 children→1 subagent nests correctly; orphans handled.
- [ ] **3.5 Nested session picker.** Render the lineage tree in `sessions-view.tsx` under the
  current workspace: orchestrator → agents → subagents, live status per node. Extends existing grouping.
  Verify: screenshot — a spawned agent appears nested with a status dot; tsc + build clean.
- [ ] **3.6 cmux spawn wiring.** On spawn_agent, also run `cmux-agent spawn --agent pi --prompt
  <brief> --cwd <cwd>` and record the returned surface + parent in lineage.
  Verify: WS smoke + `cmux-agent list` shows the pane; picker node links to it.
- [ ] **3.7 Context-handoff modes.** Implement Full (`fork`/`clone`), Task (`new_session`+prompt),
  Scoped (`compact`+fork) in spawn_agent; spawn sheet UI selector; picker badges the mode.
  Verify: bun test on mode→RPC-sequence mapping; screenshot of sheet + badges.
- [ ] **3.8 Attach + steer.** Tap a picker node → attach client to that agentId; send steer/
  follow-up; render its live chat. Reuse existing chat UI keyed by agentId.
  Verify: manual — switch between two agents, each keeps its own stream; steer reaches the right one.
- [ ] **3.9 Done-protocol from mobile.** Show done/awaiting-confirm status; confirm/close button
  runs `cmux-agent confirm`. Poll registry for status.
  Verify: WS smoke — done → confirm closes pane + updates picker.

---

## Sequencing
Phase 1 and 2 are independent and low-risk — run them first for visible progress. Phase 3 is
the multi-session arc; 3.1 and 3.4 are pure functions (fast TDD wins) that de-risk the bridge
refactor before it touches live processes. Commit after every green card.
