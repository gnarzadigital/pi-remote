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
