# QuiverDM — Production Technical Architecture

**Document version:** 2026-02-23
**Status:** Research / Design
**Audience:** Engineering team, infrastructure decisions

---

## Table of Contents

1. [Overview](#1-overview)
2. [Hybrid Deployment Architecture](#2-hybrid-deployment-architecture)
3. [Cloudflare Integration](#3-cloudflare-integration)
4. [Performance Architecture](#4-performance-architecture)
5. [Database Architecture](#5-database-architecture)
6. [File Storage Strategy](#6-file-storage-strategy)
7. [Scalability Path](#7-scalability-path)
8. [Recommended Stack Summary](#8-recommended-stack-summary)
9. [Monthly Cost Estimates](#9-monthly-cost-estimates)

---

## 1. Overview

QuiverDM requires a hybrid deployment model because it combines two distinct workload profiles:

- **Stateless, latency-sensitive request handling** — Next.js SSR, tRPC API endpoints, auth flows. These are CPU-burst workloads that benefit from Vercel's global edge network and serverless auto-scaling.
- **Stateful, long-running background processing** — BullMQ workers (PDF, transcription, summary, embeddings, webhooks, image generation), WebSocket server for live transcription, Postgres with pgvector, Redis, MeiliSearch, Docling, and Ollama. These cannot run serverlessly; they require persistent processes and local network access between services.

The solution: **Vercel for the Next.js frontend + self-hosted VPS (Hetzner) for all stateful services**, bridged by a Cloudflare Tunnel so Vercel can reach the VPS services over HTTPS without opening the VPS firewall.

---

## 2. Hybrid Deployment Architecture

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USERS (browser)                       │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────┐
│              CLOUDFLARE (DNS + WAF + CDN)                │
│   • Proxies quiverdm.com → Vercel                        │
│   • DDoS protection, rate limiting, bot management       │
│   • R2 storage (audio, PDFs, images) — zero egress       │
└───────────────────────┬─────────────────────────────────┘
                        │
          ┌─────────────┴──────────────┐
          │                            │
          ▼                            ▼
┌──────────────────┐        ┌────────────────────────┐
│  VERCEL (Edge)   │        │  Cloudflare Tunnel     │
│                  │        │  (internal services)   │
│ • Next.js 15     │◄──────►│                        │
│   SSR + API      │  HTTPS │  ws.quiverdm.com       │
│   routes         │        │  db-proxy.quiverdm.com │
│ • tRPC handlers  │        │  (no open ports on VPS)│
│ • NextAuth v5    │        └──────────┬─────────────┘
│ • Edge caching   │                   │ encrypted
└──────────────────┘                   │ outbound tunnel
                                       ▼
                        ┌──────────────────────────────┐
                        │   HETZNER VPS (CX42 / CX52)  │
                        │   Ubuntu 24.04 LTS           │
                        │                              │
                        │  ┌─────────────────────────┐ │
                        │  │  Docker Compose stack   │ │
                        │  │                         │ │
                        │  │  postgres (pgvector)    │ │
                        │  │  redis:7-alpine         │ │
                        │  │  meilisearch:v1.5       │ │
                        │  │  docling-serve          │ │
                        │  │  ollama                 │ │
                        │  │  pgbouncer              │ │
                        │  │  cloudflared (tunnel)   │ │
                        │  └─────────────────────────┘ │
                        │                              │
                        │  ┌─────────────────────────┐ │
                        │  │  Node.js processes (pm2)│ │
                        │  │                         │ │
                        │  │  ws-server.ts           │ │
                        │  │  worker:pdf             │ │
                        │  │  worker:transcription   │ │
                        │  │  worker:webhooks        │ │
                        │  │  worker:summary         │ │
                        │  │  worker:embeddings      │ │
                        │  │  worker:image           │ │
                        │  └─────────────────────────┘ │
                        └──────────────────────────────┘
```

### 2.2 What Runs Where

| Service | Platform | Reason |
|---|---|---|
| Next.js app (SSR + API routes + tRPC) | Vercel | Auto-scaling, global CDN, zero-ops |
| BullMQ workers (all 6) | Hetzner VPS | Long-running processes; need Postgres + Redis proximity |
| WebSocket server (live transcription) | Hetzner VPS | Persistent stateful connections |
| PostgreSQL + pgvector | Hetzner VPS | pgvector extension; data sovereignty; cost |
| Redis (BullMQ + cache) | Hetzner VPS | Sub-millisecond latency to workers; co-located |
| MeiliSearch | Hetzner VPS | Low-latency to Postgres; index on same machine |
| Docling (PDF) | Hetzner VPS | CPU-heavy; Docker; not serverless-compatible |
| Ollama | Hetzner VPS | GPU/CPU model weights; persistent process |
| File storage (audio, PDFs, images) | Cloudflare R2 | Zero egress cost; global CDN delivery |

### 2.3 Vercel Configuration

```bash
# vercel.json (production)
{
  "regions": ["syd1"],           # Sydney primary (adjust to user base)
  "functions": {
    "src/app/api/**": {
      "maxDuration": 60          # 60s for tRPC heavy endpoints
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

**Environment variables on Vercel** pointing to Cloudflare Tunnel endpoints:

```env
DATABASE_URL=postgresql://quiverdm:pass@db.quiverdm.com:5432/quiverdm?pgbouncer=true&connection_limit=1
# ^^ connects via Cloudflare Tunnel + PgBouncer
REDIS_URL=redis://redis.quiverdm.com:6379
# ^^ connects via Cloudflare Tunnel
WEBSOCKET_URL=wss://ws.quiverdm.com
MEILI_URL=https://search.quiverdm.com
DOCLING_URL=https://docling.quiverdm.com
OLLAMA_BASE_URL=https://ollama.quiverdm.com
```

---

## 3. Cloudflare Integration

### 3.1 How Cloudflare Tunnel Works

Cloudflare Tunnel (`cloudflared`) creates an **outbound-only encrypted tunnel** from the VPS to Cloudflare's global edge. No inbound firewall ports are required on the VPS. The flow:

```
Browser → cloudflare.com edge → encrypted tunnel → cloudflared daemon → local Docker service
```

Key properties:
- `cloudflared` runs as a Docker container or systemd service on the VPS
- It authenticates to Cloudflare Zero Trust with a tunnel token
- Traffic is end-to-end encrypted (mTLS)
- Supports HTTP, HTTPS, WebSocket, TCP, SSH
- Free for all Cloudflare plans (Zero Trust free tier: up to 50 users for access rules)

### 3.2 Tunnel Setup

**Step 1: Create tunnel in Cloudflare Zero Trust dashboard**

```
Zero Trust → Networks → Tunnels → Create a Tunnel → Cloudflared
Name: quiverdm-vps
Save → copy the tunnel token
```

**Step 2: Add cloudflared to docker-compose.yml (production)**

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  restart: unless-stopped
  command: tunnel --no-autoupdate run
  environment:
    - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
  depends_on:
    - postgres
    - redis
    - meilisearch
```

**Step 3: Configure tunnel routes in Cloudflare dashboard**

Map public subdomains to internal Docker services:

| Public hostname | Internal service | Notes |
|---|---|---|
| `db.quiverdm.com` | `tcp://pgbouncer:5432` | Postgres via PgBouncer |
| `redis.quiverdm.com` | `tcp://redis:6379` | Redis (private, not public-facing) |
| `ws.quiverdm.com` | `http://ws-server:3848` | WebSocket server |
| `search.quiverdm.com` | `http://meilisearch:7700` | MeiliSearch API |
| `docling.quiverdm.com` | `http://docling:5001` | PDF processing |
| `ollama.quiverdm.com` | `http://ollama:11434` | AI inference |

**Step 4: Restrict access to internal endpoints**

For `redis`, `db`, `ollama`, `docling` — these should NOT be publicly accessible. Use Cloudflare Access policies:

```
Zero Trust → Access → Applications → Add application
  Type: Self-hosted
  Domain: db.quiverdm.com
  Policy: "Service Token only" (create a service token for Vercel)
```

Vercel then passes the `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers when connecting. This ensures only your Vercel deployment can reach the internal services.

**Step 5: WebSocket support**

WebSockets work through Cloudflare Tunnel natively. Ensure the tunnel config uses HTTP/2 (default) and that the `ws.quiverdm.com` entry points to the ws-server port. Cloudflare upgrades the connection to WSS automatically.

### 3.3 Cloudflare WAF for Vercel

Using Cloudflare as a reverse proxy in front of Vercel requires care — Vercel's own firewall cannot inspect traffic when Cloudflare proxies it. The recommended approach depends on your priority:

**Option A: Cloudflare as DNS-only (orange cloud off) for Vercel app**
Vercel handles its own TLS and DDoS. Cloudflare manages DNS only. Vercel Firewall works fully. Simpler setup.

**Option B: Cloudflare proxy (orange cloud on) for Vercel app**
You get Cloudflare WAF, bot management, rate limiting, and DDoS. Vercel's firewall is bypassed. To maintain TLS, set SSL/TLS mode to **Full (Strict)** in Cloudflare.
- Add `X-Forwarded-For` trust in Next.js for accurate IP detection
- Use Cloudflare WAF rules to block SQLi, XSS, known bad actors
- Cloudflare DDoS protection is automatic and free on all plans

**Recommendation for QuiverDM:** Use Option B (Cloudflare proxy on) for the main domain. The WAF + DDoS protection is valuable for a SaaS. The trade-off of losing Vercel's firewall visibility is acceptable given Cloudflare's robust protection layer.

### 3.4 Cloudflare R2 for File Storage

R2 is the recommended file storage for QuiverDM over Vercel Blob or S3.

**Pricing comparison:**

| Feature | Cloudflare R2 | Vercel Blob | AWS S3 |
|---|---|---|---|
| Storage | $0.015/GB/month | $0.023/GB/month | $0.023/GB/month |
| Egress | **$0.00** | $0.05/GB | $0.09/GB |
| Class A ops (write) | $4.50/million | $5.00/million | $5.00/million |
| Class B ops (read) | $0.36/million | $0.40/million | $0.40/million |
| CDN delivery | Cloudflare CDN (free) | Vercel CDN | CloudFront ($) |

For a SaaS with significant audio file uploads and PDF storage, R2's zero egress fee is decisive. A deployment serving 1TB/month of audio saves ~$900/month vs S3.

**R2 integration:**

R2 is S3-compatible. Replace any S3/Vercel Blob SDK calls with the AWS SDK pointed at the R2 endpoint:

```typescript
import { S3Client } from '@aws-sdk/client-s3';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
  },
});
```

**R2 bucket structure:**

```
quiverdm-uploads/
  audio/{campaignId}/{sessionId}/{filename}       # session recordings
  pdfs/{campaignId}/{homebrewId}/{filename}       # homebrew source PDFs
  images/{campaignId}/{jobId}/{filename}          # AI-generated images
  transcripts/{sessionId}/export.json            # transcript exports
```

**Serving files to users:**

Use R2 presigned URLs (time-limited, 1 hour) for secure authenticated access. For public-facing assets (e.g. AI images shared publicly), set up a Cloudflare custom domain on the R2 bucket for direct CDN delivery.

---

## 4. Performance Architecture

### 4.1 Database Connection Pooling

**Problem:** Vercel serverless functions can spawn hundreds of concurrent invocations, each opening a Postgres connection. PostgreSQL default max connections is 100. Without pooling, the database will reject connections under load.

**Solution: PgBouncer in Transaction mode on the VPS**

PgBouncer is the right choice for self-hosted Postgres:
- Runs as a Docker container alongside Postgres — zero latency overhead
- Transaction mode: a server connection is held only for the duration of a single transaction
- Supports the connection patterns Prisma requires (with `?pgbouncer=true` on the DATABASE_URL)
- Free; no external dependency

**PgBouncer Docker Compose:**

```yaml
pgbouncer:
  image: edoburu/pgbouncer:latest
  restart: unless-stopped
  environment:
    - DATABASE_URL=postgres://quiverdm:password@postgres:5432/quiverdm
    - POOL_MODE=transaction
    - MAX_CLIENT_CONN=1000
    - DEFAULT_POOL_SIZE=25
    - SERVER_RESET_QUERY=DISCARD ALL
  depends_on:
    - postgres
  ports:
    - "5432:5432"   # expose via Cloudflare Tunnel only
```

**Prisma DATABASE_URL** (must include pgbouncer param + connection_limit):

```env
DATABASE_URL="postgresql://quiverdm:password@db.quiverdm.com:5432/quiverdm?pgbouncer=true&connection_limit=1&pool_timeout=20"
```

The `connection_limit=1` forces Prisma to use only 1 connection per serverless invocation (PgBouncer manages the pool on the server side). `pool_timeout=20` raises an error rather than hanging if no connection is available.

**BullMQ workers on the VPS** do NOT go through PgBouncer — they connect directly to Postgres via Docker internal network with a normal pool of 5-10 connections each (long-lived processes, not serverless).

**Prisma Accelerate** is an alternative managed solution ($0 for 60k queries/month, then usage-based). Useful if you later move to managed Postgres (Railway/Neon). For self-hosted Postgres, PgBouncer is simpler and cheaper.

### 4.2 Key Database Indexes

These indexes cover the most frequent query patterns:

```sql
-- Sessions by campaign (most queried object)
CREATE INDEX CONCURRENTLY idx_sessions_campaign_id
  ON "Session" ("campaignId", "createdAt" DESC);

-- NPCs by campaign (+ soft delete filter)
CREATE INDEX CONCURRENTLY idx_npcs_campaign_active
  ON "Npc" ("campaignId", "deletedAt")
  WHERE "deletedAt" IS NULL;

-- Homebrew by campaign
CREATE INDEX CONCURRENTLY idx_homebrew_campaign_id
  ON "HomebrewContent" ("campaignId", "createdAt" DESC);

-- Characters by campaign
CREATE INDEX CONCURRENTLY idx_characters_campaign_id
  ON "Character" ("campaignId");

-- Transcript segments by session (for live transcription display)
CREATE INDEX CONCURRENTLY idx_transcript_segments_session
  ON "TranscriptSegment" ("sessionId", "startTime");

-- Encounter plans by campaign
CREATE INDEX CONCURRENTLY idx_encounter_plans_campaign
  ON "EncounterPlan" ("campaignId", "createdAt" DESC);

-- Embeddings by campaign (for pgvector search scoping)
CREATE INDEX CONCURRENTLY idx_embeddings_campaign_id
  ON "Embedding" ("campaignId");

-- pgvector HNSW index for semantic search (faster than IVFFlat)
-- Build AFTER loading initial data (HNSW is online — no training step needed)
CREATE INDEX CONCURRENTLY idx_embeddings_vector_hnsw
  ON "Embedding" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Webhook endpoints by user/owner
CREATE INDEX CONCURRENTLY idx_webhook_endpoints_owner
  ON "WebhookEndpoint" ("userId");

-- ImageGenerationJob by campaign + status
CREATE INDEX CONCURRENTLY idx_image_jobs_campaign_status
  ON "ImageGenerationJob" ("campaignId", "status");
```

**pgvector index choice — HNSW over IVFFlat:**

HNSW (Hierarchical Navigable Small World) is the correct choice for production:
- Query latency: ~1.5ms vs IVFFlat's ~2.4ms
- Can be created without data (no training step)
- Supports iterative scans (pgvector 0.8.0+) to prevent over-filtering
- Trade-off: higher memory usage and slower build time — acceptable for QuiverDM's data volumes

### 4.3 Redis Caching Strategy

Redis serves two purposes: BullMQ queue storage and response caching. Use separate logical databases (DB 0 for BullMQ, DB 1 for cache).

**What to cache and TTLs:**

| Cache key pattern | Content | TTL | Invalidation |
|---|---|---|---|
| `campaign:{id}:sessions` | Session list for campaign | 5 min | On session create/update/delete |
| `campaign:{id}:npcs` | NPC list | 10 min | On NPC create/update/delete |
| `campaign:{id}:homebrew` | Homebrew list | 10 min | On homebrew create/update |
| `session:{id}:transcript` | Full transcript | 2 min | On segment update/add |
| `user:{id}:campaigns` | User's campaign list | 5 min | On campaign create/join/leave |
| `usage:{userId}:month` | Usage metrics | 1 min | On new usage event |
| `billing:{userId}:subscription` | Stripe subscription status | 15 min | On webhook from Stripe |
| `rules:indexed` | Rules RAG index status | 1 hour | On re-index |

**Cache implementation pattern:**

```typescript
// src/lib/cache.ts
import { redis } from './redis';

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const data = await fetcher();
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
  return data;
}

export async function invalidate(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}
```

**Cache invalidation wiring** (in service layer, not routers):

```typescript
// After session.service.ts creates a session:
await invalidate(`campaign:${campaignId}:sessions`);

// After npc.service.ts updates an NPC:
await invalidate(`campaign:${campaignId}:npcs`);
```

**BullMQ Redis configuration** (separate from cache):

```env
REDIS_URL=redis://redis.quiverdm.com:6379/0      # BullMQ queues
REDIS_CACHE_URL=redis://redis.quiverdm.com:6379/1  # App cache
```

Set `maxmemory-policy noeviction` for the BullMQ database (DB 0) — never evict queue data. The cache database (DB 1) can use `allkeys-lru`.

### 4.4 tRPC + React Query Optimization

**staleTime recommendations:**

```typescript
// src/lib/trpc.ts — client-side query defaults
export const trpc = createTRPCReact<AppRouter>({
  // ...
});

// In _app.tsx / root provider
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30s — most list queries
      gcTime: 5 * 60_000,     // 5 min — keep in memory
      retry: 1,
      refetchOnWindowFocus: false,  // D&D sessions don't need this
    },
  },
});
```

**Per-query overrides:**

```typescript
// Session list — slightly stale is fine
trpc.sessions.getByCampaign.useQuery(
  { campaignId },
  { staleTime: 60_000 }  // 1 min
);

// Live transcription — always fresh
trpc.transcript.getSegments.useQuery(
  { sessionId },
  { staleTime: 0, refetchInterval: 3000 }
);

// Billing status — long stale OK, cache handles it
trpc.billing.getSubscription.useQuery(
  undefined,
  { staleTime: 5 * 60_000 }
);
```

**Server-side prefetching (RSC + tRPC):**

For campaign dashboard pages, prefetch sessions + NPCs + homebrew counts server-side to eliminate waterfall loading:

```typescript
// src/app/(app)/campaigns/[slug]/page.tsx
import { createServerSideHelpers } from '@trpc/react-query/server';

export default async function CampaignPage({ params }) {
  const helpers = createServerSideHelpers({ router: appRouter, ctx });

  // Parallel prefetch — all 3 run concurrently
  await Promise.all([
    helpers.sessions.getByCampaign.prefetch({ campaignId }),
    helpers.npcs.getByCampaign.prefetch({ campaignId }),
    helpers.homebrew.getByCampaign.prefetch({ campaignId }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(helpers.queryClient)}>
      <CampaignDashboard />
    </HydrationBoundary>
  );
}
```

### 4.5 MeiliSearch Optimization

MeiliSearch is already integrated. Key performance settings for production:

```
# In MeiliSearch environment (docker-compose production)
MEILI_ENV=production
MEILI_MAX_INDEXING_MEMORY=512Mb
MEILI_MAX_INDEXING_THREADS=2

# Searchable attributes (order matters — MeiliSearch ranks by position)
npcs:       ["name", "description", "traits"]
homebrew:   ["title", "content", "tags"]
sessions:   ["title", "description", "aiSummary"]
```

Keep MeiliSearch's index synchronized with Postgres via fire-and-forget calls in service layer (already implemented). Add a periodic re-sync job (daily) as a failsafe to catch any missed updates.

### 4.6 Vercel Edge Caching

Public pages (landing, pricing, shared session pages) benefit from edge caching:

```typescript
// src/app/(marketing)/page.tsx
export const revalidate = 3600; // ISR: revalidate every 1 hour

// src/app/share/session/[token]/page.tsx
export const revalidate = 300; // 5 min — shared sessions update occasionally
```

API routes that return public data:

```typescript
// In route handlers, return Cache-Control headers
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  },
});
```

---

## 5. Database Architecture

### 5.1 Postgres + pgvector on Hetzner

**Docker Compose (production):**

```yaml
postgres:
  image: pgvector/pgvector:pg15
  restart: always
  shm_size: 256mb       # Important for pgvector index building
  environment:
    POSTGRES_USER: quiverdm
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_DB: quiverdm
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf
  command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

**postgresql.conf tuning** for a CX42 (8 vCPU, 16GB RAM) with pgvector:

```ini
# Memory
shared_buffers = 4GB              # 25% of RAM
effective_cache_size = 12GB       # 75% of RAM
work_mem = 64MB                   # per query sort/hash
maintenance_work_mem = 1GB        # for VACUUM, index builds

# pgvector HNSW
max_parallel_workers_per_gather = 4

# WAL / Durability
wal_level = replica               # needed for logical replication backup
checkpoint_completion_target = 0.9
wal_buffers = 64MB

# Connections (PgBouncer handles client connections)
max_connections = 100             # PgBouncer → Postgres server connections

# Logging
log_slow_queries = 1000ms         # log queries over 1s
```

### 5.2 Backup Strategy

**Primary: pg_dump to Cloudflare R2 (daily)**

```bash
#!/bin/bash
# /opt/quiverdm/scripts/backup.sh — run via cron daily at 02:00 UTC
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="quiverdm_${TIMESTAMP}.dump"

pg_dump \
  -U quiverdm \
  -h localhost \
  -Fc \                          # custom format (compressed)
  quiverdm > /tmp/${BACKUP_FILE}

# Upload to R2 (using rclone configured with R2 credentials)
rclone copy /tmp/${BACKUP_FILE} r2:quiverdm-backups/postgres/

# Keep only last 30 days locally
find /tmp -name "quiverdm_*.dump" -mtime +1 -delete

# Keep only last 90 days in R2
# (set R2 lifecycle rule: delete after 90 days)
```

**Secondary: WAL-based continuous archiving (optional at scale)**

Use `wal-g` or `pgBackRest` for point-in-time recovery when the database exceeds 10GB. Initially, daily pg_dump to R2 is sufficient.

**Retention policy:**
- Daily backups: 30 days
- Weekly backups: 3 months
- Monthly backups: 1 year

### 5.3 pgvector Index Maintenance

HNSW indexes require no explicit maintenance (unlike IVFFlat which needs rebuilding as data grows). However, run `VACUUM ANALYZE` on the embeddings table weekly to keep statistics current:

```sql
-- Add to maintenance cron (weekly)
VACUUM ANALYZE "Embedding";
```

---

## 6. File Storage Strategy

**Recommendation: Cloudflare R2 for all user-generated files.**

| File type | Bucket | Access | Notes |
|---|---|---|---|
| Session audio recordings | `quiverdm-uploads` | Presigned URL (1hr) | Uploaded from browser via presigned POST |
| Homebrew PDFs | `quiverdm-uploads` | Presigned URL (1hr) | DM + campaign members only |
| AI-generated images | `quiverdm-uploads` | Presigned URL / public | Public if shared |
| Transcript exports | `quiverdm-uploads` | Presigned URL (24hr) | PDF/JSON export downloads |
| DB backups | `quiverdm-backups` | Private (R2 only) | Never served to users |

**Upload flow (avoid Vercel function size limits):**

```
1. Client requests presigned upload URL (POST /api/uploads/presign)
2. Vercel function calls R2 SDK → returns presigned URL
3. Client uploads directly to R2 (bypasses Vercel — no bandwidth cost)
4. Client confirms upload to Vercel (POST /api/uploads/confirm)
5. Vercel records file metadata in Postgres
```

This avoids Vercel's 4.5MB request body limit and their $0.05/GB bandwidth cost on uploads.

---

## 7. Scalability Path

### 7.1 Beta Launch (0–500 users): Self-Hosted All Services

**VPS: Hetzner CX42** (8 vCPU, 16GB RAM, 160GB SSD, 20TB bandwidth) — ~€16.40/month

All services on one VPS is fine for beta. At 500 users, the bottleneck will likely be Ollama (AI inference) before Postgres or Redis.

Action if Ollama is the bottleneck:
- Move to a GPU-equipped server (Hetzner AX-series bare metal with dedicated GPU, or a separate CX52 for Ollama only)
- Or swap Ollama for Gemini/OpenAI API (already supported via multi-provider AI layer)

### 7.2 Growth Phase (500–2,000 users): Vertical Scale

**VPS: Hetzner CX52** (16 vCPU, 32GB RAM, 320GB SSD) — ~€32.40/month

At this tier:
- Consider separating Postgres to its own VPS for isolation (`CCX13` or `CCX23` compute-optimized)
- Add a Hetzner Volume (separate NVMe disk) for Postgres data so the OS and DB don't share I/O
- Redis remains co-located with workers

**Traffic thresholds triggering infrastructure split:**

| Metric | Threshold | Action |
|---|---|---|
| Postgres connections | >80% of max_connections | Scale PgBouncer pool size or add read replica |
| Redis memory | >70% of available RAM | Increase server RAM or separate Redis instance |
| CPU consistently >70% | For >1hr | Vertical scale or separate Ollama |
| Worker queue backlog | >1000 jobs for >30min | Add second worker server |

### 7.3 Scale Phase (2,000–10,000 users): Move to Managed Services

At significant scale, operational burden of self-hosted services becomes expensive in engineering time. Migration path:

| Service | Self-hosted → Managed | Provider options |
|---|---|---|
| PostgreSQL | Hetzner VPS → Managed | Railway Postgres (pgvector support confirmed), Neon, Supabase |
| Redis | Self-hosted → Managed | Railway Redis, Upstash (serverless Redis) |
| MeiliSearch | Self-hosted → Managed | Meilisearch Cloud |
| BullMQ workers | VPS pm2 → Container platform | Railway workers, Fly.io, Render |

**Migration without downtime:**

1. **Database (Postgres):** Set up managed instance → use `pg_dump / pg_restore` → point DATABASE_URL to new instance → run Prisma migrations → decommission old instance. Use Railway's Postgres Migrator tool for parallel restore.

2. **Redis:** Use Redis SLAVEOF to replicate from self-hosted to managed instance in real-time → cut over BullMQ REDIS_URL → remove replica relationship.

3. **Workers:** Deploy workers to Railway/Fly alongside existing VPS workers → drain old queues → update REDIS_URL in new workers → decommission VPS workers.

**Railway pricing context (2026):** Pro plan $20/month base + usage. Postgres and Redis are included resources billed at actual CPU/RAM consumption. For a typical QuiverDM workload (Postgres idle 80% of the time), estimated $30–60/month for both Postgres + Redis on Railway.

---

## 8. Recommended Stack Summary

### Production Stack

| Component | Technology | Hosting | Version |
|---|---|---|---|
| Frontend + API | Next.js 15 (App Router) | Vercel Pro | 15.x |
| API layer | tRPC v11 | Vercel (via Next.js) | 11.x |
| Auth | NextAuth v5 beta | Vercel | 5.x |
| ORM | Prisma | Vercel + VPS workers | 5.x |
| Database | PostgreSQL + pgvector | Hetzner VPS | 15 + 0.8.x |
| Connection pool | PgBouncer | Hetzner VPS (Docker) | latest |
| Queue | BullMQ | Hetzner VPS (pm2) | 5.x |
| Cache / Queue broker | Redis 7 | Hetzner VPS (Docker) | 7-alpine |
| Search | MeiliSearch | Hetzner VPS (Docker) | 1.5 |
| PDF processing | Docling | Hetzner VPS (Docker) | latest |
| AI inference (local) | Ollama | Hetzner VPS (Docker) | latest |
| File storage | Cloudflare R2 | Cloudflare | — |
| Tunnel | cloudflared | Hetzner VPS (Docker) | latest |
| DNS + WAF + DDoS | Cloudflare | Cloudflare (Free/Pro) | — |
| Email | Resend | Managed SaaS | — |
| Payments | Stripe | Managed SaaS | — |
| Process manager | pm2 | Hetzner VPS | latest |

### Environment Variables Added for Production

```env
# Cloudflare
CF_ACCOUNT_ID=
CF_R2_ACCESS_KEY_ID=
CF_R2_SECRET_ACCESS_KEY=
CF_R2_BUCKET=quiverdm-uploads
CLOUDFLARE_TUNNEL_TOKEN=

# Updated to Cloudflare Tunnel endpoints
DATABASE_URL=postgresql://quiverdm:pass@db.quiverdm.com:5432/quiverdm?pgbouncer=true&connection_limit=1
REDIS_URL=redis://redis.quiverdm.com:6379/0
REDIS_CACHE_URL=redis://redis.quiverdm.com:6379/1
MEILI_URL=https://search.quiverdm.com
DOCLING_URL=https://docling.quiverdm.com
OLLAMA_BASE_URL=https://ollama.quiverdm.com
WEBSOCKET_URL=wss://ws.quiverdm.com

# Cloudflare Access (service token for VPS endpoint protection)
CF_ACCESS_CLIENT_ID=
CF_ACCESS_CLIENT_SECRET=
```

---

## 9. Monthly Cost Estimates

### Beta Launch: ~1,000 Active Users

| Service | Cost/month | Notes |
|---|---|---|
| Vercel Pro | $20 | 1 seat; includes 1TB bandwidth, 40hr CPU |
| Hetzner CX42 | €16.40 (~$17) | 8 vCPU, 16GB, all services |
| Cloudflare | $0 | Free plan (WAF, tunnel, DDoS, CDN) |
| Cloudflare R2 | ~$5–15 | 100–500GB storage + ops |
| Resend | $20 | Pro plan (50k emails/month) |
| Stripe | 2.9% + $0.30 | Per transaction |
| AssemblyAI | ~$50–100 | Usage-based (transcription) |
| Domain + DNS | ~$15/yr | $1.25/month |
| **Total (excl. Stripe txn fees)** | **~$115–175/month** | |

### Growth Phase: ~10,000 Active Users

| Service | Cost/month | Notes |
|---|---|---|
| Vercel Pro | $20–40 | Pro + overage (more bandwidth/CPU) |
| Hetzner CX52 (x2) | €65 (~$70) | One for Postgres/Redis, one for workers/Ollama |
| Hetzner Volume (200GB) | €10 (~$11) | Dedicated NVMe for Postgres |
| Cloudflare Pro | $25 | WAF rules, analytics |
| Cloudflare R2 | ~$50–100 | 1–3TB storage |
| Resend | $90 | Business plan (100k emails) |
| AssemblyAI | ~$300–500 | Higher transcription volume |
| Stripe | 2.9% + $0.30 | Per transaction |
| **Total (excl. Stripe txn fees)** | **~$550–745/month** | |

At 10,000 users with $20/month ARPU, monthly revenue is ~$200k. Infrastructure at $750/month is 0.375% of revenue — well within healthy SaaS margins.

### When to Move to Managed Services

Move to Railway/managed when:
- Engineering time spent on Postgres/Redis ops exceeds 4 hours/month
- You need Postgres read replicas for reporting
- A single Hetzner VPS outage becomes business-critical (managed services have SLAs)

At ~$200–400/month for managed Postgres + Redis + workers on Railway, the operational simplicity often justifies the 3–5x cost premium over self-hosted.

---

## References

- [Cloudflare Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Cloudflare Tunnel setup guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare WebSockets](https://developers.cloudflare.com/network/websockets/)
- [Vercel + Cloudflare guidance](https://vercel.com/kb/guide/cloudflare-with-vercel)
- [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan)
- [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- [Prisma Accelerate vs PgBouncer comparison](https://www.prisma.io/docs/accelerate/compare)
- [PgBouncer with Prisma](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [pgvector HNSW vs IVFFlat](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931)
- [pgvector 0.8.0 release notes](https://www.postgresql.org/about/news/pgvector-080-released-2952/)
- [Hetzner Cloud server comparison](https://www.achromatic.dev/blog/hetzner-server-comparison)
- [BullMQ production guide](https://docs.bullmq.io/guide/going-to-production)
- [Railway Postgres with pgvector](https://blog.railway.com/p/hosting-postgres-with-pgvector)
- [Railway migration from self-hosted](https://railway.com/deploy/postgres-migrator)
- [Redis caching with Next.js](https://www.digitalapplied.com/blog/redis-caching-strategies-nextjs-production)
- [tRPC server-side helpers](https://trpc.io/docs/client/nextjs/server-side-helpers)
