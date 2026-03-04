#!/usr/bin/env bash
set -euo pipefail

# Tier 1 workers for LXC 402 (no Ollama/GPU dependencies)
# pdf, transcription, webhooks

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

cleanup() {
  echo "[workers] Shutting down..."
  kill 0
  wait
}
trap cleanup SIGINT SIGTERM EXIT

echo "[workers] Starting Tier 1 workers (pdf, transcription, webhooks)..."

npx tsx src/lib/queue/worker.ts &
npx tsx src/lib/queue/transcription-worker.ts &
npx tsx src/lib/queue/webhooks-worker.ts &

echo "[workers] All workers started. PIDs: $(jobs -p | tr '\n' ' ')"
wait
