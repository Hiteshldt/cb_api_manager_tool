# Carbelim API Engine — AWS Deployment Guide

Complete guide: branch → EC2 → running in production.

---

## Part 1 — Git: Create the production branch

Do this **once** on your local machine:

```bash
cd cb_api_server_tool

# Create production branch from your current working code
git checkout -b production

# Push it to GitHub
git push origin production
```

From now on, your workflow is:
- Work on `main` (or any feature branch)
- When ready to deploy → `git merge main` into `production` → `git push origin production`
- GitHub Actions auto-deploys to EC2 every time you push to `production`

---

## Part 2 — AWS: Create the EC2 instance

### 2.1 Launch instance

Go to **AWS Console → EC2 → Launch Instance**

| Setting | Value |
|---|---|
| **Name** | `carbelim-api-engine` |
| **AMI** | Ubuntu Server 22.04 LTS |
| **Instance type** | `t3.small` (2 vCPU, 2 GB RAM) — enough for this |
| **Key pair** | Create new → name it `carbelim-key` → download `.pem` file → keep it safe |
| **Storage** | 20 GB gp3 |

### 2.2 Security Group (firewall rules)

Add these **inbound rules**:

| Type | Port | Source | Why |
|---|---|---|---|
| SSH | 22 | My IP | So you can SSH in |
| HTTP | 80 | 0.0.0.0/0 | Admin UI + output APIs (via Nginx) |
| HTTPS | 443 | 0.0.0.0/0 | For later when you add SSL |

> **Do NOT open port 3001 publicly** — Nginx on port 80 proxies to it. Port 3001 stays internal.

### 2.3 Elastic IP (so your IP never changes)

AWS Console → **Elastic IPs → Allocate → Associate** → pick your instance.

Write down your Elastic IP — you'll use it everywhere below.

---

## Part 3 — First-time server setup

### 3.1 SSH into the instance

```bash
# On your Mac/local machine
chmod 400 ~/Downloads/carbelim-key.pem
ssh -i ~/Downloads/carbelim-key.pem ubuntu@YOUR_ELASTIC_IP
```

### 3.2 Update setup-server.sh with your repo URL

Before running, edit one line in the script:

```bash
# In scripts/setup-server.sh, change:
REPO_URL="https://github.com/YOUR_ORG/cb_api_server_tool.git"
# to your actual GitHub URL
```

Commit and push that change first, then on the server:

```bash
# On the EC2 server
curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/cb_api_server_tool/production/scripts/setup-server.sh -o setup.sh
chmod +x setup.sh
./setup.sh
```

This installs Node.js, Nginx, PM2, clones the repo, starts the app. Takes ~3 minutes.

### 3.3 Set your admin key

```bash
nano ~/cb_api_server_tool/.env
```

```env
PORT=3001
ADMIN_API_KEY=your-strong-secret-here     ← change this
CONFIG_DIR=./data
DEBUG=false
```

Then restart:
```bash
pm2 restart cb-api-engine
```

### 3.4 Verify it's running

```bash
curl http://localhost:3001/health
# → {"status":"ok","uptime":12,"sources":0,"endpoints":0,...}

curl http://YOUR_ELASTIC_IP/health
# → same, via Nginx on port 80
```

Open in browser: **http://YOUR_ELASTIC_IP/admin**

---

## Part 4 — Auto-deploy with GitHub Actions

Every push to `production` branch → auto-deploys to EC2.

### 4.1 Add GitHub Secrets

GitHub → your repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|---|---|
| `EC2_HOST` | Your Elastic IP (e.g. `13.234.56.78`) |
| `EC2_SSH_KEY` | Full contents of your `.pem` file (open it in a text editor, copy everything) |

### 4.2 Test it

```bash
# On your local machine
git checkout production
git merge main          # or whatever branch has your changes
git push origin production
```

Go to **GitHub → Actions** — you'll see the workflow running.  
In ~30 seconds your EC2 will have the new code.

---

## Part 5 — Manual deploy (without GitHub Actions)

If you want to deploy manually from your local machine:

```bash
# From your Mac — SSH in and run deploy in one command
ssh -i ~/Downloads/carbelim-key.pem ubuntu@YOUR_ELASTIC_IP \
  "cd ~/cb_api_server_tool && ./scripts/deploy.sh"
```

Or SSH in first, then:

```bash
cd ~/cb_api_server_tool
./scripts/deploy.sh
```

The script: pulls latest code → installs deps → restarts PM2 → health checks → reports.

---

## Part 6 — Diagnosing problems

### Is the app running?

```bash
pm2 status
# NAME             STATUS   CPU   MEM
# cb-api-engine    online   0%    45mb   ← good
# cb-api-engine    errored  —     —      ← bad, check logs
```

### App logs (your code's own logs)

```bash
pm2 logs cb-api-engine          # live tail
pm2 logs cb-api-engine --lines 100  # last 100 lines

# Or directly from log files:
tail -f ~/cb_api_server_tool/data/logs/app.log
tail -f ~/cb_api_server_tool/data/logs/errors.log
tail -f ~/cb_api_server_tool/data/logs/pm2-error.log
```

### Nginx logs

```bash
sudo tail -f /var/log/nginx/access.log   # every HTTP request
sudo tail -f /var/log/nginx/error.log    # Nginx errors (502, config issues)
```

### Health check

```bash
# Quick check — is the app responding?
curl http://localhost:3001/health

# Expected:
# {"status":"ok","uptime":3600,"sources":2,"endpoints":3,...}

# If this fails but PM2 shows online → port issue, check .env PORT
# If PM2 shows errored → check pm2 logs
# If nginx 502 → app crashed or wrong port in nginx config
```

### Common problems and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` from Nginx | App not running or wrong port | `pm2 status` → `pm2 restart cb-api-engine` |
| App keeps crashing | Error in code or missing .env | `pm2 logs cb-api-engine --err` |
| Can't reach port 80 | Security group missing HTTP rule | AWS Console → Security Group → add port 80 |
| Admin key not working | .env not loaded | `cat .env` to verify, then `pm2 restart` |
| Data lost after restart | Data is on EC2 disk, which is fine; only lost if instance terminated | Snapshots or EBS backup |
| GitHub Action fails | SSH key or IP wrong | Check Secrets in GitHub Settings |

### Restart commands

```bash
pm2 restart cb-api-engine    # restart app
pm2 reload cb-api-engine     # zero-downtime reload
pm2 stop cb-api-engine       # stop
pm2 start ecosystem.config.js --env production   # start fresh

sudo systemctl restart nginx  # restart Nginx
sudo nginx -t                 # test Nginx config before restarting
```

### Real-time monitoring

```bash
pm2 monit    # live CPU/RAM/logs dashboard in terminal
```

---

## Part 7 — Updating Nginx config

If you change `nginx/carbelim.conf` in the repo:

```bash
sudo cp ~/cb_api_server_tool/nginx/carbelim.conf /etc/nginx/sites-available/carbelim
sudo nginx -t           # test — must say "syntax is ok"
sudo systemctl reload nginx
```

---

## Part 8 — Adding HTTPS (optional but recommended)

Once you have a domain pointing to your Elastic IP:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com

# Auto-renew is set up automatically
# Test renewal:
sudo certbot renew --dry-run
```

Then uncomment the HTTPS block in `nginx/carbelim.conf`.

---

## Quick reference

```
Local machine                   EC2 server
─────────────────               ────────────────────────────────
git push origin production  →   GitHub Actions SSHes in
                            →   ./scripts/deploy.sh runs
                            →   git pull + npm install + pm2 reload
                            →   health check passes ✅

URLs (replace IP):
  Admin UI:   http://YOUR_IP/admin
  Health:     http://YOUR_IP/health
  Output:     http://YOUR_IP/output/btte1260001

Diagnose:
  pm2 status
  pm2 logs cb-api-engine
  curl http://localhost:3001/health
```
