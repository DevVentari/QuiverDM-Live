#!/bin/bash
set -e

# Pre-warm Marker models so the first PDF job doesn't block on downloads.
# Models are cached at /root/.cache/datalab — mount a volume to persist across rebuilds.
if command -v marker_single &>/dev/null; then
  if [ ! -d "/root/.cache/datalab/models" ] || [ -z "$(ls -A /root/.cache/datalab/models 2>/dev/null)" ]; then
    echo "[Workers] Marker models not cached — pre-downloading now (first run only)..."
    python3 -c "
import tempfile, os
pdf = b'%PDF-1.4\n1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer\n<</Size 4 /Root 1 0 R>>\nstartxref\n190\n%%EOF'
with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
    f.write(pdf)
    print(f.name)
" > /tmp/.prewarm_pdf_path 2>/dev/null
    PREWARM_PDF=$(cat /tmp/.prewarm_pdf_path 2>/dev/null)
    if [ -n "$PREWARM_PDF" ]; then
      mkdir -p /tmp/marker-prewarm-out
      marker_single "$PREWARM_PDF" --output_dir /tmp/marker-prewarm-out > /tmp/marker-prewarm.log 2>&1 && \
        echo "[Workers] Marker models pre-downloaded successfully" || \
        echo "[Workers] Marker pre-warm failed (non-fatal) — check /tmp/marker-prewarm.log"
      rm -f "$PREWARM_PDF"
    fi
  else
    echo "[Workers] Marker models already cached"
  fi
fi

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
npx tsx src/lib/queue/brain-ingestion-worker.ts &
npx tsx src/lib/queue/world-simulation-worker.ts &

echo "[Workers] All 14 workers launched"

wait -n
echo "[Workers] A worker process exited, shutting down..."
exit 1
