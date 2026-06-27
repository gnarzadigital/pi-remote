# pi-remote (Gnarza mobile UI)

Fork of [andreasmcdermott/pi-remote](https://github.com/andreasmcdermott/pi-remote) with a custom React mobile shell.

**Not** Jacob Moura's `remote-pi` npm package.

## What this is

Bun bridge + React PWA for controlling `pi --mode rpc` from a phone over Tailscale.

- Repo: `~/repos/pi-remote`
- GitHub: `gnarzadigital/pi-remote` (Gnarza fork)
- Port: `7700`
- UI: `http://<tailscale-host>:7700`

## On / off (quick reference)

| Goal | Command |
|---|---|
| **Use remote (foreground)** | `pi-remote` or `pi-remote ~/path/to/repo` — Ctrl+C stops |
| **Use remote (background)** | `pi-remote start -d ~/path/to/repo` |
| **Turn off** | `pi-remote stop` |
| **Check if running** | `pi-remote status` |
| **Restart** | `pi-remote restart ~/path/to/repo` |

Nothing runs automatically. Remote access only exists while the bridge process is up. Tailscale must be on for phone access, but that alone does not start pi-remote.

## Start from any agent or shell

```bash
pi-remote                                    # foreground, current dir
pi-remote ~/Projects/gnarza-digital/...      # foreground, specific repo
pi-remote start -d ~/Projects/gnarza-digital # background daemon
pi-remote stop                               # kill background bridge
pi-remote backup                             # build UI + local snapshot
```

`~/bin/pi-remote` → `scripts/pi-remote.sh`

### Env overrides

| Variable | Default | Purpose |
|---|---|---|
| `PI_REMOTE_ROOT` | `~/repos/pi-remote` | Bridge/UI code location |
| `AGENT_CWD` | first arg or `$PWD` | Which pi session dir to attach |
| `PORT` | `7700` | HTTP/WebSocket port |
| `PI_REMOTE_ROOT_STATE` | `~/.pi/pi-remote` | PID file + logs when using `-d` |

After frontend edits: `pnpm run build:ui` (launcher and backup run this automatically).
