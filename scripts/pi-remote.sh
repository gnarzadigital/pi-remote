#!/usr/bin/env bash
# pi-remote control — start, stop, status, backup (Gnarza fork of andreasmcdermott/pi-remote)
set -euo pipefail

PI_REMOTE_ROOT="${PI_REMOTE_ROOT:-$HOME/repos/pi-remote}"
STATE_DIR="${PI_REMOTE_ROOT_STATE:-$HOME/.pi/pi-remote}"
PID_FILE="$STATE_DIR/bridge.pid"
LOG_FILE="$STATE_DIR/bridge.log"
META_FILE="$STATE_DIR/bridge.meta"
PORT="${PORT:-7700}"

usage() {
  cat <<EOF
pi-remote — mobile web UI for pi --mode rpc (Tailscale)

Usage:
  pi-remote [path]              Start in foreground (default: current directory)
  pi-remote start [path] [-d]   Start bridge (-d = background)
  pi-remote stop                Stop background bridge
  pi-remote status              Show running state + URL
  pi-remote restart [path]      Stop then start in background
  pi-remote backup              Build UI + snapshot to backups/

Env: PI_REMOTE_ROOT, AGENT_CWD, PORT, PI_REMOTE_ROOT_STATE
EOF
}

resolve_cwd() {
  local target="${1:-${AGENT_CWD:-$(pwd)}}"
  cd "$target" && pwd
}

read_meta() {
  if [[ -f "$META_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$META_FILE"
  fi
}

port_listener_pids() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

bridge_pids() {
  pgrep -f "bun run bridge\.ts" 2>/dev/null || true
  pgrep -f "bridge\.ts" 2>/dev/null | while read -r pid; do
    ps -p "$pid" -o command= 2>/dev/null | rg -q "pi-remote|bridge\.ts" && echo "$pid"
  done || true
}

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  local bp
  bp="$(bridge_pids | head -1)"
  [[ -n "$bp" ]]
}

cmd_status() {
  read_meta
  local url="http://$(tailscale ip -4 2>/dev/null || hostname):$PORT"
  if is_running; then
    local pid="${BRIDGE_PID:-$(cat "$PID_FILE" 2>/dev/null || bridge_pids | head -1)}"
    echo "pi-remote: running (pid $pid, port $PORT)"
    echo "  cwd:  ${BRIDGE_CWD:-unknown}"
    echo "  root: ${BRIDGE_ROOT:-$PI_REMOTE_ROOT}"
    echo "  url:  $url"
    echo "  log:  $LOG_FILE"
    return 0
  fi
  echo "pi-remote: stopped (port $PORT free for bridge)"
  local listeners
  listeners="$(port_listener_pids | tr '\n' ' ' | xargs echo 2>/dev/null || true)"
  if [[ -n "${listeners// /}" ]]; then
    echo "  note: something else is listening on $PORT (pids: $listeners)"
  fi
  return 1
}

cmd_stop() {
  local stopped=0
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "[pi-remote] stopping pid $pid"
      kill "$pid" 2>/dev/null || true
      for _ in $(seq 1 20); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.25
      done
      kill -9 "$pid" 2>/dev/null || true
      stopped=1
    fi
    rm -f "$PID_FILE" "$META_FILE"
  fi

  while read -r pid; do
    [[ -z "$pid" ]] && continue
    echo "[pi-remote] stopping bridge pid $pid"
    kill "$pid" 2>/dev/null || true
    stopped=1
  done < <(bridge_pids | sort -u)

  if [[ "$stopped" -eq 0 ]]; then
    echo "[pi-remote] not running"
  else
    echo "[pi-remote] stopped"
  fi
}

cmd_start() {
  local background=0
  local cwd_arg=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -d|--background|--daemon) background=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) cwd_arg="$1"; shift ;;
    esac
  done

  if is_running; then
    echo "[pi-remote] already running — use 'pi-remote status' or 'pi-remote stop' first"
    cmd_status || true
    exit 1
  fi

  export AGENT_CWD="$(resolve_cwd "$cwd_arg")"
  export PORT

  cd "$PI_REMOTE_ROOT"
  echo "[pi-remote] root=$PI_REMOTE_ROOT cwd=$AGENT_CWD port=$PORT"
  pnpm run build:ui

  mkdir -p "$STATE_DIR"

  if [[ "$background" -eq 1 ]]; then
    : > "$LOG_FILE"
    nohup pnpm start >>"$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" >"$PID_FILE"
    cat >"$META_FILE" <<META
BRIDGE_PID=$pid
BRIDGE_CWD=$AGENT_CWD
BRIDGE_ROOT=$PI_REMOTE_ROOT
BRIDGE_PORT=$PORT
META
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      echo "[pi-remote] started in background (pid $pid)"
      cmd_status || true
    else
      echo "[pi-remote] failed to start — see $LOG_FILE"
      tail -20 "$LOG_FILE" 2>/dev/null || true
      exit 1
    fi
  else
    echo "[pi-remote] foreground — Ctrl+C to stop"
    exec pnpm start
  fi
}

cmd_backup() {
  cd "$PI_REMOTE_ROOT"
  echo "[pi-remote] building UI..."
  pnpm run build:ui
  bash "$PI_REMOTE_ROOT/scripts/backup-release.sh"
  local sha
  sha="$(git -C "$PI_REMOTE_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "[pi-remote] backup complete (git $sha)"
}

main() {
  local cmd="${1:-start}"
  shift || true

  case "$cmd" in
    start)
      cmd_start "$@"
      ;;
    stop)
      cmd_stop
      ;;
    status|st)
      cmd_status
      ;;
    restart)
      cmd_stop || true
      sleep 0.5
      cmd_start "$@" -d
      ;;
    backup)
      cmd_backup
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      # Bare path or unknown first arg → foreground start from that path
      cmd_start "$cmd" "$@"
      ;;
  esac
}

main "$@"
