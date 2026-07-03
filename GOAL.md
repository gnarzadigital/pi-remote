# GOAL — pi-remote parity + mobile multi-agent

## North star
pi-remote becomes a phone-first control surface for the pi coding agent that (a) looks and
feels like hermes-webui's "Calm Console," (b) matches Picot's mobile-relevant feature set,
and (c) adds the signature capability neither has on mobile: spawning and driving parallel
agents and subagents — with full-or-scoped context handoff — nested in the session picker.

## Definition of done (measurable)

### Design parity (hermes "Calm Console")
- Assistant prose renders in an editorial serif; user bubbles + UI in sans; code/paths mono.
- A "Console" warm theme (parchment on near-black) selectable alongside light/dark; persists.
- Headers use backdrop-blur; transcript uses hairline borders, no routine shadows.
- A multi-tool turn reads as ONE quiet "Activity: N tools" disclosure, not N cards.

### Feature parity (Picot, mobile-relevant)
- Full-text session search across content with highlighted hits.
- Inline diff viewer renders agent file edits (add/remove lines) in the transcript.
- Message queuing: typing while the agent works queues sends; they flush on turn end.
- Context-window meter shows used / cached / free tokens for the active session.
- Voice input via webkitSpeechRecognition (LOCAL only — no cloud STT).
- Chat header shows the workspace's git branch.

### Flagship (mobile multi-agent / cmux)
- The bridge runs N concurrent `pi --mode rpc` processes with per-agent session-routed WS
  (1:1 session→process; refuses to guess when >1 live; surfaces undeliverable commands).
- From the phone, spawn a parallel agent or subagent on a chosen workspace, choosing context
  mode: Full (fork/clone), Task brief (new_session+prompt), or Scoped (compact+fork).
- Each spawn also opens a real cmux terminal pane (`cmux-agent spawn`) and records parent lineage.
- The session picker nests agents as a live tree: orchestrator → parallel agents → subagents,
  each node showing live status (running / awaiting-confirm / done) and its context-mode badge.
- Tap any node to attach to that agent's live chat; send steer/follow-up; confirm/close from mobile.

## Testing bar (every task)
- Pure logic (routing, lineage, grouping, context-mode selection, diff parsing) → `bun test` assert.
- Types → `tsc --noEmit -p frontend/tsconfig.app.json` clean.
- Build → `pnpm build:ui` clean.
- Bridge behavior → WS smoke script against the live bridge (extend `/tmp/ws-check.ts` pattern).
- UI-touching → browser screenshot verified per ~/.claude/rules/ui-verification-before-handoff.md.
- No task is "done" until its Verify passes AND the validation gate is green.

## Non-goals
- Desktop-only Picot features: native title bar, external-editor launch, multi-OS-window, file tree.
- Any cloud STT/TTS/LLM (Nik hard rule — LiveKit transport only, models local).
- Auth/multi-tenant: this stays a single-user Tailscale surface (note Picot's no-auth LAN caveat).

## Guardrails
- Never edit `public/assets/*` by hand — change `frontend/`, rebuild.
- Do not change the WS RPC protocol shape for UI-only tasks; broker envelope changes are Phase 3 only.
- Commit after each green task. Bad intermediate states must not cascade (ralph-loop discipline).
