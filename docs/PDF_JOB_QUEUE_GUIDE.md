# PDF Processing Job Queue Guide

QuiverDM uses **BullMQ** with **Redis** to provide durable, reliable background processing for PDF → Markdown conversion.

## 📋 Table of Contents

- [Why Job Queue?](#why-job-queue)
- [Architecture](#architecture)
- [Setup](#setup)
- [Running the Worker](#running-the-worker)
- [Monitoring](#monitoring)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

## Why Job Queue?

**Before (Fire-and-Forget):**
- ❌ If server crashes, processing work is lost
- ❌ No visibility into queue depth or processing status
- ❌ Can't limit concurrent processing (resource exhaustion)
- ❌ No automatic retry on failure

**After (BullMQ Job Queue):**
- ✅ Durable: Jobs persisted to Redis (survive crashes)
- ✅ Automatic retry with exponential backoff
- ✅ Concurrency limiting (default: 2 simultaneous jobs)
- ✅ Real-time progress tracking
- ✅ Job history and statistics
- ✅ Can scale workers horizontally

## Architecture

```
┌─────────────┐
│   Upload    │
│  (Browser)  │
└──────┬──────┘
       │ POST /api/homebrew/upload-pdf
       ↓
┌─────────────────┐
│   Next.js API   │
│   Route         │──────────► R2 Storage (PDF)
└──────┬──────────┘
       │ addPDFProcessingJob()
       ↓
┌─────────────────┐
│     Redis       │◄──────────┐
│  (Job Queue)    │           │
└──────┬──────────┘           │
       │                      │
       │ Job: {               │
       │   pdfId,            │ Update progress
       │   userId,           │
       │   r2Key,            │
       │   options           │
       │ }                   │
       ↓                     │
┌─────────────────┐          │
│  BullMQ Worker  │──────────┘
│  (Separate      │
│   Process)      │
└──────┬──────────┘
       │
       ├─► Download PDF from R2
       ├─► Run Marker conversion
       ├─► Update database
       └─► Clean up temp files
```

### Components

1. **Queue (`src/lib/queue.ts`)**
   - Defines queue configuration
   - Provides helper functions (add, cancel, status)
   - Redis connection management

2. **Worker (`src/lib/queue-worker.ts`)**
   - Separate process that consumes jobs
   - Downloads PDF, runs Marker, updates DB
   - Handles errors and retries

3. **API Route (`src/app/api/homebrew/upload-pdf/route.ts`)**
   - Receives file upload
   - Stores in R2
   - Queues processing job

4. **tRPC Router (`src/server/routers/homebrew-pdf.ts`)**
   - `processPDF` - Queue a job
   - `getJobStatus` - Check job progress
   - `cancelJob` - Cancel a running job
   - `getQueueStats` - Admin statistics

## Setup

### 1. Start Redis

Redis is already configured in `docker-compose.yml`:

```bash
docker-compose up -d redis
```

Verify Redis is running:

```bash
docker-compose ps redis
```

Should show:
```
NAME                 IMAGE            STATUS
quiverdm-redis       redis:7-alpine   Up
```

### 2. Configure Environment

Add to `.env.local`:

```env
# Redis Configuration (Local Docker)
REDIS_HOST="localhost"
REDIS_PORT="6380"

# Worker Configuration
PDF_WORKER_CONCURRENCY="2"  # Max 2 PDFs processing at once
```

**Production (Upstash):**
```env
REDIS_HOST="your-redis.upstash.io"
REDIS_PORT="6379"
# Upstash uses different auth - see Production section
```

### 3. Install Dependencies

Already installed via `npm install`:
```json
{
  "bullmq": "^5.63.1",
  "ioredis": "^5.8.2"
}
```

## Running the Worker

The worker **must run as a separate process** alongside your Next.js server.

### Development

**Terminal 1: Next.js Server**
```bash
npm run dev
```

**Terminal 2: PDF Worker**
```bash
npm run worker:pdf
```

Or with auto-restart on changes:
```bash
npm run worker:pdf:dev
```

### What the Worker Does

1. **Connects to Redis** - Listens for jobs in the `pdf-processing` queue
2. **Processes Jobs** - Downloads PDF, runs Marker, saves markdown
3. **Updates Database** - Sets status to `completed` or `failed`
4. **Reports Progress** - Updates job progress (0-100%)
5. **Handles Errors** - Retries up to 3 times with exponential backoff

### Worker Output

```
[Worker] PDF processing worker started with concurrency: 2
[Worker] Processing PDF: Homebrew_Monsters.pdf (ID: abc123)
[Worker] Generating R2 signed URL...
[Worker] Downloading PDF to: C:\temp\abc123.pdf
[Worker] Converting PDF to Markdown with Marker...
[Worker] Marker progress: 25%
[Worker] Marker progress: 50%
[Worker] Marker progress: 75%
[Worker] Marker progress: 100%
[Worker] Successfully processed PDF: Homebrew_Monsters.pdf in 45230ms
[Worker] Job abc123 completed successfully
```

## Monitoring

### Check Queue Status

From tRPC client:

```typescript
const stats = trpc.homebrewPdf.getQueueStats.useQuery();

console.log(stats.data);
// {
//   waiting: 2,    // Jobs waiting to be processed
//   active: 1,     // Jobs currently being processed
//   completed: 15, // Total completed jobs
//   failed: 1,     // Total failed jobs
//   delayed: 0,    // Jobs scheduled for later
//   total: 19
// }
```

### Check Individual Job Status

```typescript
const { data } = trpc.homebrewPdf.getJobStatus.useQuery({ pdfId: 'abc123' });

console.log(data.job);
// {
//   id: 'abc123',
//   state: 'active',          // waiting | active | completed | failed
//   progress: 45,             // 0-100
//   attemptsMade: 1,
//   failedReason: null,
//   processedOn: 1699123456,
//   finishedOn: null
// }
```

### Cancel a Job

```typescript
const cancel = trpc.homebrewPdf.cancelJob.useMutation();

await cancel.mutateAsync({ pdfId: 'abc123' });
```

### Redis CLI Monitoring

```bash
# Connect to Redis
docker exec -it quiverdm-redis redis-cli

# List all keys
KEYS *

# Get queue length
LLEN bull:pdf-processing:wait

# Get active jobs
LLEN bull:pdf-processing:active

# Monitor all commands (real-time)
MONITOR
```

## Configuration

### Queue Options (`src/lib/queue.ts`)

```typescript
{
  attempts: 3,                  // Retry up to 3 times
  backoff: {
    type: 'exponential',
    delay: 5000,                // Start with 5s delay
  },
  removeOnComplete: {
    age: 24 * 3600,             // Keep completed jobs for 24 hours
    count: 1000,                // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600,         // Keep failed jobs for 7 days
  },
}
```

### Worker Concurrency

Set via environment variable:

```env
PDF_WORKER_CONCURRENCY="2"   # Process up to 2 PDFs simultaneously
```

**Choosing Concurrency:**
- `1` - Sequential processing (safest, slowest)
- `2` - Default (balanced)
- `4+` - High concurrency (requires more RAM/CPU)

**Resource Usage per Job:**
- ~500MB-2GB RAM (depends on PDF size)
- 1-2 CPU cores (Marker is CPU-intensive)
- ~2-10 minutes (depends on PDF size and LLM usage)

### Job Timeouts

Default timeout: **No timeout** (Marker can take 10+ minutes for large PDFs)

To add timeout:
```typescript
await addPDFProcessingJob(data, {
  timeout: 600000,  // 10 minutes
});
```

## Troubleshooting

### Worker Not Processing Jobs

**Check if worker is running:**
```bash
# Windows
tasklist | findstr tsx

# Mac/Linux
ps aux | grep tsx
```

**Check Redis connection:**
```bash
docker-compose ps redis
docker-compose logs redis
```

**Check worker logs:**
```bash
npm run worker:pdf
# Should see: "[Worker] PDF processing worker started..."
```

### Jobs Stuck in "Processing"

**Possible causes:**
1. Worker crashed mid-processing
2. Marker hung on a bad PDF
3. Network issue downloading from R2

**Solutions:**
```bash
# Restart worker
npm run worker:pdf

# Check for stalled jobs (auto-detected)
# Worker will log: "[Worker] Job {id} has stalled"

# Manually fail stuck jobs via Redis CLI
docker exec -it quiverdm-redis redis-cli
> LLEN bull:pdf-processing:active  # Should be 0 if nothing active
```

### Jobs Failing Repeatedly

**Check error message:**
```typescript
const { data } = trpc.homebrewPdf.getPDF.useQuery({ pdfId: 'abc123' });
console.log(data.errorMessage);
```

**Common errors:**
- `"Failed to download PDF from R2"` - R2 credentials invalid or PDF deleted
- `"Marker conversion failed"` - Corrupted PDF or Marker not installed
- `"ECONNREFUSED"` - Redis not running

**Retry failed job:**
```typescript
// Will re-queue with fresh attempt counter
await trpc.homebrewPdf.processPDF.mutate({ pdfId: 'abc123' });
```

### Memory Leaks

**Symptoms:**
- Worker memory usage grows over time
- System becomes slow

**Solutions:**
```bash
# Monitor worker memory
# Windows
tasklist | findstr tsx

# Mac/Linux
ps aux | grep tsx

# Restart worker periodically (production)
# Use PM2 or systemd to auto-restart on high memory
```

**Code fix:**
- Ensure temp files are cleaned up (already implemented)
- Add memory limits to worker process:
```bash
NODE_OPTIONS="--max-old-space-size=2048" npm run worker:pdf
```

## Production Deployment

### Option 1: Single Server (Vercel + Upstash)

**Not recommended** - Vercel has 10s function timeout, too short for Marker.

### Option 2: Separate Worker Server

**Recommended** - Deploy worker to a VPS/cloud instance.

**Architecture:**
```
┌─────────────┐
│   Vercel    │
│  (Next.js)  │──► Upstash Redis ◄──┐
└─────────────┘                     │
                                    │
                        ┌───────────┴────────┐
                        │  VPS/Cloud Server  │
                        │  (Worker Process)  │
                        └────────────────────┘
```

**Setup:**

1. **Upstash Redis** (https://console.upstash.com)
   ```env
   REDIS_HOST="global-worker-12345.upstash.io"
   REDIS_PORT="6379"
   REDIS_PASSWORD="your-redis-password"
   ```

2. **Update `src/lib/queue.ts`:**
   ```typescript
   const redisConnection = {
     host: process.env.REDIS_HOST || 'localhost',
     port: parseInt(process.env.REDIS_PORT || '6380'),
     password: process.env.REDIS_PASSWORD, // Add this
     maxRetriesPerRequest: null,
   };
   ```

3. **Deploy Worker to VPS:**
   ```bash
   # SSH into server
   ssh user@your-server.com

   # Clone repo
   git clone https://github.com/your-org/quiverdm.git
   cd quiverdm

   # Install dependencies
   npm install

   # Set environment variables
   nano .env.local
   # Add: DATABASE_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, R2 credentials

   # Install PM2 for process management
   npm install -g pm2

   # Start worker with PM2
   pm2 start npm --name "quiverdm-pdf-worker" -- run worker:pdf

   # Save PM2 config
   pm2 save
   pm2 startup
   ```

4. **Monitor with PM2:**
   ```bash
   pm2 status           # Check status
   pm2 logs quiverdm-pdf-worker  # View logs
   pm2 restart quiverdm-pdf-worker  # Restart
   pm2 monit            # Real-time monitoring
   ```

### Option 3: Docker Container

**Dockerfile for Worker:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Install Marker dependencies
RUN apk add --no-cache python3 py3-pip
RUN pip3 install marker-pdf

CMD ["npm", "run", "worker:pdf"]
```

**docker-compose.yml:**
```yaml
services:
  pdf-worker:
    build: .
    restart: unless-stopped
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PORT=${REDIS_PORT}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - PDF_WORKER_CONCURRENCY=2
    depends_on:
      - redis
```

### Scaling Workers

Run multiple workers for higher throughput:

```bash
# Start 3 worker processes
pm2 start npm --name "pdf-worker-1" -i 1 -- run worker:pdf
pm2 start npm --name "pdf-worker-2" -i 1 -- run worker:pdf
pm2 start npm --name "pdf-worker-3" -i 1 -- run worker:pdf
```

BullMQ automatically distributes jobs across workers.

**Recommended:**
- 1-2 workers for small scale (<100 PDFs/day)
- 3-5 workers for medium scale (100-1000 PDFs/day)
- 10+ workers for high scale (1000+ PDFs/day)

## API Reference

### `addPDFProcessingJob(data)`

Queue a PDF for processing.

```typescript
import { addPDFProcessingJob } from '@/lib/queue';

const job = await addPDFProcessingJob({
  pdfId: 'abc123',
  userId: 'user-456',
  campaignId: 'campaign-789',
  r2Key: 'homebrew-pdfs/user-456/1699123456-document.pdf',
  filename: 'document.pdf',
  options: {
    useLLM: true,
    llmProvider: 'gemini',
  },
});

console.log(job.id); // 'abc123'
```

### `getPDFProcessingJobStatus(pdfId)`

Get job status and progress.

```typescript
import { getPDFProcessingJobStatus } from '@/lib/queue';

const status = await getPDFProcessingJobStatus('abc123');

console.log(status);
// {
//   id: 'abc123',
//   state: 'active',
//   progress: 45,
//   attemptsMade: 1,
//   failedReason: null,
//   finishedOn: null,
//   returnvalue: null
// }
```

### `cancelPDFProcessingJob(pdfId)`

Cancel a queued or active job.

```typescript
import { cancelPDFProcessingJob } from '@/lib/queue';

const cancelled = await cancelPDFProcessingJob('abc123');
console.log(cancelled); // true if cancelled, false if not found
```

### `getQueueStats()`

Get queue statistics.

```typescript
import { getQueueStats } from '@/lib/queue';

const stats = await getQueueStats();

console.log(stats);
// {
//   waiting: 2,
//   active: 1,
//   completed: 15,
//   failed: 1,
//   delayed: 0,
//   total: 19
// }
```

## Best Practices

1. **Always run worker in production** - Jobs won't process without it
2. **Monitor queue depth** - Alert if `waiting` count grows too large
3. **Set up health checks** - Restart worker if it crashes
4. **Clean up old jobs** - Use `cleanQueue()` or Redis TTL
5. **Use PM2 or systemd** - Auto-restart on failure
6. **Scale horizontally** - Add more workers, not more concurrency
7. **Log everything** - Worker logs are critical for debugging
8. **Test retry logic** - Simulate failures to verify retries work

## Next Steps

- [Implement WebSocket progress updates](./WEBSOCKET_PROGRESS_GUIDE.md)
- [Add markdown content extraction](./HOMEBREW_EXTRACTION_GUIDE.md)
- [Monitor with BullBoard](https://github.com/felixmosh/bull-board)
