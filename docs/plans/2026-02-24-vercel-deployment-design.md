# QuiverDM — Vercel Frontend + Homelab Backend Deployment Design

**Date:** 2026-02-24
**Status:** Approved
**Domain:** quiverdm.com (being registered)

---

## Goal

Deploy the QuiverDM beta with:
- **Vercel** hosting the full Next.js app (pages + tRPC API + auth + webhooks)
- **Homelab (192.168.1.220)** hosting all stateful services (Postgres, Redis, MeiliSearch, Docling, Ollama) and long-running workers
- **Cloudflare Tunnels** exposing homelab services to Vercel's serverless functions securely
- **Cloudflare R2** for file storage (PDFs, images, audio/video recordings)

---

## Architecture

```
Internet
   │
   ├── app.quiverdm.com ──────── Vercel (Next.js 15)
   │     ├── /                  Pages (SSR + RSC)
   │     ├── /api/trpc/*        tRPC (serverless functions)
   │     ├── /api/auth/*        NextAuth
   │     ├── /api/webhooks/*    Stripe webhooks
   │     └── /api/recordings/*  → R2 presigned URL (browser uploads direct)
   │
   └── Cloudflare Tunnel ─────── Homelab 192.168.1.220
         ├── db.quiverdm.com     → PostgreSQL :5433
         ├── redis.quiverdm.com  → Redis :6380
         ├── meili.quiverdm.com  → MeiliSearch :7701
         └── ws.quiverdm.com     → WebSocket server :3004

Cloudflare R2 ─────────────────── File storage
  quiverdm bucket: PDFs, images, recordings, homebrew assets
```

---

## Codebase Changes Required

### 1. Remove `output: 'standalone'` from `next.config.js`

The `standalone` output mode is for self-hosted Node.js deployments. Vercel uses its own build pipeline and this setting causes build failures.

**File:** `next.config.js`
**Change:** Remove `output: 'standalone'` line.

### 2. Rewrite recordings upload to use R2 presigned URLs

**Problem:** The current `/api/recordings/upload` route accepts the file body directly through Vercel serverless functions. Vercel's function payload limit is ~4.5MB but recordings are up to 1GB.

**Solution:** Change the route to return a presigned R2 upload URL. The browser uploads the file directly to R2, bypassing Vercel entirely.

**File:** `src/app/api/recordings/upload/route.ts`
**Change:** Return `{ uploadUrl: string, key: string }` from a presigned PUT URL. After upload completes, client calls a separate endpoint to register the recording in the DB.

### 3. Update `/api/storage/[...path]` for production

**Problem:** This route reads files from local disk (`uploads/` directory). Vercel has no persistent disk.

**Solution:** In production (`STORAGE_MODE=r2`), redirect or proxy from R2 URLs instead of local disk. Simplest: the route returns a 302 redirect to the R2 public URL.

**File:** `src/app/api/storage/[...path]/route.ts`
**Change:** When `STORAGE_MODE=r2`, redirect to `storage.getUrl(filePath)` instead of reading from disk.

### 4. No changes needed to tRPC routers or services

The routers already use the `storage` abstraction via `STORAGE_MODE`. Switching to R2 requires only env var changes.

---

## Environment Variables (Production / Vercel)

```env
# App
NEXTAUTH_URL=https://app.quiverdm.com
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NODE_ENV=production

# Database (via Cloudflare Tunnel)
DATABASE_URL=postgresql://user:pass@db.quiverdm.com:5432/quiverdm

# Redis (via Cloudflare Tunnel)
REDIS_URL=redis://redis.quiverdm.com:6380

# MeiliSearch (via Cloudflare Tunnel)
MEILI_URL=https://meili.quiverdm.com
MEILI_MASTER_KEY=<key>

# Storage (Cloudflare R2)
STORAGE_MODE=r2
R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 api token key>
R2_SECRET_ACCESS_KEY=<r2 api token secret>
R2_BUCKET_NAME=quiverdm
R2_PUBLIC_URL=https://files.quiverdm.com

# WebSocket (homelab, via Cloudflare Tunnel)
NEXT_PUBLIC_WS_URL=wss://ws.quiverdm.com

# Stripe
STRIPE_SECRET_KEY=<live key>
STRIPE_WEBHOOK_SECRET=<live webhook secret>
STRIPE_PRO_PRICE_ID=<live price id>
STRIPE_TEAM_PRICE_ID=<live price id>

# Email
RESEND_API_KEY=<key>
EMAIL_FROM=noreply@quiverdm.com

# AI
ASSEMBLYAI_API_KEY=<key>
OLLAMA_BASE_URL=http://ollama.quiverdm.com  # or via tunnel

# Admin
ADMIN_EMAILS=your@email.com
```

---

## Homelab Setup (192.168.1.220)

### Services (existing docker-compose.yml)
- PostgreSQL (pgvector/pgvector:pg15) on :5433
- Redis on :6380
- MeiliSearch on :7701
- Docling on :5001
- Ollama on :11434

### Workers (PM2 or Docker)

Run all 6 BullMQ workers + WebSocket server. They connect to local services (no tunnel overhead):

```bash
# PM2 ecosystem.config.js (to create)
pm2 start npm --name "worker:pdf"           -- run worker:pdf
pm2 start npm --name "worker:transcription" -- run worker:transcription
pm2 start npm --name "worker:image"         -- run worker:image
pm2 start npm --name "worker:webhooks"      -- run worker:webhooks
pm2 start npm --name "worker:summary"       -- run worker:summary
pm2 start npm --name "worker:embeddings"    -- run worker:embeddings
pm2 start npm --name "ws-server"            -- run dev:ws
pm2 save
pm2 startup
```

### Cloudflare Tunnels

Install `cloudflared` on homelab and create named tunnels for each service:

| Tunnel hostname | Homelab target | Protocol |
|---|---|---|
| db.quiverdm.com | localhost:5433 | TCP |
| redis.quiverdm.com | localhost:6380 | TCP |
| meili.quiverdm.com | localhost:7701 | HTTPS |
| ws.quiverdm.com | localhost:3004 | WebSocket |

**Note:** TCP tunnels for Postgres and Redis require `cloudflared access tcp` on Vercel's side — this means the `DATABASE_URL` and `REDIS_URL` still point to tunneled hostnames that cloudflared handles transparently.

**Simpler alternative for DB/Redis:** Use `cloudflared` in `--local-port` mode with an SSH tunnel or Cloudflare Access with service tokens for TCP tunneling.

---

## Deployment Steps (High Level)

1. Set up Cloudflare R2 bucket + API credentials
2. Set up Cloudflare Tunnels (cloudflared on homelab)
3. Make codebase changes (3 files)
4. Configure Vercel project (import repo, set env vars)
5. Deploy to Vercel
6. Configure DNS: `app.quiverdm.com` → Vercel, `*.quiverdm.com` via Cloudflare
7. Run workers on homelab via PM2
8. Test end-to-end (auth, DB, file upload, WebSocket)

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Cloudflare TCP tunnels for Postgres/Redis may require Cloudflare Teams (paid) | Use SSH port forwarding or upgrade to Cloudflare Zero Trust free tier |
| WebSocket `wss://` requires TLS — cloudflared handles this | Verify WSS handshake works through tunnel |
| Vercel cold starts add latency to tRPC calls on free tier | Acceptable for beta; upgrade to Pro for consistent response times |
| R2 public URL not set up before deploy | Use R2 bucket with public access or a custom domain |
