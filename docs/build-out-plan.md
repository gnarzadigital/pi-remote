# pi-remote: Build-Out Execution Plan

## Status: Core Loop WORKING (2026-06-29)
- pi RPC mode alive and responding (NODE_PATH fix)
- WebSocket bridge forwards commands/responses
- Send prompt -> agent_start -> agent_end verified end-to-end
- Per-line error boundaries prevent message-level crashes
- pi stderr noise filtered (only real errors reach chat)

---

## 1. Debug Loop Exit Criteria

Core chat is "done" when ALL of these pass on iPhone via Tailscale:

- [ ] Session list loads on app open (no infinite "Switching session...")
- [ ] Tapping a session loads its message history within 2s
- [ ] Typing a prompt + Send produces a user bubble immediately
- [ ] Assistant response streams in (text_delta events render live)
- [ ] Tool executions render as collapsible blocks
- [ ] Thinking/reasoning blocks render and expand
- [ ] No React crashes survive 10 minutes of continuous use
- [ ] No stderr noise appears in chat under normal load
- [ ] Abort button stops a streaming turn cleanly
- [ ] New session button creates and switches to a fresh session
- [ ] Switching between 3+ sessions keeps each scroll position

---

## 2. Available Loops and Task Mapping

| Loop | Strength | Best For |
|------|----------|----------|
| `/until-done` | TDD contract, cross-model judge | Feature build with verify command |
| `/loki-mode` | Fully autonomous RARV | End-to-end feature delivery |
| `/loop` (self-paced) | Periodic check-ins | Health monitors, drift detection |
| `loopflow_run` | Deterministic builder/reviewer gates | Code review feedback cycles |
| `isubagent` | Fire-and-forget parallel panes | Independent research/build tasks |
| `ralph-loop` | Pick-task-build-commit cycle | Backlog burn-down |

**Allocation:**
- Stabilization fixes -> `/until-done` (TDD, verified)
- New features -> `isubagent` parallel (3-4 panes) -> `loopflow_run` review gate
- Continuous design -> `/loop` 15m interval generating next task

---

## 3. Prioritized Feature Backlog (Claude/Codex/Cursor parity)

Ranked by Impact x (1/Effort). Higher = do first.

### Tier 1 — Critical UX (blocks daily use)
1. **Streaming token rendering fix** — text_delta must render live cursor. (Impact 10, Effort 2) -> SCORE 5.0
2. **Message persistence on reconnect** — keep history visible if WS drops. (Impact 9, Effort 3) -> 3.0
3. **Abort actually cancels** — confirm abort kills pi turn. (Impact 8, Effort 2) -> 4.0
4. **Markdown + code block rendering** — verify shiki lazy-loads, no FOUC. (Impact 9, Effort 3) -> 3.0
5. **Image attachment upload** — confirm base64 reaches pi. (Impact 7, Effort 2) -> 3.5

### Tier 2 — Power-User Features (Claude/Cursor parity)
6. **Slash command picker** — `/` opens command menu from pi get_commands. (Impact 8, Effort 3) -> 2.7
7. **Model picker dropdown** — switch models mid-session. (Impact 8, Effort 3) -> 2.7
8. **Session search/filter** — fuzzy search across session names. (Impact 7, Effort 3) -> 2.3
9. **Edit and resend last prompt** — Cursor-style edit. (Impact 7, Effort 4) -> 1.8
10. **Copy message / copy code block** — one-tap copy. (Impact 6, Effort 2) -> 3.0
11. **Branch/fork session** — Codex-style fork from any message. (Impact 6, Effort 5) -> 1.2

### Tier 3 — Multi-Agent Layer (the original goal)
12. **Specialist agent toggle chips** — sf-architect, sf-flow-master, etc. (Impact 10, Effort 6) -> 1.7
13. **Context-tagged routing** — tag each turn with active agents. (Impact 9, Effort 5) -> 1.8
14. **Trajectory display** — show which agent speaks per turn. (Impact 8, Effort 4) -> 2.0
15. **Project/workspace switcher** — dynamic AGENT_CWD per session. (Impact 8, Effort 5) -> 1.6

### Tier 4 — Polish
16. **PWA install + offline shell** — add manifest, service worker. (Impact 5, Effort 3) -> 1.7
17. **Push notifications** — already wired, needs UI toggle. (Impact 6, Effort 2) -> 3.0
18. **Dark/light theme toggle** — already in code, needs settings UI. (Impact 4, Effort 1) -> 4.0
19. **Haptic feedback polish** — already partial, standardize. (Impact 3, Effort 1) -> 3.0
20. **Token/cost display** — SessionStats already fetched. (Impact 5, Effort 2) -> 2.5

---

## 4. UI/UX Design Workflow (Continuous)

A `/loop` runs every 15 minutes generating the NEXT design task:

1. Reads current git diff + session-notes
2. Identifies the most-used screen with the weakest UX
3. Outputs ONE concrete task: "On screen X, change Y, because Z"
4. Appends to `.design-tasks/backlog.md`
5. Next available agent picks it up

**Living roadmap file:** `docs/design-roadmap.md` (created on first run)

---

## 5. Agent Swarm Feedback Prompt Template

Each parallel agent reports back with this structure:

```
TASK: <one-line description>
STATUS: done | blocked | in-progress
CHANGED: <files touched, comma-separated>
TESTS: <verify command + pass/fail>
SCREENSHOT: <path or "n/a">
BLOCKERS: <one line or "none">
NEXT: <suggested next task or "none">
COMMIT: <sha or "uncommitted">
```

Main orchestrator parses this, updates `docs/swarm-status.md`, and assigns next task.

---

## 6. Execution Order (Now)

Phase A (stabilize, serial):
1. Verify streaming token rendering on phone
2. Fix abort if broken
3. Confirm markdown/code blocks render

Phase B (parallel swarm, 3 panes):
- Pane 1: Tier 1 items 4-5 (markdown, images)
- Pane 2: Tier 2 item 6 (slash commands)
- Pane 3: Tier 2 item 10 (copy buttons)

Phase C (multi-agent layer):
- Tier 3 items 12-14 (the original Salesforce agent goal)

---

## Success Criteria
- [ ] Flawless core chat (Phase A exit criteria all green)
- [ ] Ranked roadmap living in docs/
- [ ] Self-sustaining design task pipeline
- [ ] Parallel swarm builds, tests, reports without manual intervention
