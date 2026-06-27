#!/usr/bin/env bash
# Snapshot built UI + git SHA for rollback.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$ROOT/backups/$STAMP"

mkdir -p "$DEST"
cp -R "$ROOT/public" "$DEST/"
cp "$ROOT/package.json" "$DEST/" 2>/dev/null || true
git -C "$ROOT" rev-parse HEAD > "$DEST/git-sha.txt"
git -C "$ROOT" describe --tags --always > "$DEST/git-describe.txt" 2>/dev/null || true
echo "$STAMP" > "$ROOT/BUILD.txt"
echo "Backed up to $DEST"
