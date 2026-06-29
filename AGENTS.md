# pi-remote (Gnarza mobile UI)

Fork of [andreasmcdermott/pi-remote](https://github.com/andreasmcdermott/pi-remote) with a custom React mobile shell.

**Not** Jacob Moura's `remote-pi` npm package.

## What this is

Bun bridge + React PWA for controlling `pi --mode rpc` from a phone over Tailscale.

- Repo: `~/repos/pi-remote`
- GitHub: `gnarzadigital/pi-remote` (Gnarza fork)
- Port: `7700`
- UI: `http://<tailscale-host>:7700`

## Service (launchd — auto-restart)

The bridge runs as a launchd service that survives crashes and reboots:

| Goal | Command |
|---|---|
| **Check status** | `launchctl list \| grep pi-remote` |
| **Stop** | `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.gnarza.pi-remote.plist` |
| **Start** | `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.gnarza.pi-remote.plist` |
| **Restart** | `launchctl kickstart -k gui/$(id -u)/com.gnarza.pi-remote` |
| **Logs** | `tail -f /tmp/pi-remote-bridge.log` |

Config: `~/Library/LaunchAgents/com.gnarza.pi-remote.plist` — edit AGENT_CWD to change the project, then re-bootstrap. KeepAlive=true means it always restarts. RunAtLoad=true means it starts at login.

## Manual run (foreground, for debugging)

```bash
pi-remote                                    # foreground, current dir
pi-remote ~/Projects/gnarza-digital/...      # foreground, specific repo
pi-remote start -d ~/Projects/gnarza-digital # background daemon (nohup, no auto-restart)
pi-remote stop                               # kill background bridge
```

`~/bin/pi-remote` → `scripts/pi-remote.sh`. Prefer the launchd service for always-on use.

### Env overrides

| Variable | Default | Purpose |
|---|---|---|
| `PI_REMOTE_ROOT` | `~/repos/pi-remote` | Bridge/UI code location |
| `AGENT_CWD` | first arg or `$PWD` | Which pi session dir to attach |
| `PORT` | `7700` | HTTP/WebSocket port |
| `PI_REMOTE_ROOT_STATE` | `~/.pi/pi-remote` | PID file + logs when using `-d` |

After frontend edits: `pnpm run build:ui` (launcher and backup run this automatically).
