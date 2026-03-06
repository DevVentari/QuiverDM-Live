#!/bin/bash
set -e

echo "[Workers] Starting all QuiverDM workers..."

npx tsx src/lib/queue/worker.ts &
npx tsx src/lib/queue/transcription-worker.ts &
npx tsx src/lib/queue/ai-summary-worker.ts &
npx tsx src/lib/queue/embeddings-worker.ts &
npx tsx src/lib/queue/image-generation-worker.ts &
npx tsx src/lib/queue/webhooks-worker.ts &
npx tsx src/lib/queue/derailment-worker.ts &
npx tsx src/lib/queue/combat-copilot-worker.ts &
npx tsx src/lib/queue/session-events-worker.ts &
npx tsx src/lib/queue/player-recap-worker.ts &
npx tsx src/lib/queue/feedback-triage-worker.ts &
npx tsx src/lib/queue/obsidian-import-worker.ts &

echo "[Workers] All 12 workers launched"

wait -n
echo "[Workers] A worker process exited, shutting down..."
exit 1
