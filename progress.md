# PROGRESS — pi-remote

## 2026-07-03 — Sessions/org overhaul (shipped, uncommitted)
- Killed global Inbox; sessions stay in workspace folder with unread dot.
- Bridge junk-workspace filter (workspace-filter.ts + test). 378→153 sessions, 38→25 ws, 0 junk.
- Unread = agent-finished-while-away only (dropped mtime flood).
- Default-collapse non-current workspaces (current stays open); two-set model.
- Verified: live WS query, build:ui, tsc, bun test 2/2. NOT screenshotted (browser-picker).

## 2026-07-03 — Roadmap authored
- GOAL.md, PLAN.md (loop-executable cards), findings.md (3 research agents) written.
- Model decision: C (hybrid) built A-first. Context-handoff modes folded in.
- Next: commit shipped org work, then start Phase 1 card 0.1 via ralph-loop.

## Test/gate reference
- Gate: `bun test && (cd frontend && npx tsc --noEmit -p tsconfig.app.json) && pnpm run build:ui`
- Bridge restart after bridge.ts changes: `pi-remote-online restart`
- WS smoke pattern: /tmp/ws-check.ts (list_sessions over ws://127.0.0.1:7700)

## 2026-07-03 — Phase 2 + Phase 3 (most) shipped
Phase 2 complete (2.1 search, 2.2 diff viewer, 2.3 queuing, 2.4 context meter, 2.5 voice,
2.6 git branch) — all gate-green + WS-smoke where applicable.
Phase 3: 3.1 broker-route, 3.3 spawn (cmux), 3.4 lineage, 3.5 nested picker, 3.6 cmux wiring,
3.7 context modes, 3.9 done-protocol — done. 3.8 steer done (RPC-attach partial).
REMAINING (highest-risk): 3.2 bridge N-process RPC refactor (touches LIVE bridge), 3.8-full
RPC chat-attach. Foundation (broker-route.ts) tested and ready. Recommend fresh-context loop.

## Card log (append one line per completed card)
- 0.1/0.2 theme foundations — commit 6126cf6 (gate green)
- 1.1-1.5 Calm Console design — commit 459d00d (gate green; visually verified in Console theme:
  serif assistant prose confirmed, 3-option theme picker, warm palette, org tree intact)
- Visual QA on Browser 1 (deviceId 082b1780) @ 390x844. Sessions org fix also confirmed live:
  airtable/assignment expanded at top with 9 sessions, other workspaces collapsed, no Inbox/junk.
