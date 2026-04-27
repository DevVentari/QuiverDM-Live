#!/bin/bash
# Redeploy QuiverDM workers on the homelab after a git push.
# Run from /opt/quiverdm or anywhere — it CDs there.
set -euo pipefail

APP_DIR="/opt/quiverdm"
cd "$APP_DIR"

echo "[deploy] Pulling latest..."
git pull origin main

echo "[deploy] Installing dependencies..."
npm ci

echo "[deploy] Pushing schema changes..."
npx prisma db push --skip-generate

echo "[deploy] Restarting workers..."
pm2 restart all

echo "[deploy] Done. pm2 status:"
pm2 list
