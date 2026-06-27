#!/usr/bin/env bash
# Back-compat wrapper — prefer pi-remote.sh directly.
exec "$(dirname "$0")/pi-remote.sh" start "$@"
