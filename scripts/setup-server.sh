#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Carbelim API Engine — ONE-TIME server setup
#  Run this ONCE on a fresh Ubuntu 22.04 EC2 instance as ubuntu user
#
#  Usage:
#    chmod +x setup-server.sh
#    ./setup-server.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="$HOME/cb_api_server_tool"
REPO_URL="https://github.com/YOUR_ORG/cb_api_server_tool.git"   # ← change this
BRANCH="production"
NODE_VERSION="20"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Carbelim API Engine — Server Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. System packages ────────────────────────────────────────
echo "[1/7] Updating system packages..."
sudo apt-get update -q
sudo apt-get install -y -q git curl nginx

# ── 2. Node.js (via NodeSource) ───────────────────────────────
echo "[2/7] Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt-get install -y -q nodejs
node -v && npm -v

# ── 3. PM2 ───────────────────────────────────────────────────
echo "[3/7] Installing PM2..."
sudo npm install -g pm2
pm2 --version

# ── 4. Clone repo ─────────────────────────────────────────────
echo "[4/7] Cloning repository..."
if [ -d "$APP_DIR" ]; then
  echo "  Directory $APP_DIR already exists — pulling latest instead"
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 5. Install dependencies ───────────────────────────────────
echo "[5/7] Installing npm dependencies..."
npm install --omit=dev

# ── 6. Create .env ────────────────────────────────────────────
echo "[6/7] Creating .env file..."
if [ ! -f "$APP_DIR/.env" ]; then
  cat > "$APP_DIR/.env" << EOF
PORT=3001
ADMIN_API_KEY=CHANGE_THIS_SECRET_$(openssl rand -hex 8)
CONFIG_DIR=./data
DEBUG=false
EOF
  echo ""
  echo "  ⚠️  .env created with a random admin key."
  echo "  Edit it now: nano $APP_DIR/.env"
  echo ""
else
  echo "  .env already exists — skipping"
fi

# ── 7. Nginx config ───────────────────────────────────────────
echo "[7/7] Setting up Nginx..."
sudo cp "$APP_DIR/nginx/carbelim.conf" /etc/nginx/sites-available/carbelim
sudo ln -sf /etc/nginx/sites-available/carbelim /etc/nginx/sites-enabled/carbelim
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

# ── Start app with PM2 ────────────────────────────────────────
echo ""
echo "Starting app with PM2..."
cd "$APP_DIR"
pm2 start ecosystem.config.js --env production
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
# run the printed command if it appears

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  Setup complete!"
echo ""
echo "  Admin UI:    http://$(curl -s ifconfig.me)/admin"
echo "  Health:      http://$(curl -s ifconfig.me)/health"
echo "  PM2 status:  pm2 status"
echo "  PM2 logs:    pm2 logs cb-api-engine"
echo ""
echo "  ⚠️  Read your ADMIN_API_KEY from: cat $APP_DIR/.env"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
