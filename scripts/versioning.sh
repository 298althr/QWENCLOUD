#!/bin/bash
# scripts/versioning.sh — deployment versioning & rollback for ECS
# Usage:
#   ./versioning.sh save [label]     — snapshot current code before update
#   ./versioning.sh list             — list saved versions
#   ./versioning.sh rollback <id>    — rollback to a specific version
#   ./versioning.sh rollback-last    — rollback to the most recent save
#   ./versioning.sh prune            — remove old versions beyond 10

set -euo pipefail

VERSIONS_DIR="/opt/althr-autopilot/.versions"
APP_DIR="/opt/althr-autopilot"
MAX_VERSIONS=10
EXCLUDE_PATTERNS="--exclude=.versions --exclude=node_modules --exclude=.next --exclude=.git --exclude=althr_pgdata --exclude=althr_redisdata --exclude=althr_files"

mkdir -p "$VERSIONS_DIR"

cmd_save() {
  local label="${1:-manual}"
  local ts=$(date +%Y%m%d_%H%M%S)
  local id="${ts}_${label}"
  local dest="${VERSIONS_DIR}/${id}"

  echo "[versioning] Saving snapshot: ${id}"
  mkdir -p "$dest"

  # Copy the app code (excluding heavy/runtime dirs)
  rsync -a $EXCLUDE_PATTERNS "$APP_DIR/" "$dest/"

  # Save git info
  cd "$APP_DIR"
  git rev-parse HEAD > "$dest/.git_hash" 2>/dev/null || echo "unknown" > "$dest/.git_hash"
  git log --oneline -5 > "$dest/.git_log" 2>/dev/null || true

  # Save .env if it exists (critical for rollback)
  if [ -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env" "$dest/.env"
  fi

  echo "[versioning] Saved: ${id}"
  echo "[versioning] Git hash: $(cat "$dest/.git_hash")"

  # Prune old versions
  cmd_prune
}

cmd_list() {
  echo "[versioning] Saved versions (newest first):"
  local count=0
  for dir in $(ls -1d "${VERSIONS_DIR}"/*/ 2>/dev/null | sort -r); do
    count=$((count + 1))
    local id=$(basename "$dir")
    local hash=$(cat "${dir}.git_hash" 2>/dev/null || echo "?")
    local label=$(echo "$id" | sed 's/^[0-9]*_[0-9]*_//')
    echo "  ${count}. ${id}  (git: ${hash:0:8})"
  done
  if [ $count -eq 0 ]; then
    echo "  (no versions saved yet)"
  fi
}

cmd_rollback() {
  local target="$1"
  local src=""

  if [ "$target" = "last" ] || [ "$target" = "-1" ]; then
    src=$(ls -1d "${VERSIONS_DIR}"/*/ 2>/dev/null | sort -r | head -1)
  else
    # Match by number (1 = newest) or by id prefix
    local count=0
    local dirs=()
    for dir in $(ls -1d "${VERSIONS_DIR}"/*/ 2>/dev/null | sort -r); do
      count=$((count + 1))
      dirs+=("$dir")
      if [ "$count" = "$target" ]; then
        src="$dir"
        break
      fi
    done
    if [ -z "$src" ]; then
      # Try matching by id prefix
      src=$(ls -1d "${VERSIONS_DIR}"/*${target}*/ 2>/dev/null | head -1)
    fi
  fi

  if [ -z "$src" ]; then
    echo "[versioning] ERROR: Version not found: ${target}"
    cmd_list
    exit 1
  fi

  local id=$(basename "$src")
  echo "[versioning] Rolling back to: ${id}"

  # Stop containers before restoring
  cd "$APP_DIR"
  docker compose -f docker-compose.prod.yml down 2>/dev/null || true

  # Restore code
  rsync -a $EXCLUDE_PATTERNS --delete "$src" "$APP_DIR/"

  # Restore .env
  if [ -f "${src}.env" ]; then
    cp "${src}.env" "$APP_DIR/.env"
    echo "[versioning] Restored .env"
  fi

  echo "[versioning] Code restored. Rebuilding..."
  docker compose -f docker-compose.prod.yml up -d --build backend
  echo "[versioning] Done. Backend rebuilt and started."
  echo "[versioning] Note: Frontend may need separate rebuild if it was changed."
}

cmd_prune() {
  local count=0
  local dirs=()
  for dir in $(ls -1d "${VERSIONS_DIR}"/*/ 2>/dev/null | sort -r); do
    count=$((count + 1))
    dirs+=("$dir")
  done

  if [ $count -gt $MAX_VERSIONS ]; then
    local to_remove=$((count - MAX_VERSIONS))
    echo "[versioning] Pruning ${to_remove} old version(s)..."
    for ((i = MAX_VERSIONS; i < count; i++)); do
      rm -rf "${dirs[$i]}"
      echo "[versioning] Removed: $(basename "${dirs[$i]}")"
    done
  fi
}

case "${1:-help}" in
  save)
    cmd_save "${2:-manual}"
    ;;
  list)
    cmd_list
    ;;
  rollback)
    if [ -z "${2:-}" ]; then
      echo "Usage: $0 rollback <id|number|last>"
      exit 1
    fi
    cmd_rollback "$2"
    ;;
  rollback-last)
    cmd_rollback "last"
    ;;
  prune)
    cmd_prune
    ;;
  *)
    echo "Usage: $0 {save [label]|list|rollback <id>|rollback-last|prune}"
    exit 1
    ;;
esac
