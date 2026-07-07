#!/usr/bin/env bash
# Keep the custom Gnarza pi-remote online via launchd + Tailscale Serve.
set -euo pipefail

ROOT="${PI_REMOTE_ROOT:-$HOME/repos/pi-remote}"
LABEL="com.gnarza.pi-remote"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT="${PORT:-7700}"
LOG="/tmp/pi-remote-bridge.log"
UID_PATH="gui/$(id -u)"

# The system /usr/local/bin/tailscale crashes with a BundleIdentifiers fatal
# error; prefer the working app binary, fall back to PATH/system only if missing.
TAILSCALE="${TAILSCALE:-}"
if [[ -z "$TAILSCALE" ]]; then
  if [[ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]]; then
    TAILSCALE="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
  else
    TAILSCALE="$(command -v tailscale || echo /usr/local/bin/tailscale)"
  fi
fi

usage() {
  cat <<EOF
pi-remote-online [start|restart|stop|status|url|logs|rebuild] [project-path]

start/restart keeps pi-remote alive with launchd KeepAlive=true and exposes it on Tailscale Serve.
If project-path is omitted, the existing plist AGENT_CWD is preserved; if none exists, uses current dir.
EOF
}

plist_cwd() {
  python3 - "$PLIST" <<'PY' 2>/dev/null || true
import plistlib, sys
with open(sys.argv[1], 'rb') as f:
    print(plistlib.load(f).get('EnvironmentVariables', {}).get('AGENT_CWD', ''))
PY
}

write_plist() {
  local cwd="$1"
  mkdir -p "$(dirname "$PLIST")"
  python3 - "$PLIST" "$ROOT" "$cwd" "$PORT" "$HOME" <<'PY'
import plistlib, sys
plist, root, cwd, port, home = sys.argv[1:]
data = {
  'Label': 'com.gnarza.pi-remote',
  'ProgramArguments': [f'{home}/.bun/bin/bun', 'run', 'bridge.ts'],
  'WorkingDirectory': root,
  'EnvironmentVariables': {
    'HOME': home,
    # /usr/sbin is where lsof lives (agents.ts's resolveCwdForPid shells out to
    # it) — without it every ambient "pi" agent's cwd silently resolved to ""
    # (ENOENT swallowed by a bare try/catch), which made every one of them
    # unopenable from the mobile UI with zero error shown. Root-caused 2026-07-06.
    'PATH': f'/usr/sbin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:{home}/.bun/bin:{home}/.local/bin',
    'AGENT_CWD': cwd,
    'PORT': port,
  },
  'RunAtLoad': True,
  'KeepAlive': True,
  'ThrottleInterval': 5,
  'ProcessType': 'Background',
  'StandardOutPath': '/tmp/pi-remote-bridge.log',
  'StandardErrorPath': '/tmp/pi-remote-bridge.log',
}
with open(plist, 'wb') as f:
    plistlib.dump(data, f)
PY
}

resolve_cwd() {
  local raw="${1:-}"
  if [[ -n "$raw" ]]; then cd "$raw" && pwd; return; fi
  local saved; saved="$(plist_cwd)"
  if [[ -n "$saved" && -d "$saved" ]]; then printf '%s\n' "$saved"; return; fi
  pwd
}

ensure_tailscale_serve() {
  [[ -x "$TAILSCALE" ]] || return 0
  "$TAILSCALE" serve status 2>/dev/null | grep -q ":$PORT .*http://\(localhost\|127.0.0.1\):$PORT" && return 0
  "$TAILSCALE" serve --https="$PORT" --bg --yes "http://127.0.0.1:$PORT" >/dev/null
}

url() {
  if [[ -x "$TAILSCALE" ]]; then
    "$TAILSCALE" serve status 2>/dev/null | awk -v p=":$PORT" '$1 ~ /^https:/ && index($1,p) { print $1; found=1; exit } END { if (!found) exit 1 }' && return 0
    local ip; ip="$("$TAILSCALE" ip -4 2>/dev/null || true)"
    [[ -n "$ip" ]] && { echo "http://$ip:$PORT"; return 0; }
  fi
  echo "http://localhost:$PORT"
}

status() {
  launchctl list | grep -q "$LABEL" && echo "pi-remote launchd: running" || echo "pi-remote launchd: stopped"
  echo "cwd: $(plist_cwd || echo unknown)"
  echo "url: $(url || echo http://localhost:$PORT)"
  printf "local: "
  curl -fsS -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:$PORT/" || true
  echo "log: $LOG"
}

cmd="${1:-start}"; shift || true
case "$cmd" in
  -h|--help|help) usage ;;
  start|up)
    cwd="$(resolve_cwd "${1:-}")"
    write_plist "$cwd"
    launchctl bootstrap "$UID_PATH" "$PLIST" 2>/dev/null || true
    launchctl kickstart -k "$UID_PATH/$LABEL"
    ensure_tailscale_serve
    sleep 1
    status
    ;;
  restart)
    cwd="$(resolve_cwd "${1:-}")"
    write_plist "$cwd"
    launchctl bootout "$UID_PATH" "$PLIST" 2>/dev/null || true
    launchctl bootstrap "$UID_PATH" "$PLIST"
    ensure_tailscale_serve
    sleep 1
    status
    ;;
  stop|kill)
    launchctl bootout "$UID_PATH" "$PLIST" 2>/dev/null || true
    status
    ;;
  status) status ;;
  url) url ;;
  logs|log) tail -f "$LOG" ;;
  rebuild) (cd "$ROOT" && pnpm run build:ui) ;;
  *)
    # Bare path means "start for this project".
    cwd="$(resolve_cwd "$cmd")"
    write_plist "$cwd"
    launchctl bootstrap "$UID_PATH" "$PLIST" 2>/dev/null || true
    launchctl kickstart -k "$UID_PATH/$LABEL"
    ensure_tailscale_serve
    sleep 1
    status
    ;;
esac
