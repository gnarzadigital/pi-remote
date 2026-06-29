# HANDOFF: pi-remote — Bridge + Frontend Fix Sprint

## Current State
The app loads on iPhone via Tailscale (`https://mb-pro-max.tail62a752.ts.net:7700`) but:
- **Sessions show "Switching session..." permanently** — the `switch_session` command is sent via WebSocket but no response comes back
- **Bridge logs show pi crashes on startup** with extension loading errors: extensions (`ask-question.ts`, `vision-tool.ts`, `pi-loopflows`, `pi-subagents`) fail because they can't resolve `@earendil-works/pi-tui` module
- **The queueMicrotask fix for React #185 is done** — that crash is fixed
- **The position:fixed on body fix is done** — iOS black screen on initial load is fixed
- **Error boundary is in place** — React crashes show error messages instead of blank screen

## The Core Problem: pi Won't Start in RPC Mode

The bridge spawns `pi --mode rpc` via `Bun.spawn(["pi", "--mode", "rpc"])`. The `pi` binary is a wrapper script at `~/.local/bin/pi`:

```bash
#!/bin/bash
set -euo pipefail
PREFERRED="$HOME/.nvm/versions/node/v22.21.1/bin/pi"
if [ -x "$PREFERRED" ]; then
  exec "$PREFERRED" "$@"
fi
exec pi "$@"
```

The nvm pi symlink points to `../lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js` but npm's flat-store layout broke this — the actual cli.js is at `../lib/node_modules/@earendil-works/.pi-coding-agent-fZXFtdxO/node_modules/@earendil-works/pi-ai/dist/cli.js`.

Running pi sessions (PID 85562, 57519, 90231) use **homebrew's node** (`/opt/homebrew/Cellar/node/24.2.0/bin/node`) NOT nvm's node. These sessions work in tmux. But when the bridge spawns `pi`, it resolves through nvm and crashes.

## What I Tried

1. `bun add @earendil-works/pi-tui@0.80.2` to the nvm global dir — installed pi-tui but pi-coding-agent symlink is still broken
2. `npm install -g @earendil-works/pi-coding-agent@0.80.2` — npm 10.x uses flat store, the bin symlink wasn't created/points to wrong location
3. The wrapper script falls through to `exec pi` (infinite loop) when nvm path fails, but Bun.spawn might handle this differently

## The Fix Path

The cleanest fix for the bridge: **bypass the broken wrapper and spawn node + the cli module directly**. The bridge should find a working node + cli.js.

One approach that should work:

In `bridge.ts`, change the pi spawn from:
```ts
const pi = Bun.spawn(["pi", "--mode", "rpc"], ...)
```

To something like:
```ts
// Find a working node + pi cli module
const NODE = "/opt/homebrew/Cellar/node/24.2.0/bin/node"
// Find the actual cli.js (could be in nvm store or homebrew)
```

But the simplest approach: **fix the broken nvm symlink** by:

```bash
cd ~/.nvm/versions/node/v22.21.1
rm -f bin/pi
# Install with older npm that doesn't use flat store
npm rebuild @earendil-works/pi-coding-agent
# Or link the existing store entry properly
```

Or skip nvm entirely and install via homebrew:
```bash
brew install pi  # if available
```

Or make the bridge use the already-working running pi processes (but they're in tmux, not available for bridge to pipe into).

## Also Broken: npm Output Leaking into Chat

Even after I added deprecation warning filters (bridge.ts line 336-342, pi-bridge-client.ts line 217-223), npm install output like "added 207 packages in 8s" still appears as `bridge_error` system messages because they're on pi's stderr.

## Files Changed (not yet pushed to GitHub, just committed locally)

- `bridge.ts` — pi crash no longer kills bridge, deprecation warning filter
- `frontend/src/App.tsx` — wrapped in ErrorBoundary
- `frontend/src/components/error-boundary.tsx` — new error boundary component
- `frontend/src/index.css` — removed `position: fixed` from body (iOS crash fix)
- `frontend/src/lib/pi-bridge-client.ts` — queueMicrotask patch, graceful disconnect, deprecation filter
- `frontend/src/components/*` — touch targets, tooltip nesting, code block fixes, index keys
- `_session-notes.md` — comprehensive summary

## Next Steps

1. **Fix pi startup in bridge mode** — see above. Get `pi --mode rpc` working so `switch_session`, `get_messages`, `get_state` all respond.
2. **Filter npm install output** from chat — all stderr lines from pi are broadcast as bridge_error. Deprecation warnings filtered but generic npm output still leaks.
3. **Restart bridge** and verify sessions load on iPhone
4. **Push commits** to GitHub once verified working

## To Restart Bridge

```bash
pkill -f "bun run bridge.ts" 2>/dev/null; sleep 1
cd ~/repos/pi-remote
AGENT_CWD=/Users/nicholasgarza/Projects/gnarza-digital/clients/crystal-pm/projects/opportunity-lifecycle PORT=7700 nohup bun run bridge.ts > /tmp/pi-remote-bridge.log 2>&1 &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:7700
```

Tailscale: `https://mb-pro-max.tail62a752.ts.net:7700`
