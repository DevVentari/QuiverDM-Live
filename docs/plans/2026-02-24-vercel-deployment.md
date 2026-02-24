# Vercel Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy QuiverDM beta with Vercel hosting the Next.js app and homelab (192.168.1.220) hosting all stateful services and workers.

**Architecture:** Vercel runs the Next.js app (pages + tRPC API + auth + webhooks) connecting to homelab services via Cloudflare Tunnels. Files (PDFs, images, recordings) are stored in Cloudflare R2. BullMQ workers and the WebSocket server run on homelab under PM2.

**Tech Stack:** Next.js 15, Vercel, Cloudflare R2 (AWS S3-compatible), Cloudflare Tunnel (`cloudflared`), PM2, PostgreSQL via Cloudflare TCP tunnel, Redis via Cloudflare TCP tunnel.

---

## Pre-Flight: What you need before starting

- [ ] Cloudflare account (free tier is fine)
- [ ] Cloudflare R2 enabled on the account
- [ ] Domain registered and DNS managed by Cloudflare (e.g., quiverdm.com)
- [ ] `cloudflared` installed on homelab: `curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo gpg --dearmor > /usr/share/keyrings/cloudflare-main.gpg && apt install cloudflared`
- [ ] PM2 installed on homelab: `npm install -g pm2`
- [ ] Vercel account + Vercel CLI: `npm i -g vercel`

---

## Task 1: Remove `output: 'standalone'` from `next.config.js`

Vercel has its own build system. The `standalone` output mode generates a self-contained Node.js server — Vercel doesn't need or want this and the setting causes build failures.

**Files:**
- Modify: `next.config.js`

**Step 1: Remove the standalone line**

Open `next.config.js`. Find and remove this line:
```js
output: 'standalone',
```

**Step 2: Verify the file looks correct after removal**

`next.config.js` should start with:
```js
/** @type {import('next').NextConfig} */
const securityHeaders = [ ... ];

const nextConfig = {
  async headers() { ... },
  transpilePackages: ['next-themes'],
  ...
};
```

**Step 3: Verify build still works locally (optional but recommended)**
```bash
npx tsc --noEmit
```
Expected: 0 errors

**Step 4: Commit**
```bash
git add next.config.js
git commit -m "fix: remove standalone output mode for Vercel compatibility"
```

---

## Task 2: Fix `/api/storage/[...path]` to work with R2

**Context:** This route currently reads files from local disk and serves them. On Vercel, there is no persistent disk. In production (`STORAGE_MODE=r2`), it should generate a presigned R2 download URL and redirect the browser there.

**Files:**
- Modify: `src/app/api/storage/[...path]/route.ts`

**Step 1: Read the current file** (line 1-111 of the existing file)

The current GET handler calls `getFromLocal(filePath)` which reads from disk.

**Step 2: Replace the entire file contents**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getFromLocal, existsInLocal } from '@/lib/storage/local-storage';
import { getPresignedDownloadUrl } from '@/lib/storage/r2';
import { getStorageMode } from '@/lib/storage';
import path from 'path';

export const runtime = 'nodejs';

const CONTENT_TYPE_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wma': 'audio/x-ms-wma',
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = pathSegments.join('/');

    if (filePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // In R2 mode: redirect to a presigned download URL
    if (getStorageMode() === 'r2') {
      const presignedUrl = await getPresignedDownloadUrl(filePath, 3600);
      return NextResponse.redirect(presignedUrl, { status: 302 });
    }

    // Local mode: serve from disk (development only)
    const exists = await existsInLocal(filePath);
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = await getFromLocal(filePath);
    const totalSize = fileBuffer.length;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
    const isMedia = contentType.startsWith('audio/') || contentType.startsWith('video/');

    const rangeHeader = request.headers.get('range');
    if (isMedia && rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
        const chunkSize = end - start + 1;
        return new NextResponse(new Uint8Array(fileBuffer.subarray(start, end + 1)), {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Content-Length': String(chunkSize),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000',
          },
        });
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': String(totalSize),
      'Cache-Control': 'public, max-age=31536000',
    };
    if (isMedia) headers['Accept-Ranges'] = 'bytes';

    return new NextResponse(new Uint8Array(fileBuffer), { headers });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
```

**Step 3: Type-check**
```bash
npx tsc --noEmit
```
Expected: 0 errors

**Step 4: Commit**
```bash
git add src/app/api/storage/
git commit -m "feat: redirect storage route to R2 presigned URL in production"
```

---

## Task 3: Rewrite recordings upload to use R2 presigned URLs

**Context:** The current `/api/recordings/upload` route accepts the entire file in the request body and uploads it. Vercel serverless functions have a ~4.5MB request body limit — recordings can be up to 1GB. The fix: the API returns a presigned R2 upload URL, and the browser uploads directly to R2 (bypassing Vercel completely).

**New flow:**
1. Client POSTs `{ sessionId, filename, contentType }` to `/api/recordings/upload`
2. API returns `{ uploadUrl, key }` (a presigned R2 PUT URL, valid 60 minutes)
3. Client PUTs the file directly to R2 using `uploadUrl`
4. Client calls `trpc.sessionRecordings.create` with `{ sessionId, key, filename, fileSize, contentType }` to register it

**Files:**
- Modify: `src/app/api/recordings/upload/route.ts`

**Step 1: Replace the entire file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPresignedUploadUrl, generateFileKey } from '@/lib/storage/r2';
import { getStorageMode } from '@/lib/storage';
import { uploadToLocal, generateLocalFileKey } from '@/lib/storage/local-storage';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm',
  'audio/flac', 'audio/x-m4a', 'audio/aac',
];

/**
 * POST /api/recordings/upload
 *
 * In R2 mode (production): Returns a presigned upload URL.
 *   Body: { sessionId: string, filename: string, contentType: string, fileSize: number }
 *   Response: { uploadUrl: string, key: string }
 *   After upload: call trpc.sessionRecordings.create to register in DB.
 *
 * In local mode (development): Accepts file body and stores locally.
 *   Body: FormData { file, sessionId }
 *   Response: { url: string, key: string, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    if (getStorageMode() === 'r2') {
      // Presigned URL flow for production
      const body = await request.json() as {
        sessionId: string;
        filename: string;
        contentType: string;
        fileSize: number;
      };

      const { sessionId, filename, contentType, fileSize } = body;

      if (!sessionId || !filename || !contentType) {
        return NextResponse.json({ error: 'sessionId, filename, and contentType are required' }, { status: 400 });
      }

      const isVideo = contentType.startsWith('video/');
      const isAudio = contentType.startsWith('audio/');
      if (!isVideo && !isAudio) {
        return NextResponse.json({ error: 'Only video and audio files are allowed' }, { status: 400 });
      }

      if (!ALLOWED_TYPES.includes(contentType)) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
      }

      const maxSize = 1024 * 1024 * 1024; // 1GB
      if (fileSize > maxSize) {
        return NextResponse.json({ error: 'File size must be less than 1GB' }, { status: 400 });
      }

      const key = generateFileKey(userId, sessionId, filename, 'session-recordings');
      // Presigned URL valid for 60 minutes (large files may take time to upload)
      const uploadUrl = await getPresignedUploadUrl(key, contentType, 3600);

      return NextResponse.json({ uploadUrl, key });
    } else {
      // Local development: accept file body
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const sessionId = formData.get('sessionId') as string | null;

      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      if (!isVideo && !isAudio) {
        return NextResponse.json({ error: 'Only video and audio files are allowed' }, { status: 400 });
      }

      const maxSize = 1024 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json({ error: 'File size must be less than 1GB' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const key = generateLocalFileKey(userId, sessionId, file.name, 'session-recordings');
      const url = await uploadToLocal({ key, body: buffer, contentType: file.type });

      return NextResponse.json({
        success: true,
        url,
        key,
        filename: file.name,
        fileSize: file.size,
        type: isVideo ? 'video' : 'audio',
        contentType: file.type,
      });
    }
  } catch (error) {
    console.error('Error in recordings upload:', error);
    return NextResponse.json({ error: 'Failed to process upload request' }, { status: 500 });
  }
}
```

**Step 2: Type-check**
```bash
npx tsc --noEmit
```
Expected: 0 errors

**Step 3: Commit**
```bash
git add src/app/api/recordings/upload/route.ts
git commit -m "feat: rewrite recordings upload to use R2 presigned URLs in production"
```

**Step 4: Note for future work**

The client-side upload component (wherever it calls `/api/recordings/upload`) needs to be updated to handle the two flows. Search for `fetch('/api/recordings/upload'` or `FormData` usage near recording upload logic and update it:

- In production: POST JSON `{ sessionId, filename, contentType, fileSize }`, receive `{ uploadUrl, key }`, PUT file to `uploadUrl`, then call `trpc.sessionRecordings.create` with the key.
- In local: POST FormData as before.

Search for the component:
```bash
grep -r "recordings/upload" src/
```

---

## Task 4: Set up Cloudflare R2 bucket

Do this in the Cloudflare dashboard before deploying.

**Step 1: Create an R2 bucket**

1. Go to Cloudflare Dashboard → R2 → Create bucket
2. Name: `quiverdm` (or `quiverdm-prod`)
3. Region: Automatic

**Step 2: Create R2 API token**

1. R2 → Manage R2 API Tokens → Create API Token
2. Permissions: Object Read & Write
3. Specify bucket: `quiverdm`
4. Copy: Account ID, Access Key ID, Secret Access Key

**Step 3: (Optional) Enable public access for images**

For images you want publicly accessible without signed URLs (homebrew images, NPC portraits):
1. R2 bucket → Settings → Public Access → Enable
2. Add custom domain: `files.quiverdm.com` → add a CNAME in Cloudflare DNS

If you do this, update `R2StorageProvider.getUrl` in `src/lib/storage/index.ts` to return `https://files.quiverdm.com/${key}` when `R2_PUBLIC_URL` is set:

```typescript
getUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) return `${publicUrl}/${key}`;
  return `/api/storage/${key}`;
}
```

---

## Task 5: Set up Cloudflare Tunnels on homelab

Run these commands on homelab (192.168.1.220).

**Step 1: Authenticate cloudflared**
```bash
cloudflared tunnel login
# Opens browser — log into your Cloudflare account and select your zone
```

**Step 2: Create the tunnel**
```bash
cloudflared tunnel create quiverdm-homelab
# Note the tunnel UUID in the output
```

**Step 3: Create tunnel config file**

Create `/etc/cloudflared/config.yml` on homelab:

```yaml
tunnel: <TUNNEL_UUID_FROM_STEP_2>
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json

ingress:
  # WebSocket server (wss://ws.quiverdm.com → localhost:3004)
  - hostname: ws.quiverdm.com
    service: http://localhost:3004

  # MeiliSearch (https://meili.quiverdm.com → localhost:7701)
  - hostname: meili.quiverdm.com
    service: http://localhost:7701

  # Catch-all (required by cloudflared)
  - service: http_status:404
```

**Note on Postgres + Redis:** TCP tunnels (for Postgres and Redis) require Cloudflare Zero Trust (free tier). The alternative — simpler for a beta — is to use a connection pooler or managed service. For beta scale, a practical approach is:

**Option A (Recommended for beta):** Use [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com) for Postgres (free tier, publicly accessible, SSL). This avoids the TCP tunnel complexity entirely. Your Redis can use [Upstash](https://upstash.com) (free tier, HTTP-based, no TCP tunnel needed).

**Option B:** If you want to keep homelab Postgres, set up Cloudflare Access TCP:
```bash
# On each Vercel function call, you'd need cloudflared access tcp
# This doesn't work well with Vercel serverless — use Option A instead
```

**Option C (Quick and dirty for beta testing only):** Port-forward 5433 and 6380 on your router with IP allowlisting to Vercel's IP ranges. Not recommended for production.

**Step 4: Add DNS records for tunnel**
```bash
cloudflared tunnel route dns quiverdm-homelab ws.quiverdm.com
cloudflared tunnel route dns quiverdm-homelab meili.quiverdm.com
```

**Step 5: Start tunnel as a service**
```bash
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

**Step 6: Verify tunnel is running**
```bash
curl https://meili.quiverdm.com/health
# Expected: {"status":"available"}
```

---

## Task 6: Set up homelab workers with PM2

Run on homelab. First, make sure the Next.js app repo is cloned on homelab with `npm install` and `.env.production` configured.

**Step 1: Create PM2 ecosystem config**

Create `ecosystem.config.js` in the project root on homelab:

```javascript
module.exports = {
  apps: [
    {
      name: 'worker:pdf',
      script: 'npm',
      args: 'run worker:pdf',
      cwd: '/path/to/quiverdm',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: 'worker:transcription',
      script: 'npm',
      args: 'run worker:transcription',
      cwd: '/path/to/quiverdm',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: 'worker:image',
      script: 'npm',
      args: 'run worker:image',
      cwd: '/path/to/quiverdm',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: 'worker:webhooks',
      script: 'npm',
      args: 'run worker:webhooks',
      cwd: '/path/to/quiverdm',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: 'worker:summary',
      script: 'npm',
      args: 'run worker:summary',
      cwd: '/path/to/quiverdm',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: 'worker:embeddings',
      script: 'npm',
      args: 'run worker:embeddings',
      cwd: '/path/to/quiverdm',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: 'ws-server',
      script: 'npm',
      args: 'run dev:ws',
      cwd: '/path/to/quiverdm',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
```

**Step 2: Start all workers**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Run the generated systemctl command to enable on boot
```

**Step 3: Verify workers are running**
```bash
pm2 status
# All 7 processes should show "online"
```

---

## Task 7: Configure Vercel environment variables

**Step 1: Create `.env.production.example`** in the repo root (commit this — it's documentation, not secrets):

```env
# ===== VERCEL PRODUCTION ENV VARS =====
# Copy these into the Vercel dashboard under Settings > Environment Variables

NODE_ENV=production

# Auth
NEXTAUTH_URL=https://app.quiverdm.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Database — use Neon.tech or Supabase free tier for beta
DATABASE_URL=postgresql://user:pass@host.neon.tech/quiverdm?sslmode=require

# Redis — use Upstash for beta (free tier, REST-compatible with ioredis via TLS URL)
REDIS_URL=rediss://default:password@global.upstash.io:6379

# MeiliSearch (via Cloudflare Tunnel)
MEILI_URL=https://meili.quiverdm.com
MEILI_MASTER_KEY=<key>

# Storage (Cloudflare R2)
STORAGE_MODE=r2
R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 api key>
R2_SECRET_ACCESS_KEY=<r2 secret>
R2_BUCKET_NAME=quiverdm
R2_PUBLIC_URL=https://files.quiverdm.com

# WebSocket (homelab via Cloudflare Tunnel)
NEXT_PUBLIC_WS_URL=wss://ws.quiverdm.com

# Stripe (use live keys for prod)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@quiverdm.com

# AI
ASSEMBLYAI_API_KEY=...
OLLAMA_BASE_URL=http://ollama.quiverdm.com

# Docling (homelab via Cloudflare Tunnel if needed)
DOCLING_URL=https://docling.quiverdm.com

# Admin
ADMIN_EMAILS=your@email.com

# Image generation (optional)
REPLICATE_API_KEY=...
IMAGE_GENERATION_DEFAULT_PROVIDER=replicate
```

**Step 2: Commit the example file**
```bash
git add .env.production.example
git commit -m "docs: add production environment variable template"
```

**Step 3: Add all env vars to Vercel**

1. Go to Vercel Dashboard → your project → Settings → Environment Variables
2. Add each variable from `.env.production.example` with real values
3. Set scope: Production (and Preview if you want staging)

---

## Task 8: Deploy to Vercel

**Step 1: Install Vercel CLI and link project**
```bash
npm i -g vercel
vercel login
vercel link
# Choose: link to existing project or create new
# Project name: quiverdm
```

**Step 2: Test build locally with Vercel**
```bash
vercel build
# Expected: Build output in .vercel/output/
# Watch for any build errors
```

Common build failures and fixes:
- `STRIPE_SECRET_KEY missing` → Add to Vercel env vars
- `Cannot find module '@prisma/client'` → `prisma generate` runs in `build` script, should be fine
- `output: 'standalone'` → Already removed in Task 1

**Step 3: Deploy to production**
```bash
vercel --prod
```

Expected output:
```
✓ Deployed to https://app.quiverdm.com
```

**Step 4: Configure custom domain in Vercel**

1. Vercel Dashboard → your project → Settings → Domains
2. Add: `app.quiverdm.com`
3. Vercel will show a CNAME or A record to add in Cloudflare DNS
4. Add it in Cloudflare DNS (Proxy status: DNS only for Vercel, or Proxied if you want Cloudflare in front)

---

## Task 9: End-to-end verification

Run through this checklist after deployment:

**Step 1: Auth flow**
- [ ] Visit `https://app.quiverdm.com` → redirects to sign in
- [ ] Sign up with email → receive welcome email (Resend)
- [ ] Sign in → lands on dashboard

**Step 2: Database (Postgres)**
- [ ] Create a campaign → appears in list (confirms DB write/read)
- [ ] Refresh page → campaign persists (confirms DB connection is stable)

**Step 3: File storage (R2)**
- [ ] Upload a homebrew PDF → processes without error
- [ ] View homebrew image → loads from R2 (check Network tab: should redirect to `*.r2.cloudflarestorage.com` or `files.quiverdm.com`)

**Step 4: WebSocket**
- [ ] Open a session page → check browser console for WebSocket connection to `wss://ws.quiverdm.com`
- [ ] Start live transcription → should connect

**Step 5: Workers (homelab)**
- [ ] Upload a PDF for homebrew → check `pm2 logs worker:pdf` on homelab for processing
- [ ] Worker should pick up the BullMQ job (confirms Redis connection from workers works)

**Step 6: Stripe webhooks**
- [ ] In Stripe Dashboard, update webhook endpoint to `https://app.quiverdm.com/api/webhooks/stripe`
- [ ] Trigger a test event from Stripe → check Vercel function logs

---

## Recommended Database for Beta: Neon.tech

Since TCP tunnels for Postgres through Cloudflare are complex, use **Neon.tech** for the Postgres database for the beta:

1. Go to [neon.tech](https://neon.tech) → Create account → Create project
2. Select PostgreSQL 15 (to match pgvector requirement)
3. Install pgvector extension: in Neon SQL editor run `CREATE EXTENSION IF NOT EXISTS vector;`
4. Copy the connection string (includes SSL by default)
5. Set `DATABASE_URL` in Vercel to the Neon connection string
6. Run migrations: `DATABASE_URL=<neon_url> npx prisma db push`

For Redis, use **Upstash**:
1. Go to [upstash.com](https://upstash.com) → Create database → Global
2. Copy the TLS Redis URL (`rediss://...`)
3. Set `REDIS_URL` in Vercel and on homelab (workers need Redis too)

---

## Rollback Plan

If Vercel deployment breaks, homelab fallback:

```bash
# On homelab — run the full Next.js app locally
npm run build
NODE_ENV=production npm start
# Expose via cloudflared: cloudflared tunnel --url http://localhost:3847
```

This gives you a running app on homelab while you debug the Vercel deployment.
