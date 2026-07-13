#!/bin/bash
# Redeploy QuiverDM workers on the homelab after a git push.
# Run from /opt/quiverdm or anywhere — it CDs there.
set -euo pipefail

APP_DIR="/opt/quiverdm"
cd "$APP_DIR"

echo "[deploy] Pulling latest..."
git pull origin main

echo "[deploy] Installing dependencies..."
npm ci   # postinstall runs `prisma generate` — the client is generated here

# NOTE: no `prisma db push` here. Schema is managed out-of-band via idempotent
# prisma/manual/*.sql applied with `prisma db execute` (see CLAUDE.md). Running
# db push against the shared live DB fights unmerged-branch drift and aborts the
# deploy (e.g. it tried to drop the unmerged Encounter Studio tables). Apply
# schema by hand before deploying, not here.

echo "[deploy] Building recapforge..."
npm run build -w recapforge

echo "[deploy] Restarting workers (and starting any new ones)..."
pm2 startOrRestart "$APP_DIR/deploy/homelab/ecosystem.config.js"
pm2 save

echo "[deploy] Done. pm2 status:"
pm2 list
