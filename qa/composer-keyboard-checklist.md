# Composer + Keyboard QA Checklist

Run this before any change touching `input-area.tsx`, `prompt-input.tsx`, `textarea.tsx`,
`use-visual-viewport.ts`, or `.chat-bottom-dock`/`.input-footer` CSS. Each item states which
tool actually catches it — don't substitute a lower-fidelity tool for one marked "device only".

## 1. Text overflow / growth (headless-testable — Playwright WebKit)

| # | Scenario | What "pass" looks like |
|---|---|---|
| 1.1 | Empty input | Placeholder visible, textarea at `min-h-[44px]`, no clipping |
| 1.2 | Single short word | Fits on one line, no wrap artifacts |
| 1.3 | Long unbroken string (URL, hash, base64 blob, no spaces) | Wraps via `overflow-wrap:anywhere`, never overflows the bubble/textarea horizontally |
| 1.4 | Multi-paragraph text (5+ lines) | Textarea grows up to `maxHeight={140}` cap, then scrolls internally — text never visually clipped at the cap edge |
| 1.5 | Emoji / multi-byte grapheme clusters (flags, skin-tone modifiers, ZWJ sequences) | No mid-glyph truncation, cursor position stays correct |
| 1.6 | Code block pasted (indented, long lines) | `prose-pre:overflow-x-auto` — horizontal scroll inside the block, not page-level overflow or clipping |
| 1.7 | Rapid typing while auto-grow is animating | No visual jump/flicker, height settles correctly |
| 1.8 | Text scale setting at max (1.35x, via Settings) | Composer still fits, buttons don't overlap text |
| 1.9 | Whitespace-only input (spaces, newlines) | Send button stays disabled (`input.trim()` check) |
| 1.10 | Very long single line (no wrap points, e.g. `aaaaaaaa...` x500) | Wraps correctly, doesn't push the composer off-screen horizontally |

## 2. Keyboard interaction (DEVICE-ONLY — real iPhone or Simulator w/ real on-screen keyboard; Playwright/Chrome CANNOT simulate real iOS keyboard resize)

| # | Scenario | What "pass" looks like |
|---|---|---|
| 2.1 | Tap composer, keyboard slides up | Composer rises smoothly to sit directly above the keyboard, no jump/overshoot |
| 2.2 | Keyboard open, composer position | Composer is NOT too high (large gap above keyboard) and NOT under the keyboard |
| 2.3 | Type multi-line text with keyboard open | Textarea grows within the now-shorter visible viewport; conversation scrolls to keep the growing textarea visible |
| 2.4 | Dismiss keyboard (tap Return-less area / swipe down) | Composer returns to resting position at the true bottom (safe-area respected), no leftover gap |
| 2.5 | Rotate device with keyboard open | Keyboard + composer re-settle correctly, no stale `--app-height`/`--keyboard-inset-bottom` values |
| 2.6 | Switch apps (backgrounding) with keyboard open, then return | Keyboard/composer state doesn't desync from a stale visualViewport reading |
| 2.7 | Slash-command picker open + keyboard open simultaneously | Picker renders above the composer, above the keyboard, fully visible — not clipped by either |
| 2.8 | QuickType / predictive-text bar visible | Composer sits above it correctly (predictive bar is part of the keyboard's visualViewport-reported height on iOS) |
| 2.9 | Voice dictation active (mic button) | No layout shift when the OS dictation UI overlays |
| 2.10 | External keyboard connected (no on-screen keyboard) | Composer does NOT reserve space for a keyboard that isn't shown (verify `kbOpen` stays false) |

## 3. Safe-area / standalone-mode regression (mechanical + device)

| # | Check | Tool |
|---|---|---|
| 3.1 | `apple-mobile-web-app-capable` never re-added | `bun test pwa-container.test.ts` — automatic, blocks on regression |
| 3.2 | `manifest.json` display never reverts to standalone/fullscreen | same test |
| 3.3 | Composer sits flush at the bottom, ~8px lift, no fat gap | `playwright test qa/webkit-composer-bottom.spec.ts qa/webkit-terminal-composer.spec.ts` |
| 3.4 | Real device: `screenH == innerH`, `standalone == false` (Safari mode) | Read `/tmp/pi-remote-diag.jsonl` after the device opens the app — no screenshot needed |

## 4. Regression sweep on adjacent surfaces (didn't break what wasn't touched)

| # | Surface | Check |
|---|---|---|
| 4.1 | Primary `ChatView` composer | Same checklist above still passes |
| 4.2 | `agent-chat-view.tsx` composer (attached pi agent) | Same checklist above still passes |
| 4.3 | `agent-terminal-view.tsx` composer (claude/codex/hermes via cmux) | Same checklist above still passes |
| 4.4 | New-session hero (`variant="centered"`) | Centered composer unaffected by dock-specific CSS |
| 4.5 | Slash-command picker, prompt-suggestions row | Positioning unaffected by any dock/keyboard change |

## Running it

```bash
cd ~/repos/pi-remote
bun test pwa-container.test.ts $(find . -name '*.test.ts' -not -path '*/node_modules/*')
./node_modules/.bin/playwright test qa/webkit-composer-bottom.spec.ts qa/webkit-terminal-composer.spec.ts qa/webkit-composer-overflow.spec.ts
# then, for section 2 + 3.4: open the app on a real device (or Simulator w/ on-screen
# keyboard), exercise the keyboard scenarios above, and read:
tail -20 /tmp/pi-remote-diag.jsonl
```

Section 2 has no automatable substitute. If you cannot get device access in the moment,
say so explicitly and label the change "unverified for keyboard interaction" — do not claim
done on Section 2 items from headless tests alone (see `pi-remote-must-test-on-real-iphone`
memory for why this matters).
