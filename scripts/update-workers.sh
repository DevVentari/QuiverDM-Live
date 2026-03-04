#!/usr/bin/env bash
set -euo pipefail

cd /opt/quiverdm

echo "[update] Pulling latest..."
git pull --ff-only origin main

echo "[update] Installing dependencies..."
npm install --production=false

echo "[update] Generating Prisma client..."
npx prisma generate

echo "[update] Restarting workers..."
systemctl restart quiverdm-workers

echo "[update] Done. Status:"
systemctl status quiverdm-workers --no-pager
