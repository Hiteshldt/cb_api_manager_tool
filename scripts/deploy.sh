#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Carbelim API Engine — Deploy latest code
#  Run ON the EC2 server (Amazon Linux 2023, ec2-user)
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="$HOME/cb_api_manager_tool"
BRANCH="production"
PORT=$(grep PORT "$APP_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo 3001)

cd "$APP_DIR"

PREV=$(git rev-parse --short HEAD)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploying $BRANCH  (was: $PREV)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Backup runtime config before any git operations ────────────────────────
echo "  Backing up runtime config..."
mkdir -p /tmp/cb_deploy_backup
cp "$APP_DIR/data/sources.json"         /tmp/cb_deploy_backup/sources.json         2>/dev/null || true
cp "$APP_DIR/data/transformations.json" /tmp/cb_deploy_backup/transformations.json 2>/dev/null || true
cp "$APP_DIR/data/endpoints.json"       /tmp/cb_deploy_backup/endpoints.json       2>/dev/null || true

# ── 2. Fetch + hard reset to remote ──────────────────────────────────────────
git fetch origin

# Untrack config files from git index if they were accidentally committed
git rm --cached data/sources.json data/transformations.json data/endpoints.json 2>/dev/null || true

# Force the working tree to exactly match GitHub
git reset --hard "origin/$BRANCH"
git checkout "$BRANCH" 2>/dev/null || true

NEXT=$(git rev-parse --short HEAD)
echo "  Now at: $NEXT"

# ── 3. Restore runtime config ─────────────────────────────────────────────────
echo "  Restoring runtime config..."
cp /tmp/cb_deploy_backup/sources.json         "$APP_DIR/data/sources.json"         2>/dev/null || true
cp /tmp/cb_deploy_backup/transformations.json "$APP_DIR/data/transformations.json" 2>/dev/null || true
cp /tmp/cb_deploy_backup/endpoints.json       "$APP_DIR/data/endpoints.json"       2>/dev/null || true
rm -rf /tmp/cb_deploy_backup

# ── 4. Install dependencies ───────────────────────────────────────────────────
npm install --omit=dev --silent

# ── 5. Reload app ─────────────────────────────────────────────────────────────
pm2 reload cb-api-engine || pm2 start ecosystem.config.js --env production
pm2 save

# ── 6. Health check ───────────────────────────────────────────────────────────
sleep 2
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health)

if [ "$HTTP" = "200" ]; then
  echo "  ✅  $PREV → $NEXT  deployed successfully"
else
  echo "  ❌  Health check failed after deploy (HTTP $HTTP)"
  echo "  Run: pm2 logs cb-api-engine"
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"