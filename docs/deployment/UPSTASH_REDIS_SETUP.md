# Upstash Redis Setup Guide

Complete guide to setting up Upstash Redis for QuiverDM on Vercel.

## Why Upstash?

**Benefits over Railway Redis:**
- ✅ **No egress fees** when connecting from Vercel
- ✅ **Optimized for serverless** (Vercel's architecture)
- ✅ **Free tier**: 10,000 commands/day (plenty for PDF queue)
- ✅ **Global edge network** for low latency
- ✅ **Easy integration** with Vercel environment

**Railway Redis issue:**
- ❌ Public Redis URL incurs egress fees (data leaves Railway network)
- ❌ Private URL (`redis.railway.internal`) doesn't work from Vercel

---

## Quick Setup (5 minutes)

### Step 1: Create Upstash Account

1. Go to https://console.upstash.com
2. Sign up with Google/GitHub or email
3. Verify your email

### Step 2: Create Redis Database

1. Click **"Create Database"**
2. **Name**: `quiverdm-production` (or any name)
3. **Type**: Choose **"Regional"** (cheaper, sufficient)
4. **Region**: Choose closest to your Vercel region:
   - US East (Virginia) if Vercel is `iad1` (Washington DC)
   - US West if Vercel is in California
   - Europe if deployed in EU
5. **Eviction**: Leave as "No Eviction" (default)
6. Click **"Create"**

**Cost:** Free tier includes:
- 10,000 commands per day
- 256 MB storage
- Regional database

### Step 3: Get Connection String

After database is created:

1. Click on your database name
2. Scroll to **"REST API"** section
3. Copy the **"UPSTASH_REDIS_REST_URL"**
   - Format: `https://your-database.upstash.io`
4. **OR** use the **Redis connection string**:
   - Click **"Redis"** tab at top
   - Copy **"Redis Connection String"**
   - Format: `rediss://default:password@your-endpoint.upstash.io:6379`

**Recommended:** Use the Redis connection string (works with ioredis)

### Step 4: Add to Vercel Environment Variables

1. Go to **Vercel Dashboard** → Your Project
2. Click **Settings** → **Environment Variables**
3. Add new variable:
   - **Name**: `REDIS_URL`
   - **Value**: Paste the Redis connection string from Upstash
   - **Environment**: Select "Production", "Preview", "Development"
4. Click **"Save"**

### Step 5: Deploy

Your changes are already in the code. Just deploy:

```bash
git push origin main
```

Or trigger manual deployment in Vercel Dashboard.

---

## Environment Variable Setup

### For Vercel (Production)

Add this single environment variable:

```bash
REDIS_URL="rediss://default:YOUR_PASSWORD@your-endpoint.upstash.io:6379"
```

### For Local Development (Optional)

If you want to use Upstash locally, add to `.env.local`:

```bash
REDIS_URL="rediss://default:YOUR_PASSWORD@your-endpoint.upstash.io:6379"
```

Or keep using local Docker Redis:

```bash
REDIS_HOST="localhost"
REDIS_PORT="6380"
# No REDIS_URL (falls back to host/port)
```

---

## Verification

### Check Upstash Dashboard

After deployment:

1. Go to Upstash Dashboard → Your Database
2. Click **"Data Browser"** tab
3. Should see keys appear as PDFs are uploaded:
   - `bull:pdf-processing:*` - Queue jobs
   - `bull:pdf-processing:wait` - Waiting jobs
   - `bull:pdf-processing:active` - Active jobs

### Check Vercel Logs

After deployment:

1. Go to Vercel Dashboard → Deployments
2. Click latest deployment → **"Functions"** tab
3. Look for successful Redis connection (no `ENOTFOUND` errors)

### Test PDF Upload

1. Visit your production site
2. Upload a PDF to homebrew library
3. Check Upstash dashboard for new keys
4. PDF should process without errors

---

## Troubleshooting

### Issue: Still seeing `redis.railway.internal` errors

**Solution:**
- Remove old Redis env vars from Vercel:
  - Delete `REDIS_HOST`
  - Delete `REDIS_PORT`
  - Delete `REDIS_PASSWORD`
- Only keep `REDIS_URL`
- Redeploy

### Issue: "Connection timeout" errors

**Solution:**
- Verify the Redis connection string is correct
- Check Upstash dashboard shows database as "Active"
- Ensure no firewall/VPN blocking Upstash domain

### Issue: "Too many connections"

**Solution:**
- Upstash free tier limits concurrent connections
- Upgrade to paid tier if needed
- Or reduce BullMQ concurrency (see below)

---

## Configuration Options

### Reduce Connection Usage (Optional)

If hitting connection limits, edit `src/lib/queue.ts`:

```typescript
// Add connection pooling options
const redisConnection = process.env.REDIS_URL
  ? {
      // Upstash connection string
      ...(typeof process.env.REDIS_URL === 'string'
        ? process.env.REDIS_URL
        : process.env.REDIS_URL),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      // Connection pooling
      connectionName: 'quiverdm-queue',
    }
  : // Local Redis...
```

### Monitor Usage

In Upstash Dashboard:

1. Go to your database
2. Click **"Stats"** tab
3. Monitor:
   - Daily commands (should be under 10,000 for free tier)
   - Storage usage (should be under 256 MB)
   - Throughput

---

## Migration from Railway Redis

If you previously used Railway Redis:

### Before Migration

1. Ensure no active PDF processing jobs:
   ```bash
   # Check Upstash dashboard - should show 0 active jobs
   ```

2. Backup any important job data (optional)

### After Migration

1. Old jobs in Railway Redis are **abandoned** (not migrated)
2. Users may need to re-upload PDFs if they were mid-processing
3. This is okay - job queue is designed to be ephemeral

### Cleanup Railway Redis (Optional)

Once Upstash is working:

1. Railway Dashboard → Your Redis service
2. Click **"..."** → **"Remove Service"**
3. Saves $5/month

---

## Upstash Pricing (Reference)

### Free Tier (Current)
- 10,000 commands/day
- 256 MB storage
- Regional database
- **Cost:** $0/month

### Pay As You Go (If needed)
- $0.2 per 100,000 commands
- $0.25 per GB storage/month
- **Typical cost for QuiverDM:** ~$2-5/month with moderate usage

### Pro Tier (Overkill for now)
- 1M commands/day included
- 1 GB storage included
- Global database
- **Cost:** $20/month

**Recommendation:** Start with free tier, upgrade if needed.

---

## Next Steps

After Upstash is set up:

1. ✅ Remove Railway Redis env vars from Vercel
2. ✅ Redeploy to use Upstash
3. ✅ Test PDF upload functionality
4. ✅ Monitor Upstash dashboard for usage
5. ✅ Consider removing Railway Redis to save costs

---

## Support

- **Upstash Docs:** https://docs.upstash.com/redis
- **Upstash Discord:** https://upstash.com/discord
- **Vercel + Upstash:** https://vercel.com/integrations/upstash

---

**Setup complete!** Your PDF job queue now uses Upstash Redis with no egress fees. 🎉
