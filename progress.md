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

## Card log (append one line per completed card)
- (none yet — Phase 0 not started)
