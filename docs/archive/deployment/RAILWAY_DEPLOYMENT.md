# Railway Deployment Guide for QuiverDM PDF Worker

This guide covers deploying the PDF processing worker to Railway alongside your Vercel frontend.

## Architecture Overview

```
[User] → [Vercel App] → [Railway Redis Queue] ← [Railway Worker]
                    ↘                           ↙
                      [Railway PostgreSQL]
```

- **Vercel**: Hosts Next.js app (frontend + API routes)
- **Railway**: Hosts Redis, PostgreSQL, and PDF Worker service
- **Worker**: Processes PDF→Markdown conversion and AI extraction

## Prerequisites

1. GitHub repo pushed (https://github.com/DevVentari/QuiverDM-Live)
2. Vercel deployment in progress
3. API keys for Gemini/OpenAI/Anthropic

## Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Sign up/login with GitHub
3. Click **"New Project"**
4. Select **"Empty Project"**

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Wait for provisioning (30 seconds)
4. Click the PostgreSQL service → **"Connect"** tab
5. Copy the `DATABASE_URL` (looks like: `postgresql://postgres:xxx@xxx.railway.app:5432/railway`)

## Step 3: Add Redis Database

1. Click **"+ New"** → **"Database"** → **"Redis"**
2. Wait for provisioning
3. Click Redis service → **"Connect"** tab
4. Copy the connection details:
   - Host: `xxx.railway.internal` or `xxx.railway.app`
   - Port: Usually `6379`
   - Full URL: `redis://default:xxx@xxx.railway.app:6379`

## Step 4: Deploy Worker Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select `DevVentari/QuiverDM-Live`
3. Railway will detect the `railway.toml` and `Dockerfile.worker`
4. Click the new service → **Settings**:
   - Service Name: `pdf-worker`
   - Build Command: (auto from Dockerfile)
   - Start Command: (auto from Dockerfile)

## Step 5: Configure Environment Variables

In the worker service, click **"Variables"** tab and add:

### Database Connection
```
DATABASE_URL=postgresql://postgres:xxx@xxx.railway.app:5432/railway
```
(Get this from Railway PostgreSQL service)

### Redis Connection
```
REDIS_HOST=xxx.railway.app
REDIS_PORT=6379
```
OR if using Redis URL:
```
REDIS_URL=redis://default:xxx@xxx.railway.app:6379
```

### AI API Keys (Required)
```
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### Worker Configuration (Optional)
```
PDF_WORKER_CONCURRENCY=2
NODE_ENV=production
```

## Step 6: Update Vercel Environment

Go to your Vercel project settings and update:

1. **DATABASE_URL** → Railway PostgreSQL URL
2. **REDIS_HOST** → Railway Redis host
3. **REDIS_PORT** → Railway Redis port (6379)

This ensures Vercel app pushes jobs to the same Redis queue that Railway worker reads from.

## Step 7: Migrate Database Schema

After Railway PostgreSQL is running, push your Prisma schema:

```bash
# Local machine
DATABASE_URL="your-railway-postgres-url" npx prisma db push
```

Or use Railway CLI:
```bash
railway run npx prisma db push
```

## Step 8: Deploy and Monitor

1. Push your changes to GitHub:
```bash
git add Dockerfile.worker railway.toml docs/RAILWAY_DEPLOYMENT.md
git commit -m "Add Railway worker deployment configuration"
git push origin main
```

2. Railway will automatically build and deploy
3. Monitor logs: Click worker service → **"Deployments"** → View logs

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://...` |
| `REDIS_HOST` | Redis server hostname | Yes | `xxx.railway.app` |
| `REDIS_PORT` | Redis server port | Yes | `6379` |
| `GEMINI_API_KEY` | Google Gemini API key | Yes* | `AIza...` |
| `OPENAI_API_KEY` | OpenAI API key | Yes* | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | No | `sk-ant-...` |
| `PDF_WORKER_CONCURRENCY` | Max concurrent PDF jobs | No | `2` |
| `NODE_ENV` | Environment mode | No | `production` |

*At least one AI provider key is required for content extraction.

## Estimated Costs

**Railway pricing (as of 2025):**
- **PostgreSQL**: $5/month (Hobby plan, 1GB storage)
- **Redis**: $5/month (Hobby plan)
- **Worker Service**: ~$5-10/month (based on usage)
  - Memory: $0.000231/GB/minute
  - CPU: $0.000463/vCPU/minute
- **Bandwidth**: $0.10/GB egress

**Total estimate: $15-25/month** for light to moderate usage

## Troubleshooting

### Worker not processing jobs
1. Check Redis connection: Ensure REDIS_HOST and REDIS_PORT match your Railway Redis service
2. Check logs: `railway logs`
3. Verify DATABASE_URL points to Railway PostgreSQL

### Python dependencies missing
The Dockerfile.worker installs PyMuPDF, but not the full Marker library (too large). The worker will use PyMuPDF fallback for PDF conversion.

### Out of memory
Increase Railway service memory limit in Settings → Resources

### Jobs stuck in "processing"
Redis connection might be lost. Check worker health and restart if needed.

## Important Limitations

1. **No full Marker support**: The Dockerfile installs PyMuPDF but not the full marker-pdf package (requires PyTorch, ~3GB). Your worker will use the PyMuPDF fallback.

2. **No GPU support**: Railway doesn't offer GPU instances. All PDF processing is CPU-based.

3. **Storage is ephemeral**: Processed PDFs are stored in the database, not on disk. R2 storage is still needed for uploads.

## Next Steps

1. ✅ Push deployment files to GitHub
2. ✅ Create Railway project and services
3. ✅ Configure environment variables
4. ✅ Migrate database schema
5. ✅ Test PDF upload from Vercel app
6. ✅ Monitor worker logs for successful processing

## Alternative: Modal.com for GPU Processing

If you need full Marker with GPU support, consider Modal.com:
- Serverless GPU functions
- Pay per second of compute
- Better for occasional heavy PDF processing
- Costs ~$1-2 per PDF with GPU

See separate guide: `docs/MODAL_DEPLOYMENT.md` (to be created)
