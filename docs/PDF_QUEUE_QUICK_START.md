# PDF Job Queue - Quick Start

## TL;DR

```bash
# Terminal 1: Start Redis
docker-compose up -d redis

# Terminal 2: Start Next.js
npm run dev

# Terminal 3: Start Worker
npm run worker:pdf
```

Now PDFs will process reliably in the background!

## What Changed?

### Before: Fire-and-Forget ❌
```
Upload PDF → Next.js API → Process (crash = lost work)
```

### After: Job Queue ✅
```
Upload PDF → Next.js API → Redis Queue → Worker → Done!
                               ↓
                         (Survives crashes)
```

## Why This Matters

| Issue | Before | After |
|-------|--------|-------|
| Server crashes | Lost work | ✅ Jobs resume |
| Concurrent PDFs | Unlimited (crash) | ✅ Limited to 2 |
| Retry on error | ❌ Manual | ✅ Automatic (3x) |
| Progress tracking | ❌ None | ✅ Real-time |
| Queue visibility | ❌ None | ✅ Full stats |

## How to Use

### 1. Upload a PDF (Frontend)

No changes needed! Upload works exactly the same:

```typescript
// Uploads happen via HomebrewPDFUpload component
// Jobs are automatically queued
```

### 2. Check Status (Frontend)

```typescript
const { data } = trpc.homebrewPdf.getJobStatus.useQuery({
  pdfId: 'abc123'
});

console.log(data.job.state);     // 'waiting' | 'active' | 'completed' | 'failed'
console.log(data.job.progress);  // 0-100
```

### 3. Monitor Queue (Admin)

```typescript
const stats = trpc.homebrewPdf.getQueueStats.useQuery();

console.log(stats.data);
// {
//   waiting: 2,      // PDFs waiting to process
//   active: 1,       // PDFs currently processing
//   completed: 15,   // Total completed
//   failed: 1        // Total failed
// }
```

## Configuration

### `.env.local`

```env
# Redis (Local Docker - default)
REDIS_HOST="localhost"
REDIS_PORT="6380"

# Worker Settings
PDF_WORKER_CONCURRENCY="2"  # Max 2 PDFs at once
```

### Adjust Concurrency

Want faster processing? Increase workers:

```env
PDF_WORKER_CONCURRENCY="4"  # Process up to 4 PDFs simultaneously
```

**Warning:** Each PDF uses ~500MB-2GB RAM and 1-2 CPU cores.

## Troubleshooting

### "Jobs not processing"

**Check worker is running:**
```bash
npm run worker:pdf
# Should see: "[Worker] PDF processing worker started..."
```

**Check Redis is running:**
```bash
docker-compose ps redis
# Should show: STATUS = Up
```

### "Job failed"

**Check error message:**
```typescript
const { data } = trpc.homebrewPdf.getPDF.useQuery({ pdfId: 'abc123' });
console.log(data.errorMessage);
```

**Retry:**
```typescript
await trpc.homebrewPdf.processPDF.mutate({ pdfId: 'abc123' });
```

### "Worker memory keeps growing"

**Restart worker:**
```bash
# Stop with Ctrl+C
npm run worker:pdf
```

**Production:** Use PM2 with auto-restart:
```bash
pm2 start npm --name "pdf-worker" -- run worker:pdf --max-memory-restart 2G
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/queue.ts` | Queue configuration & helpers |
| `src/lib/queue-worker.ts` | Worker process (runs separately) |
| `src/app/api/homebrew/upload-pdf/route.ts` | Queues jobs on upload |
| `src/server/routers/homebrew-pdf.ts` | tRPC endpoints for status/cancel |

## Production Deployment

### Vercel + Separate Worker Server

1. **Deploy Next.js to Vercel** (as usual)
2. **Deploy worker to VPS:**

```bash
# On VPS
git clone <repo>
npm install
npm install -g pm2

# Set environment variables
nano .env.local

# Start worker
pm2 start npm --name "pdf-worker" -- run worker:pdf
pm2 save
pm2 startup
```

3. **Use Upstash Redis:**

```env
REDIS_HOST="global-worker-12345.upstash.io"
REDIS_PORT="6379"
REDIS_PASSWORD="your-password"
```

Update `src/lib/queue.ts` to include password:
```typescript
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380'),
  password: process.env.REDIS_PASSWORD, // Add this line
  maxRetriesPerRequest: null,
};
```

## What's Next?

- [ ] WebSocket for real-time progress updates
- [ ] Parse markdown to extract homebrew content
- [ ] Bull Board for visual queue monitoring
- [ ] Email notifications on completion/failure

## Full Documentation

See [PDF_JOB_QUEUE_GUIDE.md](./PDF_JOB_QUEUE_GUIDE.md) for complete details.
