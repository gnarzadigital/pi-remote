# Session Notes — pi-remote Bug Fix Sprint

**Session:** 2026-06-29 (late night, pre-sleep)
**Repo:** `/Users/nicholasgarza/repos/pi-remote` (fork: `gnarzadigital/pi-remote`)
**Branch:** main (uncommitted)

## Bugs Fixed This Session

### Previously Fixed (earlier in session)
- **BUG-01** (HIGH): XSS in HTML export — `escapeHtml(b.text)` in `pi-bridge-client.ts:828`
- **BUG-02** (HIGH): Extension textarea can't clear — rewrote with `useEffect` keyed on dialog identity
- **BUG-03** (HIGH): localStorage thrash — module-level cache with invalidation on writes
- **BUG-05** (MED): Missing `get_state`/`get_available_models` on WS reconnect
- **BUG-06** (MED): Stale swipe offset closure — `offsetRef` useRef
- **BUG-11** (MED): `this.streaming` not cleared on WS disconnect
- **BUG-13/14** (MED): Touch targets too small — swipe buttons and rows to 44px min
- **BUG-H1** (HIGH): `focusout` listener leak in `use-visual-viewport.ts`
- **BUG-H2** (HIGH): Streaming cursor corrupting markdown — conditional JSX
- **BUG-H3** (HIGH): ReasoningContent conflicting maxHeight — removed inline style
- **BUG-M2** (MED): Mode chip inverted logic

### Fixed This Round (Loki Mode autonomous pass)
- **BUG-04** (HIGH): Tool events dropped after turn finalized — fallback path patches finalized turn blocks when `this.streaming` is null
- **BUG-M4** (MED): `thinking_delta` targeting first block — now finds LAST thinking block
- **BUG-M5** (MED): iOS blur delay closing CmdPicker — increased from 150ms to 300ms
- **BUG-M6** (MED): Mirrored steer/follow-up shown as user bubble — now shown as system messages
- **BUG-M3** (MED): Tool blocks using index keys — now use `block.id`
- **BUG-M1** (MED): Code block theme observer no cancellation guard — added `cancelled` flag
- **BUG-16** (MED): Rename not reverted on failure — fetches sessions on rename failure
- **BUG-10** (MED): Switch session failure leaves view stuck — reverts to sessions view
- **BUG-18** (LOW): Collapsible header touch target — min-h-[44px]
- **BUG-22** (LOW): "More" button touch target — min-h-[44px]
- **BUG-L2** (LOW): File input missing aria-label — added `aria-label="Attach image"`
- **BUG-L4** (LOW): Nested TooltipProvider (triple nesting) — removed inner providers from `prompt-input.tsx` and `message.tsx`
- **BUG-L7** (LOW): Dead `App.css` — deleted
- **BUG-H3 follow-up**: Fixed TS error in reasoning.tsx — `maxHeight` uses scrollHeight instead of `undefined`
- **BUG-H2 follow-up**: Fixed TS error — streaming cursor string concatenation for Markdown children type

### Skipped (not bugs / deferred)
- **BUG-07**: Partially addressed in extension-dialog rewrite
- **BUG-08**: Input `|| true` — already fixed in extension-dialog rewrite
- **BUG-09**: Feature request (notification/thinking toggle UI), not a bug
- **BUG-12**: Blob URL lifecycle — minor, handled at send time
- **BUG-15**: Workspace label "Workspace" fallback — data issue from bridge, working as designed
- **BUG-17**: Archived count stale — actually recomputes correctly via memo
- **BUG-19**: Desktop hover button size — already 44px from BUG-13/14 fix
- **BUG-20**: Double startStreamingTurn — correct behavior (agent_start replaces echoed prompt)
- **BUG-21**: 50ms focus delay — needed for iOS keyboard animation
- **BUG-L1**: `"use client"` directives — harmless in Vite (treated as comments)
- **BUG-L3**: Nested aria-live — different DOM subtrees, not actually nested
- **BUG-L5**: BlockGroup type — actually used, not dead
- **BUG-L6**: Inline styles — dynamic transforms/animations, can't be Tailwind classes

## Build Status
- `pnpm build` passes with zero errors
- Bridge serves at `http://localhost:7700` (HTTP 200)
- Tailscale: `https://mb-pro-max.tail62a752.ts.net:7700`

## Architecture Decision (BLOCKING)
**pi vs omp vs hybrid migration NOT yet decided by Nik.** This blocks the agent toggle feature work.

## Key Files
- `frontend/src/lib/pi-bridge-client.ts` — WebSocket client, all event routing
- `frontend/src/components/conversation-view.tsx` — message rendering
- `frontend/src/components/input-area.tsx` — prompt input + cmd picker
- `frontend/src/components/chat-view.tsx` — main chat layout

## Next Session
1. Commit and push the bug fixes
2. Get Nik's decision on pi vs omp
3. If staying on pi: design agent toggle UI + extend bridge RPC
4. Build context-tagged routing (Tier 1+2)
5. Build specialist agent chips (sf-architect, sf-flow-master, etc.)
6. Build trajectory display (which agent "speaks" per turn)
7. Mobile QA via phone (Tailscale URL)

---

# Session Notes — Sessions/Workspace Org Overhaul (2026-07-03)

## Problem (Nik report)
"Inbox all crazy" + "airtable-assignment isn't showing as its own group."

## Root cause (one bug, two symptoms)
- Bridge scanned all 38 dirs under ~/.pi/agent/sessions incl junk (tmp, scratchpad, home, .codex-memories, cmux-verify).
- "Unread" = mtime > lastRead+500 → every background agent write flagged a session unread.
- Unread sessions were HOISTED out of their workspace group into a global Inbox (excludePaths). WorkspaceFolderSection returns null when all items excluded → current workspace (airtable, freshly active) rendered empty/missing while the Inbox became a 42-session firehose.

## Changes
1. bridge: workspace-filter.ts (isJunkWorkspace) filters junk dirs. Wired in bridge.ts listSessionFiles. Unit test workspace-filter.test.ts (2 pass).
2. frontend: killed global Inbox. Deleted inbox-folder-section.tsx. Removed excludePaths → sessions stay in their workspace folder with unread dot.
3. frontend: unread = forced-only (agent-finished-while-away / manual), dropped mtime. session-read-state.ts isSessionUnread.
4. frontend: default-collapse non-current workspaces (current stays open). session-list-state.ts two-set model (collapsed + opened) + isWorkspaceCollapsed(slug, isCurrent). Wired in sessions-view.tsx.

## Verified
- Live bridge list_sessions: 378→153 sessions, 38→25 workspaces, 0 junk, airtable present as current with 9 sessions.
- build:ui clean, tsc --noEmit clean, bun test 2/2.
- NOT visually screenshotted (browser-picker friction). Confirm on phone via hard-refresh.

## Not committed yet. public/ rebuilt.

---

# Session Notes — 2026-07-03 (cmux peer handshake)

**Peer:** surface:54 (cmux-spawned).
**Changed:** nothing. No repo work performed this session — readiness/mailbox check only.
**Next:** awaiting orchestrator task assignment. No paths moved.

# Session Notes — 2026-07-03 (cmux peer handshake, surface:56)

**Peer:** surface:56 (cmux-spawned).
**Changed:** nothing. Readiness/connectivity check only (replied "pong" to orchestrator ping).
**Next:** awaiting task. No paths moved.

---

## Session 2026-07-03 — worker pane `surface:64` (workspace `default`)

**Task received:** `workspace-fix-verify`
**Outcome:** No work performed. Orchestrator sent `/exit` + DONE PROTOCOL before any state change. Task intent was never clarified or acted on.

**What I did (read-only):**
- `memory_search` x2 ("workspace-fix-verify workflow", "pi-remote workspace fix broken") — no actionable hits
- Read `git status`, recent `git log`, and the existing `_session-notes.md`

**What changed:** Nothing. No files written, no commits, no deletions, no moves.

**Repo state at exit (all pre-existing, NOT from me):**
- Branch `main`, **33 commits ahead of `origin/main`** (unpushed)
- Dirty tree: modified `bridge.ts`, `agents.ts`, `agents.test.ts`, `frontend/scripts/post-build.mjs`, `frontend/src/components/agents-panel.tsx`, `frontend/src/components/ui/diff.tsx`, `frontend/src/hooks/use-visual-viewport.ts`, `frontend/src/lib/diff-parse.test.ts`, `frontend/src/lib/diff-parse.ts`, `frontend/src/lib/pi-bridge-client.ts`, `frontend/src/lib/types.ts`, `frontend/vite.config.ts`, `public/index.html`, `scripts/pi-remote.sh`; deleted `public/assets/index-DBz6MXHa.js`
- Untracked: `bridge.ts.bak-20260703-125325`, `public/assets/code-block-DjOakUBt.js`, `public/assets/index-DGKVBtjO.js`, `scripts/pi-remote-online.sh`, `scripts/pi-remote-online.sh.bak-20260703-111139`, `scripts/pi-remote.sh.bak-20260703-111139`

**Next session (if task is still live):** "workspace-fix-verify" was never defined. Clarify with orchestrator which "workspace" — cmux workspace, the pi-remote repo working tree, or MacBook↔Mac Mini path parity — and what "fix" + "verify" should produce.

---

## Session 2026-07-06 — cmux project-lead cleanup from pi-remote pane

**Context:** Nik clarified the four active project contexts need durable lead orchestrators and asked to get the cmux/mesh state fixed and back on track.

**What changed:**
- Ran `pi update --extensions` successfully (`RC=0`).
- Updated `/Users/nicholasgarza/.agents/scripts/cmux-agent`:
  - `spawn` now accepts `--workspace` and sends/keys/captures inside that explicit workspace.
  - `confirm` now passes `--workspace` to `cmux send` / `send-key`, preventing accidental close of the wrong per-workspace `surface:NN`.
  - Wrapper syntax check passed and `test-cmux-agent-regression.sh` passed.
- Locked Rule 7 into `/Users/nicholasgarza/.agents/RULES.md` and synced via `sync-agent-rules.sh`: one active project = one cmux workspace = one durable lead pane; no cross-project default workspace mixing.
- Added the same project-lead topology guidance to `/Users/nicholasgarza/.agents/skills/cmux-agents/SKILL.md`.
- Cleaned stale `default` mesh entries for `surface:12` (airtable worker) and `surface:64` (this pane) using explicit `--workspace default`.
- Created/restored durable leads:
  - pi-remote: `workspace:12/surface:28` (Claude lead, cwd `/Users/nicholasgarza/repos/pi-remote`, `--keep`).
  - revops-architect: `workspace:13/surface:30` (Claude lead, cwd `/Users/nicholasgarza/Projects/gnarza-digital/infrastructure/agents/revops-architect`, `--keep`).
  - Crystal opportunity-lifecycle: status request sent to `workspace:10/surface:25`.
- Confirmed airtable-assignment `PLAN.md` status is `SUBMITTED (Greenhouse, 2026-07-01)`; treat as closeout-only unless Nik reopens it.

**What is next:**
- Use the new pi-remote lead at `workspace:12/surface:28` for all pi-remote work. It is currently alive and ready to own future worker spawns.
- Consolidate duplicate old pi-remote panes/workspaces only after Nik confirms which ones to close.
- Let each durable lead report `DONE / NEXT / BLOCKED`, then decide the next project action from those summaries.

**Moved paths:** none.

---

## Session 2026-07-06 — pi-remote cmux surface consolidation

**What changed:** Consolidated all visible pi-remote cmux surfaces into the official `workspace:12 "pi-remote"` workspace/window.

**Moved into `workspace:12`:**
- `surface:5` — old Pi pi-remote pane from duplicate `workspace:2`.
- `surface:10` — old Pi pi-remote pane from duplicate `workspace:7`.
- `surface:14` — old Claude/status pi-remote pane from duplicate `workspace:7`.
- Existing official lead remained `surface:28`.

**Closed duplicate workspaces:**
- `workspace:2 "π - pi-remote"`
- `workspace:7 "Pi-remote"`

**Current pi-remote topology:** `workspace:12` contains `surface:28`, `surface:5`, `surface:10`, and `surface:14` in one pane/window. No sessions were intentionally killed; this was a topology move/consolidation.

**Next:** Use `workspace:12/surface:28` as the official pi-remote lead. Review the older Pi panes (`surface:5`, `surface:10`) and old Claude/status pane (`surface:14`) before closing any of them.

---

## Session 2026-07-06 (evening) — lead consolidation complete, surface:14 is the durable lead

**Context:** Two Claude leads existed (surface:14 and surface:28). Handoff from Claude session 3e6d26d4 (iOS standalone fix, assistant-ui spike, launchd PATH fix 7e1d77f) was verified fully pushed: 0 local commits missing from origin on any branch; local main is fully contained in origin/redesign/sessions-inbox.

**What changed:**
- surface:28 (previous official lead), surface:5, and surface:10 (old Pi panes) were closed by Nik. workspace:12 "pi-remote" now contains only surface:14.
- **surface:14 is now the durable pi-remote lead** (Claude Code, session 05f36e4b, cwd ~/repos/pi-remote). Mesh registry workspace_12 updated to match.
- Committed this notes file (was the only dirty tracked file).

**Repo truth at close of consolidation:**
- redesign/sessions-inbox @ 7e1d77f, pushed, bridge running live off it (port 7700 healthy).
- spike/assistant-ui-shell @ 31b6c52, pushed, untouched.
- Untracked junk (.tmp/, *.bak-*, qa/_debug-single-click.spec.ts) left alone pending Nik.

**Next:**
1. Nik decision: merge redesign/sessions-inbox into main and push (closes the 52-commit divergence).
2. Then delete untracked junk.
3. Phone-verify latest UI build if not already done.

**Moved paths:** none.

**Update (same evening):** Next items 1 and 2 are done. main fast-forwarded to d9df549 and pushed (52-commit divergence closed; redesign/sessions-inbox fully merged, safe to delete). Untracked junk deleted (.tmp/, 3 *.bak files, qa/_debug-single-click.spec.ts). Checkout now on main; bridge verified serving the current bundle (index-B1hnrqIn.js) at 200. Remaining: phone hard-refresh check; bridge AGENT_CWD still points at airtable-assignment (closeout-only) — repoint when Nik picks the next active project.

**Update (later same evening):** Decisions locked via /decisions: D-1 redesign branch deleted (proven merged + backed up). D-2 bridge now boots into last-used workspace (boot-cwd.ts, prefs.lastCwd, b47a2d8, 77/77 tests, live-verified; seeded to gnarza-digital root). D-3 ADOPT @assistant-ui/react as chat-shell baseline; bug map confirmed the composer/keyboard area (8+ fix commits, 5 QA specs) is what the library owns. D-4 feature backlog deferred until the new baseline lands. Port worker spawned: surface:31 in workspace:12, working in a separate worktree ~/repos/pi-remote-port on branch feat/assistant-ui-port (live bridge checkout untouched), parity gated by the webkit-composer Playwright specs. Lead remains surface:14. Decision journal: ~/agency-brain/decisions/2026-07-06-pi-remote-direction.md.

---

## Session 2026-07-06 (night) — assistant-ui port worker (surface:31, workspace:12)

**What changed:** D-3 executed. Branch `feat/assistant-ui-port` (pushed, 4 commits on main+spike merge) in worktree `~/repos/pi-remote-port` — main checkout untouched, live bridge never restarted.

- `?spike=1` now renders the FULL AppShell with only ChatView's transcript+composer swapped to assistant-ui (`pi-chat-shell.tsx` + `pi-composer.tsx`). The standalone SpikeView page and the 8 unused CLI-generated assistant-ui components are deleted.
- Message list: ThreadPrimitive viewport owns streaming/scroll; every message renders through the untouched production `ConversationLine` (markdown, thinking chain, tool cards, diff viewer, banners) via line-id lookup.
- Composer: ComposerPrimitive.Input + composer.send() -> onNew -> production `bridge.sendMessage` (queue semantics intact). All chrome ported 1:1 (slash picker, queue chips, voice, thinking chip, model picker, interrupt, image attach). Dock stays the proven in-flow `.chat-bottom-dock` (NOT sticky ViewportFooter).
- Gotcha fixed: ComposerPrimitive.Input's Enter submit requires a ComposerPrimitive.Root form (`closest("form").requestSubmit()`); handled Enter directly via the runtime instead.

**Verified:** 4 parity specs (chat-keyboard, webkit-composer-bottom, webkit-composer-overflow, webkit-terminal-composer) 10/10 against the flagged build on a PORT=7701 worktree bridge AND 10/10 unflagged (production unregressed). bun 82/82 incl. pwa-container 3/3, tsc, build clean. Live e2e: transcript render + send round-trip proven with screenshots (`~/repos/pi-remote-port/.validate/evidence/spike-*`).

**Known gap (honest):** assistant STREAMING turn not visually verified live — pi under a session-spawned bridge fails anthropic auth (keychain is user-session-scoped; WS probe proved the prompt reaches pi, identical in flagged+production UIs). Verify streaming on the real 7700 bridge with `?spike=1` after merge, plus real-iPhone keyboard checks (checklist section 2).

**Next:** lead review of `feat/assistant-ui-port`, do NOT merge to main without review. Test bridge recipe: `cd ~/repos/pi-remote-port && PORT=7701 AGENT_CWD=~/repos/pi-remote bun run bridge.ts`.

**Moved paths:** none. New worktree: `~/repos/pi-remote-port` (branch feat/assistant-ui-port).

**Update (same session, surface:31):** Two additions on `feat/assistant-ui-port` @ 9cbbbb9 (pushed):
1. **Streaming gap CLOSED.** Root cause of the earlier no-reply: pi's anthropic OAuth is expired machine-wide (access token in ~/.pi/agent/auth.json expired 5 days ago, refresh failing). **Nik: run `/login anthropic` in any pi session — this affects the live 7700 bridge too.** Verified streaming live with the zai key instead: GLM-4.5 picked via the ported model picker on ?spike=1, streamed turn observed (evidence: .validate/evidence/spike-zai-*).
2. **Terminal slash commands remote (Nik request):** typing / in the agent-terminal-view reply box now shows that runtime's commands (claude/codex/hermes verified from primary sources; pi uses live RPC list). Tap inserts, send steers via cmux as before. Gate 86/86 + specs re-passed.
Note: found this worktree switched to `backup/20260706-pi-remote-port` mid-session (not by me); fast-forwarded feat/assistant-ui-port to match and switched back.

---

## Session 2026-07-07 (very early AM) — overnight ralph-loop launched on assistant-ui port

**Context:** Nik asked for a hands-off overnight loop: hunt+fix new UI/UX bugs from the assistant-ui port, then implement priority features from the assistant-ui library (researched via Context7 + GitHub). Full feature inventory given to Nik in chat (worth adding: edit-and-resubmit/regenerate, inline tool-approval prompts, keyboard/a11y pass, thread-switcher eval; explicitly skipped: paid Assistant Cloud, voice, attachments, other-backend adapters).

**What's running:** `~/repos/pi-remote-port/loop.sh` (background bash task `byqhdqgf2` in this pane), a raw Ralph loop calling `/opt/homebrew/bin/claude-yolo -p` fresh each iteration against `PROMPT_build.md`. Scoped ONLY to the `pi-remote-port` worktree on `feat/assistant-ui-port` — hard-blocked in the prompt from touching `~/repos/pi-remote` (live checkout, serves the :7700 launchd bridge) or merging to main. Caps: 40 iterations or 8h wall-clock, whichever first, plus a 3-strikes-per-card stuck rule that marks a card `[!]` blocked instead of looping forever.

**Work queue:** PLAN.md `## Phase 4` on that branch (pushed as `98ebd4c`): 4.0 bug hunt (repeats until 2 consecutive dry passes), 4.1 edit/regenerate, 4.2 inline tool-approval, 4.3 keyboard/a11y, 4.4 thread-switcher evaluation. Each card gates on bun test + tsc + build (+ Playwright for UI cards), commits, pushes to origin, never merges.

**To check progress:** `tail -f ~/repos/pi-remote-port/.ralph-state/loop.log` or `cat ~/repos/pi-remote-port/.ralph-state/iteration-log.md`. To stop it: `kill 45818` (loop.sh's PID at launch — verify with `ps` first, PIDs don't survive a reboot).

**Not touched:** live `~/repos/pi-remote` checkout, launchd bridge, `main` branch. Bridge continues serving whatever was live before this loop started.

**Next (once it stops or Nik wakes up):** review `feat/assistant-ui-port` commits made overnight, check `.ralph-state/bug-hunt-log.txt` and any `[!]` blocked cards, decide what merges.

**Update 2026-07-07 (surface:31):** `feat/assistant-ui-port` @ afc95dd (pushed). Terminal width bug fixed: captures are hard-wrapped at the source pane's column width; new fit-to-width scales the mono font so the longest line spans the phone screen (lib/terminal-fit.ts, verified live at 100.5% width vs the old ~60%). Settings built out: Text Size section with Chat messages slider (--chat-text-scale, composer pinned at 16px for iOS zoom), Agent terminals slider + fit toggle, Session list slider relocated (lib/ui-prefs.ts, localStorage, applied at boot). Gate 97/97 + all 4 parity specs re-passed. Note: commit 98ebd4c (Phase 4 overnight-loop PLAN cards) appeared on the branch from another session; my work sits on top cleanly.

---

## Session 2026-07-07 (~3AM) — loop upgraded to full autopilot-style scope

**Context:** Nik asked for a deeper audit and the FULL upgrade to assistant-ui, invoked via
`/autopilot`. Reconciliation note: autopilot's own instructions say to run its 6-step loop live
in-session (not via cron, since cron loses context) — but a second live process touching
`pi-remote-port` concurrently with the existing background loop would recreate the exact
worktree collision just fixed with surface:31. Resolution: stopped the original loop.sh cleanly
(worktree was clean, iteration 13 in-flight but zero uncommitted changes — safe kill, verified
by exact PID before killing per the shared-environment rule), then folded autopilot's real
value-adds (explicit Reason/Act/Reflect/Verify framing, an adversarial self-review pass before
every gate, an escalation path for decisions the loop can't make) into the SAME background-loop
mechanism instead of running two processes. One loop, one process, no collision, but now
carrying autopilot's rigor.

**Scope expanded** (PLAN.md Phase 4, commit `13ef5bf`, pushed): added 4.5 (evaluate
assistant-ui's markdown/syntax-highlighting renderer against ours) and 4.6 (evaluate its native
slash-command/input-history vs our hand-built CmdPicker) — the "maybe" bucket from the original
research, now in scope per "full upgrade." Added a PLAN.md `## Open questions for Nik` escalation
path for anything the loop can't decide alone (e.g. exactly which tool calls need approval in
4.2) instead of guessing. Caps raised 40→70 iterations, 8h→11h given the bug hunt alone found 12
real bugs before scope even expanded.

**Prior loop's results (all pushed to origin/feat/assistant-ui-port before restart):** 12 real
bugs found and fixed in the ported chat shell — thinking-block streaming flag never cleared on
disconnect, queued messages stuck after reconnect (2 variants + 1 race), cross-session message
leak on session switch, attached-agent transcript blanking on reconnect, terminal-view
cross-agent response bleed, image-attach giving zero visual feedback, and a stale-object bug
hiding the confirm button on an awaiting-confirm agent. Bug hunt (card 4.0) still hadn't gone dry
after 12 passes when stopped — restarted loop resumes it at pass 13.

**Currently running:** `~/repos/pi-remote-port/loop.sh`, background bash task `bomcd76yx`, PID
60938. Same isolation guarantees as before (worktree-only, never touches `~/repos/pi-remote` or
main, never merges). Log: `~/repos/pi-remote-port/.ralph-state/loop.log`.

**Next (once it stops):** review the full `feat/assistant-ui-port` branch, check `## Open
questions for Nik` in PLAN.md for anything it punted on, decide what merges.

---

## Session 2026-07-07 — full assistant-ui upgrade: first loop run complete, decisions locked, second loop launched

**First loop run (PID 60938/45818, iterations 1-30) finished clean at `PHASE_4_COMPLETE`** —
well under its 70-iteration/11h cap. Full result, all pushed to `origin/feat/assistant-ui-port`
(HEAD `66f7fb7` at completion):

- **30 real bugs found and fixed** in the bug hunt (card 4.0), closed after 2 consecutive dry
  passes (31 total hunt passes). Recent finds: tool-approval dialog never cleared on session
  transitions, tool cards not showing call arguments, a dialog not auto-cancelled on WS
  disconnect of an attached agent.
- **4.1 edit/regenerate — done.** Honest limitation logged: pi's bridge has no true "rewind"
  command, so edits resubmit as a new message rather than replacing the original turn.
- **4.3 keyboard/a11y — done.** Found + fixed 2 real gaps (edit-box autoFocus, dropped
  aria-live streaming announcer).
- **4.5 markdown renderer — done.** Actually adopted `@assistant-ui/react-markdown` for
  message/thinking-chain text + code blocks, bridged via `TextMessagePartProvider` since this
  app's renderer bypasses assistant-ui's message-part tree. Diff/tool cards untouched (no
  markdown equivalent needed there).
- **4.2, 4.4, 4.6 came back BLOCKED with real, traced technical reasons** (not skipped for
  convenience — each includes the actual code path read, not guessed): 4.2's real approval gate
  already exists but isn't tool-call-correlated and bridge.ts has no command allowlist; 4.4's
  session switcher needs a bridge protocol response that doesn't exist yet (traced, a client-side
  workaround was correctly rejected as unsafe); 4.6's slash-command primitives are
  `Unstable_`-prefixed with proven doc/implementation drift within the installed version.

**3 decisions locked with Nik via /decisions (AskUserQuestion, one at a time):**
- D-1 (4.2): re-skin the EXISTING approval dialog inline in the transcript. Declined the bigger
  per-tool-call gate (would need new bridge/pi protocol).
- D-2 (4.4): build the bridge protocol fix (correlated `new_session` response, mirrors
  `rename_session`'s pattern) THEN do the full `useRemoteThreadListRuntime` swap.
- D-3 (4.6): keep the hand-built `CmdPicker`. Declined adopting the unstable primitives.

PLAN.md rescoped accordingly (commit `2368f5b`, pushed): 4.2 and 4.4 reopened `[ ]` with concrete
scope, 4.6 closed `[x]` as intentionally-kept-as-is. Original technical analysis preserved under
`## Open questions for Nik`, marked RESOLVED so a future loop iteration doesn't re-derive it.

**Second loop launched** (PID 51353, background task `blscm1b0m`) to build the two rescoped
cards. Caps lowered to 20 iterations/4h since only 2 real cards remain. Same isolation
guarantees: worktree-only, never touches `~/repos/pi-remote` or main, never merges.

**State of the world:** nothing has touched `main` or the live phone bridge all session. Branch
`feat/assistant-ui-port` now has real, substantive assistant-ui adoption (not just parity) plus
30 bug fixes the original port didn't have. Once this second loop finishes: full branch review,
decide what merges.

---

## Session 2026-07-07 (~11:45PM) — collapse agent inbox to one row per cmux workspace

**Trigger:** Nik screenshot: cmux showed 9 open workspaces, but the phone's Needs You/Working
inbox had more rows than that and didn't map cleanly. Grounded before building anything —
`cmux tree --all` confirmed all 9 workspaces (screenshot was comprehensive, not partial), and
found the real cause: "voice-agent" workspace alone had 4 live terminal panes (including the
"studios-dex-voice-morph-ui" entry Nik saw in Needs You), "opportunity-architecture" had 2.
Ambient discovery correctly surfaces every pane as its own root agent (by design, from the
2026-07-03 "surface every terminal session" phase) — that's what was flooding the inbox, not
stale/ghost data.

**Shipped directly to `main` (live), commit `5f7ac86`, pushed:**
- `inbox.ts`: `collapseFamiliesByWorkspace(agents, enabled)` — pure, tested (6 new cases). Keeps
  one family per workspace ref (needs-you > working > review > done, then most-recent
  spawnedAt), reports folded count per workspace. No-op passthrough when disabled. Families with
  no resolved `workspace` are left alone (never guessed into a group).
- `agent-inbox-prefs.ts`: localStorage pref, default ON, dispatches a change event so Settings
  and the inbox stay in sync without a poll-cycle delay.
- `agent-inbox.tsx` / `agent-inbox-row.tsx`: wired in; kept rows show a "+N" badge when siblings
  are folded in, so nothing reads as silently dropped.
- `settings-panel.tsx`: new "Agents inbox" section, "One row per workspace" toggle, off reverts
  to showing every session (old behavior, nothing removed).

**Gate:** 82/82 bun tests, tsc clean, build clean. Live bridge restarted, confirmed serving the
new bundle (`index-DLZE3HF9.js`) via direct HTTP fetch comparison against the built asset on
disk.

**Not yet done:** on-device visual confirmation — Nik needs to hard-refresh and confirm the
inbox now shows ~9 rows (one per workspace) with +N badges where a workspace has siblings, and
that toggling the new Settings switch reveals everything again.

---

## Session 2026-07-08 (~12:07AM) — Phase 4 fully complete, all 7 cards shipped

**Second loop run (PID 51353) finished in just 2 iterations** — both remaining cards done clean:

- **4.2 inline tool-approval — done**, per Nik's decision. Re-skinned the existing
  `ExtensionDialog` inline in the transcript instead of a modal. Correction during build: pi's
  actual `extension_ui_request` methods split into no-ops (already filtered) and the real
  blocking set (input/editor/confirm) — no server-side tag separates "tool permission" from other
  blocking asks within that set, so all of them render inline now, the honest reading of the
  decision given what pi actually sends. Scoped to primary-session dialogs; attached-agent
  dialogs keep the modal.
- **4.4 thread switcher — done**, per Nik's decision, but the implementation caught its own
  planned approach was wrong mid-build: the original plan assumed bridge.ts already read a
  `sessionFile` off pi's `new_session`/`switch_session` responses (mirroring `rename_session`'s
  pattern) — traced against the installed `pi` binary and found that premise false, those RPCs
  never return one, only `get_state` does. Built the correct fix instead: bridge.ts chains an
  internal `get_state` after a successful new/switch, broadcasts a second enriched response with
  the real path. Frontend dedupes so the runtime's lazy init can't double-spawn a session. Full
  `RemoteThreadListAdapter` wired in.

**Phase 4 (4.0–4.6) is now 100% complete on `feat/assistant-ui-port`.** Final tally: 30 real bugs
found and fixed, 5 features actually shipped (edit/regenerate, keyboard/a11y, markdown renderer,
inline tool-approval, real thread switcher), 1 intentionally kept as-is (native slash-commands,
Nik's call — library version too unstable). Fresh full gate re-run confirms the whole branch:
124/124 bun tests, tsc clean, build clean.

**Not yet done:** this branch has NOT been merged to `main` or shown to Nik live. Given the scope
(a core runtime swap for session switching, not just bug fixes), recommending a live test-bridge
look before merging into what his phone actually runs, same pattern as prior verification
(`PORT=7701` isolated bridge). Awaiting Nik's call on next step.

---

## Session 2026-07-08 (~12:15AM) — test bridge for Phase 4 live review

Found and reused an already-running `bun --watch bridge.ts` on port 7701 in
`~/repos/pi-remote-port` (PID 93568, up 18h+, auto-reloaded on every commit all night — didn't
start a duplicate). Confirmed reachable over Tailscale (`http://mb-pro-max.tail62a752.ts.net:7701`,
plain http not https). AGENT_CWD is `~/repos/pi-remote` (has real session history to test the
switcher against). Live 7700 bridge confirmed unaffected throughout (still 200, still on `main`).

**Handed to Nik for live review before merge.** If approved: merge `feat/assistant-ui-port` →
`main`, restart the real 7700 launchd service, flip `?spike=1` default on (or make it the only
path — TBD with Nik). If rejected/needs changes: iterate on the branch, no live impact either way.

---

## Session 2026-07-08 (~12:35AM) — real bug found: 2 workspaces silently missing from ambient discovery

**Trigger:** Nik reported the assistant-ui test bridge "looks the exact same" (still investigating,
separately) and, checking his real app, "still don't see opportunity-lifecycle."

**Investigated the second report directly against the live bridge (WS probe, not guessing).**
Confirmed via `cmux tree --all` + direct `ps`/`lsof` that `opportunity-lifecycle` (workspace:10)
and `revops-architect` (workspace:13) were BOTH consistently absent from `list_agents`, and this
predates tonight's collapse-by-workspace fix entirely (the very first screenshot Nik sent already
showed "WORKING 7" instead of 9 — this bug has been live for a while, not caused by anything
built tonight).

**Root cause, found live:** `parseTtyRuntimes` (agents.ts) picked the highest-pid process on a
tty FIRST, then checked if it matched a known agent runtime. Both broken workspaces had
non-agent subprocesses with a HIGHER pid than the real agent: revops-architect is a Claude Code
session with a large MCP server tree (agentmemory, n8n, tavily, context7, supabase, filesystem —
all forked after the claude process, so all have higher pids); opportunity-lifecycle is a pi
session driven by an until-done loop that periodically forks a `sleep 1` heartbeat. In both
cases the "highest pid" was that non-agent subprocess, matched nothing, and the whole tty
silently dropped out of ambient discovery — even though a real, live agent was running on it.

**Fix (commit `cf629de`, pushed):** filter to candidates that actually match a runtime FIRST,
then take the highest pid among THOSE matches — instead of highest-pid-then-check. Regression
test added for this exact scenario; the earlier wrapper-line false-positive test (claude-yolo
env var) still passes unchanged, confirmed by re-running the full suite (83/83).

**Verified live**, not just by test: restarted the bridge, WS-probed `list_agents` directly —
`opportunity-lifecycle` and `revops-architect` both present now (13 total agent entries across
all 9 workspaces, up from a persistent under-count). This means every long-running session with
MCP tooling or a loop wrapper attached was likely invisible to pi-remote's ambient discovery
before this fix, not just these two.

**Still open:** the assistant-ui test bridge (port 7701) — Nik says it "looks the exact same."
Ruled out service-worker caching (sw.js is already network-only on that branch). Grepping the
minified bundle for new-feature identifiers was inconclusive (minification mangles names).
Next: verify with a signal that survives minification (a literal UI string), or just walk Nik
through triggering a feature that has an obviously different visual result (send a message, tap
edit on it).

---

## Session 2026-07-09 — cmux Pi Session Blank Screen Fix

**Issue:** Opening an existing cmux Pi session from pi-remote, reported on the Airtable pane, showed the agent chat shell/header and composer but a blank transcript.

**Root cause:** Attached Pi agent history bootstrap was ignored. The bridge sent the attached agent's `get_messages` response as an `agent_event`, but the frontend only fed agent events through the streaming reducer. That reducer handles live events (`agent_start`, `message_update`, tool events) but not `response/get_messages`, so existing session history never rendered. `AgentChatView` also had no empty-state fallback, so the body looked fully blank.

**Changed:**
- `frontend/src/lib/pi-bridge-client.ts`: added shared `messagesToLines()` history mapping and handle attached-agent `response/get_messages` by populating `attachedAgentLines`.
- `frontend/src/components/agent-chat-view.tsx`: added a visible empty/loading fallback instead of a blank content area.
- Rebuilt frontend, updating `public/index.html` and generating new hashed public assets.

**Verified:**
- `pnpm --dir frontend run build` passes.
- `bun test frontend/src/lib/agent-turn-reducer.test.ts frontend/src/lib/agent-runtime.test.ts frontend/src/lib/inbox.test.ts` passes (20 tests).
- launchd service `com.gnarza.pi-remote` is running and `http://localhost:7700` returns HTTP 200.

**Not yet verified:**
- Phone hard-refresh and reopen the Airtable cmux Pi session. Expected result: prior session history appears; if there is truly no history, a loading/fallback message appears instead of a blank screen.
- Old hashed public assets were left in place. `public/index.html` now references the new assets; remove stale tracked assets in a cleanup pass if desired.

---

## Session 2026-07-21 — final maintenance patch committed; repo frozen as legacy

Committed `ac64de3` (pushed): the 2026-07-09 blank-screen batch (history render +
empty-state fallback, canOpenRichAgentChat gate, UI density tweaks) plus removal of
12 stale hashed public assets. Bridge relaunched via launchd (had died since 07-10),
serving the new bundle (all assets 200). Working tree clean.

**Strategic state: pi-remote is now legacy/backup.** paseo-cmux (~/repos/paseo-cmux)
is the canonical agent app going forward (desktop + mobile + web + CLI, multi-host,
E2EE relay). Keep this launchd service running until paseo-cmux mobile proves itself
in daily phone use, then bootout + archive. Only feature truly lost on retirement:
deep pi RPC chat (tool cards, thinking blocks, live slash picker).
