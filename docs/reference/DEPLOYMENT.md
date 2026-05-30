# QuiverDM Deployment Guide

## Architecture

- **Next.js app** -> Vercel
- **PostgreSQL (pgvector)** -> Railway or Hetzner VPS
- **Redis** -> Railway or Hetzner VPS
- **BullMQ workers** -> Railway services (or VPS Docker)
- **MeiliSearch** -> Railway or VPS
- **Docling** -> Railway or VPS
- **File storage** -> Cloudflare R2
- **Tunnel** -> Cloudflare Tunnel (VPS only)

## Railway Deployment

### 1. Create Railway project

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
```

### 2. Add services

Add these services from the Railway dashboard:
- PostgreSQL (use custom image: `pgvector/pgvector:pg15`)
- Redis
- New Service -> deploy from GitHub repo (for workers)

### 3. Configure environment variables

Copy from `.env.production.example` and fill in all values.
Railway provides DATABASE_URL and REDIS_URL automatically for its managed services.

### 4. Deploy workers

Each BullMQ worker is a separate Railway service with a custom start command:
- PDF worker: `npm run worker:pdf`
- Transcription worker: `npm run worker:transcription`
- Webhooks worker: `npm run worker:webhooks`
- Summary worker: `npm run worker:summary`
- Embeddings worker: `npm run worker:embeddings`
- WebSocket server: `npm run dev:ws`

### 5. Vercel deployment

1. Import GitHub repo at vercel.com
2. Set all environment variables
3. Deploy

## VPS + Cloudflare Tunnel Deployment

### 1. Provision VPS

Recommended: Hetzner CX42 (8 vCPU, 16GB RAM, ~EUR16/month)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
```

### 2. Clone and configure

```bash
git clone <repo>
cd QuiverDM
cp .env.production.example .env
# Edit .env with production values
```

### 3. Start services

```bash
# Start all services including Cloudflare Tunnel
docker-compose --profile tunnel up -d
```

### 4. Run database migrations

```bash
npm run db:push
```

### 5. Start workers

```bash
npm run worker:pdf &
npm run worker:transcription &
npm run worker:webhooks &
npm run worker:summary &
npm run worker:embeddings &
npm run dev:ws &
```

## Post-Deployment Checklist

```bash
npm run setup:stripe      # Create/find Stripe products
npm run check:launch      # Validate all integrations
npm run generate-beta-invites  # Generate first invite batch
```

## Cloudflare R2 Setup

1. Create R2 bucket in Cloudflare dashboard
2. Create API token with R2 read/write permissions
3. Set R2_* env vars
4. Configure presigned upload URLs (already implemented in the app)
