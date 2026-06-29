# pi-remote Stability Checklist

**Pass criteria:** Each item must pass with 0 console errors, correct DOM state, and a screenshot showing the expected visual. Run via CDP browser automation.

**Status legend:** [ ] untested  [x] passing  [!] broken  [~] partial

---

## A. App Load (foundational)

- [ ] A1. Page loads with no React errors (Runtime.exceptionThrown count = 0)
- [ ] A2. Session list renders within 2s of navigation
- [ ] A3. Dark mode applied by default (html.dark class present, body bg = #0a0a0a)
- [ ] A4. No "Something went wrong" error boundary page
- [ ] A5. No stuck "Switching session..." system messages from prior loads
- [ ] A6. No pi stderr noise in chat (npm output, skill loading, deprecation)

## B. Session Switching

- [ ] B1. Tapping a session loads message history within 2s
- [ ] B2. "Switching session..." appears briefly then clears
- [ ] B3. Session title updates in header
- [ ] B4. Scrolled to bottom on load (most recent message visible)
- [ ] B5. Tapping another session replaces (not appends) the conversation
- [ ] B6. Switching between 3+ sessions preserves each scroll position
- [ ] B7. Foreign-workspace session tap shows hint, does not switch

## C. Scroll Behavior (the reported problem)

- [ ] C1. New messages auto-scroll to bottom (pinned)
- [ ] C2. During streaming, scroll stays pinned to bottom
- [ ] C3. Scrolling up detaches auto-scroll (does not fight the user)
- [ ] C4. "Jump to bottom" button appears when scrolled up
- [ ] C5. "Jump to bottom" button hidden when already at bottom
- [ ] C6. Tapping jump button smooth-scrolls to bottom
- [ ] C7. Scroll position restores correctly after session switch
- [ ] C8. No scroll jank during streaming (target 60fps, no layout thrash)
- [ ] C9. Long messages (1000+ tokens) scroll smoothly, no stutter
- [ ] C10. Overscroll does not bounce past content bounds

## D. Send/Receive Loop

- [ ] D1. Typing in input shows text
- [ ] D2. Send button enables only when input has content
- [ ] D3. Sending creates a user bubble immediately
- [ ] D4. Input clears after send
- [ ] D5. Assistant response streams token by token (text_delta visible)
- [ ] D6. Streaming cursor shows during streaming
- [ ] D7. Final message is complete (no truncation)
- [ ] D8. Abort button stops streaming cleanly
- [ ] D9. Mode toggle (prompt/steer/follow-up) works

## E. Message Rendering

- [ ] E1. Markdown renders (bold, italic, lists, headings)
- [ ] E2. Code blocks render with syntax highlighting
- [ ] E3. Code blocks are horizontally scrollable
- [ ] E4. Long URLs wrap (do not overflow horizontally)
- [ ] E5. Images render inline with preview
- [ ] E6. Tool executions render as collapsible blocks
- [ ] E7. Tool status (running/done/error) shows correctly
- [ ] E8. Thinking blocks expand and collapse
- [ ] E9. User messages align right, assistant left (or per design)

## F. Input Area

- [ ] F1. Keyboard opens without layout shift
- [ ] F2. Input stays visible above keyboard (not obscured)
- [ ] F3. Text input is 16px (prevents iOS zoom)
- [ ] F4. Image attach button works (file picker opens)
- [ ] F5. Image preview shows after selection
- [ ] F6. Cmd picker opens on "/" or "@" trigger
- [ ] F7. Cmd picker closes on selection or blur
- [ ] F8. Touch target on all buttons >= 44px

## G. Session Management

- [ ] G1. New session button creates and switches
- [ ] G2. Rename session works
- [ ] G3. Pin session works
- [ ] G4. Archive session works
- [ ] G5. Session search filters list
- [ ] G6. Workspace switcher changes context
- [ ] G7. Swipe actions work (pin/archive/delete)

## H. Connection / Reconnect

- [ ] H1. WebSocket connects on app load
- [ ] H2. Connection status indicator reflects state
- [ ] H3. Reconnect after WS drop preserves session
- [ ] H4. Reconnect re-fetches state without duplicates
- [ ] H5. pi subprocess crash shows graceful message (not blank)

## I. Mobile / iOS

- [ ] I1. No black screen on initial load
- [ ] I2. No position:fixed body issues
- [ ] I3. VisualViewport hook handles keyboard correctly
- [ ] I4. Pull-to-refresh disabled (overscroll-behavior: none)
- [ ] I5. Pinch-zoom disabled (user-scalable=no)
- [ ] I6. Status bar matches dark theme
- [ ] I7. Safe area insets respected (notch)

## J. Error Resilience

- [ ] J1. One bad message does not crash conversation (per-line boundary)
- [ ] J2. Global error boundary catches catastrophic errors
- [ ] J3. Error boundary retry button works
- [ ] J4. localStorage quota errors handled gracefully
- [ ] J5. WebSocket send failure does not crash app

---

## How to run this

```bash
# Each test is a script in tests/cdp/
# tests/cdp/run-all.mjs executes all and reports a table:
#   A1 PASS  A2 PASS  A3 PASS  ...
#   C1 FAIL  C2 FAIL  ...  (with screenshot + error attached)
```

Target: 100% green before any new features.
