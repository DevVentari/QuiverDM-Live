# PDF Processing

QuiverDM processes homebrew PDFs using Marker (PDF→Markdown) with a Redis job queue for reliable background processing.

## Architecture

```
Upload PDF → Redis Queue → Worker → Marker → Database
                ↓
         (Survives crashes)
```

**Key benefits:**
- Jobs persist through server crashes
- Automatic retry (3 attempts)
- Concurrent processing limit (default: 2)
- Real-time progress tracking

## Quick Start

```bash
# Terminal 1: Start Redis
docker-compose up -d redis

# Terminal 2: Start Next.js
npm run dev

# Terminal 3: Start Worker (required!)
npm run worker:pdf
```

Now PDFs process reliably in the background.

## Setup

### 1. Install Marker

```bash
pip install marker-pdf
marker_single --version
```

### 2. Start Redis

```bash
docker-compose up -d redis

# Verify it's running
docker-compose ps redis
```

### 3. Configure Environment

Add to `.env.local`:

```env
# Redis (Local Docker)
REDIS_URL=redis://localhost:6380

# Worker Settings
PDF_WORKER_CONCURRENCY=2
```

### 4. Run the Worker

```bash
# Standard
npm run worker:pdf

# With auto-reload
npm run worker:pdf:dev
```

## Processing Flow

1. **Upload**: PDF uploaded via drag-and-drop UI
2. **Queue**: Job added to Redis queue
3. **Worker**: Separate process picks up job
4. **Marker**: Converts PDF to Markdown
5. **Database**: Saves result, updates status

## Status Lifecycle

```
pending → processing → completed
                    ↘ failed (can retry)
```

## Usage

### Upload a PDF

```typescript
// Via UI: /homebrew page with drag-and-drop
// Or via tRPC:
await trpc.homebrewPdf.processPDF.mutate({ pdfId: 'abc123' });
```

### Check Job Status

```typescript
const { data } = trpc.homebrewPdf.getJobStatus.useQuery({ pdfId: 'abc123' });

console.log(data.job.state);     // 'waiting' | 'active' | 'completed' | 'failed'
console.log(data.job.progress);  // 0-100
```

### Monitor Queue

```typescript
const stats = trpc.homebrewPdf.getQueueStats.useQuery();

// { waiting: 2, active: 1, completed: 15, failed: 1 }
```

### Cancel a Job

```typescript
await trpc.homebrewPdf.cancelJob.mutate({ pdfId: 'abc123' });
```

## Marker Commands

```bash
# Basic conversion
marker_single "/path/to/file.pdf" "/output/directory"

# With LLM enhancement (better tables)
marker_single "/path/to/file.pdf" "/output/directory" \
  --use_llm --llm_model "gemini/gemini-2.0-flash-exp"

# Force OCR (scanned PDFs)
marker_single "/path/to/file.pdf" "/output/directory" --force_ocr
```

## Performance

| PDF Type | Pages | Time |
|----------|-------|------|
| Simple text | 5 | 20-40s |
| Complex layout | 10 | 1-2 min |
| With images | 20 | 2-5 min |
| Large (100+) | 100 | 10-30 min |

**Resource usage per job:**
- ~500MB-2GB RAM
- 1-2 CPU cores
- GPU helps significantly for large PDFs

## Configuration

### Worker Concurrency

```env
PDF_WORKER_CONCURRENCY=2   # Max simultaneous jobs
```

**Guidelines:**
- `1` - Sequential (safest)
- `2` - Balanced (default)
- `4+` - High throughput (needs more RAM/CPU)

### Queue Options

Jobs retry up to 3 times with exponential backoff. Completed jobs kept for 24 hours, failed jobs for 7 days.

## Troubleshooting

### Jobs not processing

Check worker is running:
```bash
npm run worker:pdf
# Should see: "[Worker] PDF processing worker started..."
```

Check Redis is running:
```bash
docker-compose ps redis
```

### Job failed

Check error message:
```typescript
const { data } = trpc.homebrewPdf.getPDF.useQuery({ pdfId: 'abc123' });
console.log(data.errorMessage);
```

Common errors:
- `"Failed to download PDF"` - Storage issue
- `"Marker conversion failed"` - Corrupted PDF or Marker not installed
- `"ECONNREFUSED"` - Redis not running

### Retry a failed job

```typescript
await trpc.homebrewPdf.processPDF.mutate({ pdfId: 'abc123' });
```

### Worker memory growing

Restart worker, or limit memory:
```bash
NODE_OPTIONS="--max-old-space-size=2048" npm run worker:pdf
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/queue.ts` | Queue configuration & helpers |
| `src/lib/queue-worker.ts` | Worker process |
| `src/lib/marker.ts` | Marker PDF conversion |
| `src/server/routers/homebrew-pdf.ts` | tRPC endpoints |

## Redis CLI Monitoring

```bash
docker exec -it quiverdm-redis redis-cli

# Queue length
LLEN bull:pdf-processing:wait

# Active jobs
LLEN bull:pdf-processing:active

# Real-time monitoring
MONITOR
```
