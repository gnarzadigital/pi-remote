# pi-remote

A mobile-first remote for the [pi coding agent](https://shittycodingagent.ai).
Run `pi --mode rpc` on your laptop via a Bun bridge, then monitor and control the session from Safari (or any browser) over Tailscale.

```
Phone / Browser ── WebSocket ── bridge.ts (Bun) ── pi --mode rpc ── agent
                     (Tailscale)
```

## What it does

`bridge.ts` is a thin RPC multiplexer:

- Spawns `pi --mode rpc` as a child process
- Forwards JSONL RPC commands from WebSocket clients to pi
- Broadcasts pi events to all connected clients
- Routes RPC responses back to the requesting client (or broadcasts when needed)
- Serves the static web UI from `public/`

On client connect, the bridge bootstraps UI state with:

- `get_state`
- `get_messages`
- `get_commands`
- `get_available_models`

It also sends bridge-side metadata:

- persisted model recents (`prefs` message)
- repo context (`session_info`: folder + git branch)

## Key features

- Live streaming assistant output (`message_update`)
- Markdown rendering for completed assistant text
- Tool execution cards (start/update/end)
- Collapsible thinking blocks
- Slash command picker (`/`) backed by `get_commands`
- Send modes: Prompt, Steer, Follow-up
- Abort current run
- File reference autocomplete with `@...` (`list_files` bridge command)
- Session management (`list_sessions`, `switch_session`, `new_session`)
- Conversation forking (`get_fork_messages`, `fork`)
- Export conversation (HTML)
- Manual compact (`compact`)
- Model picker + recent models persistence
- Thinking level controls (`set_thinking_level`) persisted across restarts
- Extension UI request/response round-trips
- Optional terminal input passthrough (`prompt`, `follow_up`, `abort`)
- PWA install support (manifest + service worker)
- Optional Web Push notifications on `agent_end`
- Mobile polish: safe areas, haptics, unread/finish indicator, copy buttons on code blocks
- Image attachment support from the UI

## Requirements

- [Bun](https://bun.sh)
- `pi` CLI installed (`@mariozechner/pi-coding-agent`)
- [Tailscale](https://tailscale.com) on host + phone for remote access

## Quick start

### 1) Install deps

```bash
cd ~/repos/pi-remote
bun install
cd frontend && pnpm install && cd ..
```

The UI is a React app in `frontend/`. Built assets land in `public/` (committed so the bridge works without a build step on every machine).

### 2) Run bridge

```bash
# builds UI first if public/ is missing, then starts bridge
pnpm start

# or manually rebuild UI after frontend changes
pnpm run build:ui
pnpm start

# or target another repo for the agent working directory
AGENT_CWD=~/repos/monorepo bun run bridge.ts

# custom port (default: 7700)
PORT=8080 bun run bridge.ts
```

### 3) Open UI

```text
http://<tailscale-ip>:7700
```

## Terminal controls

While bridge is running, you can send commands from terminal:

| Input | Behavior |
|---|---|
| `some text` + Enter | `prompt` with `streamingBehavior: "steer"` |
| `> some text` + Enter | `follow_up` |
| `abort` + Enter | `abort` |

## Bridge protocol notes

The WebSocket payloads are pi RPC objects plus a few bridge-only message types.

### Bridge-only WS messages

#### Server → client

```json
{ "type": "prefs", "recentModels": [{ "id": "...", "name": "...", "provider": "..." }] }
{ "type": "session_info", "folder": "repo-name", "branch": "main" }
```

#### Client → server

```json
{ "type": "list_files", "id": "...", "forceRefresh": false }
{ "type": "list_sessions", "id": "..." }
```

#### Bridge responses

```json
{ "type": "response", "command": "list_files", "success": true, "id": "...", "data": { "files": ["README.md"] } }
{ "type": "response", "command": "list_sessions", "success": true, "id": "...", "data": { "sessions": [{ "path": "...", "name": "...", "mtime": 0 }] } }
```

### Push notification HTTP endpoints

- `GET /api/push/public-key`
- `POST /api/push/subscribe`
- `POST /api/push/unsubscribe`
- `POST /api/push/test`
- `GET /api/push/status`

## File structure

```text
pi-remote/
├── bridge.ts              # Bun WebSocket + static server (do not change for UI work)
├── frontend/              # React UI source (canonical — edit here)
│   └── src/
├── public/                # Built UI served by bridge (rebuild with pnpm run build:ui)
├── public-legacy/         # Archived vanilla UI (reference only)
├── docs/UI.md             # Design system + workflow (read before UI changes)
├── mockups/               # Design exploration
├── prefs.json
├── push-prefs.json
└── package.json
```

See [`docs/UI.md`](docs/UI.md) for how to change the UI without losing the aesthetic.

## Notes

- Preferences are persisted locally in `prefs.json` and `push-prefs.json`.
- The bridge exits when the child pi process exits.
- On `agent_end`, web push notifications are sent to subscribed clients that are not currently active.

## References

- Pi SDK docs: `~/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/sdk.md`
- Pi RPC docs: `~/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/rpc.md`
- Tailscale: https://tailscale.com
