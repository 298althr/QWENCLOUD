#!/bin/bash
# scripts/deploy-ecs.sh — safe deployment with versioning
# Usage: ./deploy-ecs.sh [label]
#
# Flow:
#   1. Save current version (for rollback)
#   2. Git fetch + reset to latest
#   3. Rebuild backend only (frontend is shipped pre-built)
#   4. Restart containers
#   5. Verify health

set -euo pipefail

APP_DIR="/opt/althr-autopilot"
SCRIPT_DIR="${APP_DIR}/scripts"
LABEL="${1:-update}"

cd "$APP_DIR"

echo "=== Step 1: Save current version ==="
bash "${SCRIPT_DIR}/versioning.sh" save "${LABEL}"

echo ""
echo "=== Step 2: Pull latest code ==="
git fetch origin track4
git reset --hard origin/track4

echo ""
echo "=== Step 3: Rebuild backend ==="
docker compose -f docker-compose.prod.yml build --no-cache backend

echo ""
echo "=== Step 4: Restart containers ==="
docker compose -f docker-compose.prod.yml up -d backend

echo ""
echo "=== Step 5: Initialize DB schema ==="
sleep 5
docker exec althr-backend node src/db/init.js 2>/dev/null || echo "[deploy] Schema init skipped (may already be up to date)"

echo ""
echo "=== Step 6: Health check ==="
sleep 5
HEALTH=$(curl -s http://localhost:3000/api/health || echo '{"status":"fail"}')
echo "Backend health: $HEALTH"

CONTAINERS=$(docker ps --format '{{.Names}} {{.Status}}')
echo ""
echo "Container status:"
echo "$CONTAINERS"

echo ""
echo "=== Deploy complete ==="
echo "To rollback: bash ${SCRIPT_DIR}/versioning.sh rollback-last"
