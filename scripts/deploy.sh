#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Carbelim API Engine — Deploy latest production code
#  Run this ON the EC2 server whenever you want to update
#
#  Usage (on server):
#    ./scripts/deploy.sh
#
#  Or via SSH from local machine:
#    ssh ubuntu@YOUR_EC2_IP "cd ~/cb_api_server_tool && ./scripts/deploy.sh"
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="$HOME/cb_api_server_tool"
BRANCH="production"

cd "$APP_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Carbelim API Engine — Deploying"
PREV_COMMIT=$(git rev-parse --short HEAD)
echo "  From: $PREV_COMMIT → pulling $BRANCH..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Pull latest code
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

NEW_COMMIT=$(git rev-parse --short HEAD)
echo "  Now at: $NEW_COMMIT"

# Install/update dependencies
echo "  Installing dependencies..."
npm install --omit=dev --silent

# Restart app (zero-downtime PM2 reload)
echo "  Restarting app..."
pm2 reload cb-api-engine || pm2 start ecosystem.config.js --env production
pm2 save

# Quick health check
sleep 2
PORT=$(grep PORT .env | cut -d= -f2 | tr -d '[:space:]' || echo 3001)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health)

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✅  Health check passed (HTTP $HTTP_CODE)"
  echo "  Deployed $PREV_COMMIT → $NEW_COMMIT"
else
  echo "  ❌  Health check FAILED (HTTP $HTTP_CODE)"
  echo "  Run 'pm2 logs cb-api-engine' to see what's wrong"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
