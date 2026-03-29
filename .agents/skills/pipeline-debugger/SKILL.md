---
name: pipeline-debugger
description: Auto-invoke when debugging PDF processing failures, transcription issues, BullMQ job problems, Marker CLI errors, WhisperX failures, or worker processing issues. Use when troubleshooting any processing pipeline in QuiverDM.
---

# Pipeline Debugger

Expert at debugging QuiverDM's processing pipelines for PDFs and transcription.

## When This Skill Applies

Auto-invoke when the user mentions:
- PDF processing errors or failures
- Transcription not working
- Jobs stuck in queue
- Marker CLI issues
- WhisperX problems
- Worker crashes or timeouts
- Redis/queue issues

## Pipeline Overview

### PDF Processing Pipeline
```
Upload → Storage → Queue Job → Worker → Marker CLI → Markdown → AI Extraction → Database
```

**Key Files:**
- `src/lib/queue.ts` - BullMQ job queue setup
- `src/lib/queue-worker.ts` - PDF worker processing
- `src/lib/marker.ts` - Marker CLI wrapper
- `src/lib/ai-extraction.ts` - Multi-provider content extraction
- `src/server/routers/homebrew-pdf.ts` - Upload and status API

### Transcription Pipeline
```
Upload → Storage → TranscriptionJob → WhisperX Python → Progress Events → Transcript → Database
```

**Key Files:**
- `src/lib/whisperx.ts` - WhisperX subprocess management
- `src/lib/transcription-progress.ts` - Progress tracking
- `src/server/routers/session-transcription.ts` - Transcription API

## Common Issues & Solutions

### PDF Processing

**Issue: Job stuck in "processing"**
```bash
# Check Redis queue
docker exec -it quiverdm-redis redis-cli
> KEYS bull:*
> LRANGE bull:pdf-processing:active 0 -1
```

**Issue: Marker crashes on complex PDF**
- Fallback to PyMuPDF is automatic
- Check `markerMetadata` in HomebrewPDF record
- Look for OOM errors in worker logs

**Issue: AI extraction fails**
- Check API key in UserSettings (encrypted)
- Verify provider is configured (OpenAI/Anthropic/Ollama)
- Check `src/lib/ai-extraction.ts` for token limits

### Transcription

**Issue: WhisperX model not loading**
```bash
# Check GPU availability
nvidia-smi

# Verify model download
python -c "import whisperx; whisperx.load_model('medium')"
```

**Issue: Speaker diarization fails**
- Requires HuggingFace token for pyannote models
- Check `HF_TOKEN` in environment
- Max speakers default is 8

**Issue: Progress not updating**
- Check WebSocket connection
- Verify `transcription-progress.ts` event handling
- Check TranscriptionJob.currentStep in database

## Debugging Commands

### Check Queue Status
```typescript
import { getQueue } from '@/lib/queue';

const queue = getQueue();
const jobs = await queue.getJobs(['active', 'waiting', 'failed']);
console.log(jobs.map(j => ({ id: j.id, state: j.state, data: j.data })));
```

### Check Job Progress
```sql
-- In Prisma Studio or psql
SELECT id, status, progress, currentStep, errorMessage
FROM "TranscriptionJob"
WHERE status = 'processing'
ORDER BY "createdAt" DESC;
```

### Trace PDF Processing
```sql
SELECT id, filename, "processingStatus", "errorMessage", "markerMetadata"
FROM "HomebrewPDF"
WHERE "processingStatus" = 'failed'
ORDER BY "createdAt" DESC;
```

### Monitor Worker Logs
```bash
# If running worker separately
npm run worker:pdf:dev

# Check for Python subprocess errors
# Look for Marker CLI output parsing issues
```

## Job Queue Architecture

### BullMQ Configuration
- Redis backend at `REDIS_URL` or `localhost:6380`
- Retry: 3 attempts with exponential backoff (5s, 10s, 20s)
- Job retention: 24 hours completed, 7 days failed
- Concurrency: 1 job at a time (resource intensive)

### Job States
```
waiting → active → completed
                 → failed (retries exhausted)
                 → delayed (retry pending)
```

### Clearing Stuck Jobs
```typescript
import { getQueue } from '@/lib/queue';

const queue = getQueue();
// Remove failed jobs
await queue.clean(0, 1000, 'failed');
// Remove old completed jobs
await queue.clean(24 * 60 * 60 * 1000, 1000, 'completed');
```

## Environment Variables

**PDF Processing:**
- `REDIS_URL` - Redis connection
- `MARKER_PATH` - Path to Marker CLI (optional)
- User API keys in database (encrypted)

**Transcription:**
- `HF_TOKEN` - HuggingFace for speaker models
- GPU auto-detected via CUDA

## Debugging Workflow

1. **Identify failure point** - Check database status fields
2. **Get error message** - Look at errorMessage column
3. **Check logs** - Worker console output, Python stderr
4. **Trace data flow** - Follow job from queue to final storage
5. **Test isolation** - Run CLI tool directly to verify external deps
6. **Check resources** - GPU memory, disk space, Redis connection
