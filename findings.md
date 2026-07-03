# pi-remote — Research Findings (Phase 3 multi-agent)

## Design targets
- **Picot** (github.com/shixin-guo/picot): GUI for the SAME pi agent. Feature target.
- **hermes-webui "Calm Console"** (~/hermes-webui/DESIGN.md): conversation-first, serif
  assistant prose, warm parchment palette, tool traces as quiet metadata. Design target.

## cmux agent-spawning surface (research agent 1, verified 2026-07-03)

cmux = native Rust multiplexer (Ghostty author). CLI at ~/bin/cmux, control socket at
~/.local/state/cmux/cmux-501.sock. Address hierarchy: window:N > workspace:N > pane:N > surface:N.

Wrapper: `~/.agents/scripts/cmux-agent` (also on PATH). Subcommands + programmatic surface:

| Op | Command | Output |
|----|---------|--------|
| SPAWN | `cmux-agent spawn --agent <claude\|codex\|pi\|zai\|hermes> --prompt "..." --cwd /path [--keep]` | `spawned: <rt> in surface:N` |
| LIST | `cmux-agent list [--all]` | JSON registry |
| SEND | `cmux-agent send --to surface:N --msg "..." [--workspace workspace:N]` | ok/err |
| RECV | `cmux-agent recv --pane surface:N [--workspace ..] [--wait] [--clear]` | JSON messages |
| DONE | `cmux-agent done --pane surface:N --workspace workspace:N` | worker signals done |
| CONFIRM | `cmux-agent confirm --pane surface:N --workspace workspace:N` | validates + closes pane |
| SAVE | `cmux-agent save-session "<resume>" --pane surface:N --workspace workspace:N` | records resume path |
| TOPOLOGY | `cmux tree --all` | nested live topology |

**Registry** `~/.cmux-mesh/<workspace>/registry.json`:
```json
{ "surface:97": { "runtime":"claude", "cwd":"/path", "session_path":"claude --continue ...",
  "registered_at":1782765170.5, "status":"active|done-awaiting-confirm|closed",
  "done_at":..., "closed_at":... } }
```
**Mailbox** `~/.cmux-mesh/<workspace>/mailbox_surface:N/<ts>.json`: `{from,msg,ts}`. Poll-based, no push.

Lifecycle: spawn(active) → work → save-session → done(awaiting-confirm) → orchestrator confirm(closed).
Stale detection: registry status "active" but surface absent from `cmux tree --all`.

### KEY GAP → design decision
The registry is FLAT: no parent/child lineage. To nest agents in the session picker
(orchestrator → parallel agents → subagents) we must record lineage ourselves. Options:
1. **Extend `cmux-agent spawn` to accept `--parent surface:N` and write a `parent` field**
   into registry.json. Cleanest; makes lineage first-class in the same registry the bridge polls.
2. Bridge tracks its own spawn graph (bridge is the thing issuing spawns from mobile).
3. Derive from cwd nesting / session-notes (fragile — reject).
Leaning (1)+(2): bridge issues spawns and records parent; also patch cmux-agent so
terminal-initiated spawns carry lineage too. Nested picker reads the merged graph.

## Bridge multi-process + pi subagents (research agent 2, verified 2026-07-03)

Bridge is single-pi: `const pi = Bun.spawn(["pi","--mode","rpc"],...)` at bridge.ts:201.
Single stdin writer (sendToPi ~281), single stdout reader broadcasting to all clients (~362),
flat `pendingResponseRoutes` id→ws (~250). AGENT_CWD read once at startup (line 34); cwd
cannot change without restart.

Refactor points to go multi-agent:
- pi → `Map<agentId, {child, stdin}>`
- sendToPi(agentId, cmd); per-process stdout reader routing only to that agent's WS clients
- response routing scoped by agentId (pi stdout has no agentId → bridge adds it per connection)
- per-connection {clientId, agentId, cwd}; spawn-on-demand per workspace

**pi has NO native multi-agent RPC.** rpc-types.d.ts commands are session-scoped only:
prompt/steer/follow_up/abort, new_session/switch_session, get_state/messages/commands,
set_model, compact, fork, clone, get_session_stats. No spawn/list/subagent commands.
Multi-agent is 100% external orchestration.

**cmux IS pi's subagent backend.** `PI_SUBAGENT_MUX=cmux` (~/.local/bin/pi). Extension
`~/.pi/agent/extensions/cmux-session.ts` reports pi lifecycle (session_start,
before_agent_start, agent_end) UP to cmux via `cmux hooks pi <event>`. cmux daemon owns the
workspace tree. cmux CLI has: list-windows, list-workspaces, tree --all, top,
`new-surface --type agent-session --provider pi`, right-sidebar sessions.

## Picot architecture (research agent 3, read from source, verified 2026-07-03)

Tauri app, 3 layers: Rust PiManager+BrokerWs / per-pi embedded-server extension / static frontend.

1. **PiManager** spawns `pi --extension <embedded-server> --mode rpc [--session <file>]`,
   one per window + optional per-session dedicated processes. Sequential ports from **47821**.
   Maps: port→process, session_file→port, workspace→[dedicated ports].
2. **BrokerWs** (single): UI clients on `/ui-ws`; lazily-opened auto-reconnecting upstream WS
   per pi at `/ws`. **Routes by `sessionId` (the .jsonl path), learned from upstream frames,
   kept 1:1 per port.** `sourcePort` hint; `active_port` fallback that REFUSES to guess when
   >1 pi live (prevents cross-window misroute). `command_undeliverable` on no route.
   Envelope: `broker_command{requestId, sessionId, sourcePort, payload}` →
   `broker_event{protocolVersion, sessionId, sourcePort, payload}`. Host ops via
   `broker_control`/`control_response`/`control_progress`.
3. **embedded-server.ts** = pi extension booting HTTP+WS INSIDE each pi (binds 0.0.0.0).
   REST per-pi-direct (/api/sessions, /api/cost-dashboard, /api/git-branch, /api/search,
   /api/files, /api/lan-qr); chat via broker. Bun-vs-node WS upgrade split gotcha.
4. **Mobile** = same server on 0.0.0.0 + `?mobile=1&brokerWs=ws://<lan>:<port>/ui-ws` +
   `/api/lan-qr` PNG + PWA manifest. NO AUTH (LAN security note).

### How this maps to pi-remote (NOT Tauri — single Bun bridge over Tailscale)
pi-remote already IS the "embedded server" (bridge.ts serves the PWA + spawns pi). We don't
need Picot's Rust layer. We fold the BROKER into bridge.ts: `Map<agentId, pi>` + route
inbound WS commands by agentId/sessionId + tag outbound events by agentId. Reuse Picot's
routing discipline (1:1 session→process, refuse-to-guess when >1 live, undeliverable frames).

## THE architecture fork for Phase 3 (needs Nik's call)
How does the mobile UI drive spawned agents?
- **A. Bridge-owned RPC (Picot model):** mobile spawns headless `pi --mode rpc` per agent via
  bridge; full structured chat UI per agent (streaming/tools/diffs). No real terminal panes.
  Best mobile UX, self-contained, Tailscale-native. Doesn't satisfy "new surfaces in terminals."
- **B. cmux-native mirror:** mobile spawns via `cmux-agent spawn` → REAL cmux TUI panes on the
  Mac; watch/steer via cmux registry + mailbox + `cmux send`. Truest to Nik's ask. Hard part:
  mirroring raw terminal pane output to mobile (no structured RPC stream).
- **C. Hybrid (recommended target):** cmux spawns the real pane (desktop visibility + his
  workflow) AND bridge attaches `pi --mode rpc --session <same .jsonl>` so mobile gets the rich
  chat UI on the same session. Nested picker unifies both via lineage we record at spawn.
  Most powerful, most work. Ship B or A's mechanics first, converge to C.

Nested-picker lineage = recorded by us at spawn (`--parent`), merged with cmux tree + registry.
