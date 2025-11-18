# Railway Deployment Setup for QuiverDM

Railway will host your **PostgreSQL database** and **Redis** for production. Vercel will host the Next.js app.

## Step 1: Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub
3. Verify your email

## Step 2: Create a New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `DevVentari/QuiverDM-Live`
4. Railway will automatically detect it's a Next.js app

## Step 3: Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will provision a PostgreSQL database
4. Click on the PostgreSQL service
5. Go to "Variables" tab
6. **Copy** the `DATABASE_URL` value (looks like `postgresql://postgres:password@host:port/railway`)

## Step 4: Add Redis

1. In your Railway project, click "+ New"
2. Select "Database" → "Redis"
3. Railway will provision a Redis instance
4. Click on the Redis service
5. Go to "Variables" tab
6. **Copy** the following values:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD` (if shown)
   - Or just copy `REDIS_URL` (full connection string)

## Step 5: Configure Environment Variables in Vercel

Now add these Railway values to your Vercel deployment:

### Required Variables from Railway:

```bash
# Database (from Railway PostgreSQL)
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"

# Redis (from Railway Redis)
REDIS_HOST="your-redis-host.railway.app"
REDIS_PORT="6379"
REDIS_PASSWORD="your-redis-password"  # if required
```

### How to Add to Vercel:

1. Go to https://vercel.com → Your Project
2. Settings → Environment Variables
3. Add each variable:
   - **DATABASE_URL** (from Railway PostgreSQL)
   - **REDIS_HOST** (from Railway Redis)
   - **REDIS_PORT** (from Railway Redis)
   - **REDIS_PASSWORD** (if your Railway Redis requires it)
4. Select "Production, Preview, Development" for each
5. Click "Save"

## Step 6: Run Database Migration

Once you've added the `DATABASE_URL` to Vercel, you need to migrate the database schema:

### Option A: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Pull environment variables from Vercel
vercel env pull .env.production

# Run migration using production database
DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" npx prisma db push

# Or use migrate deploy for production
DATABASE_URL="$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" npx prisma migrate deploy
```

### Option B: Direct Connection (Alternative)

```bash
# Temporarily set DATABASE_URL to Railway PostgreSQL
export DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"

# Run migration
npx prisma db push

# Generate invite codes for production
npm run generate-invites -- 20
```

### Option C: Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migration on Railway
railway run npx prisma db push

# Generate invite codes
railway run npm run generate-invites -- 20
```

## Step 7: Disable Railway Next.js Deployment (Important!)

Since we're using Vercel for the Next.js app, we don't want Railway to deploy it:

1. In Railway, click on your **main service** (QuiverDM)
2. Go to "Settings" tab
3. Click "Remove Service" or "Pause Deployment"

**OR** configure Railway to only run the database and Redis:

1. Remove the main app service
2. Keep only PostgreSQL and Redis services running

## Step 8: Verify Everything Works

### Check Database Connection:

```bash
# Test connection to Railway PostgreSQL
DATABASE_URL="your-railway-postgres-url" npx prisma studio
```

### Check Redis Connection:

```bash
# Install redis-cli
npm i -g redis-cli

# Test connection
redis-cli -h your-redis-host.railway.app -p 6379 -a your-password ping
# Should return: PONG
```

## Step 9: Redeploy Vercel

1. Go to Vercel → Your Project
2. Click "Deployments"
3. Click "Redeploy" on the latest deployment
4. Verify the build succeeds

## Step 10: Test Production App

1. Visit your Vercel deployment URL
2. Try to sign up (should require invite code!)
3. Use one of these invite codes:
   ```
   180F9349
   8F352D5C
   415B2509
   ```
4. Create a campaign to verify database connection
5. Upload a PDF to verify Redis job queue works

## Railway Project Structure

Your Railway project should have:
- ✅ **PostgreSQL** - Production database
- ✅ **Redis** - Job queue for PDF processing
- ❌ **Next.js App** - REMOVED (hosted on Vercel instead)

## Costs

**Railway Free Tier:**
- $5/month credit (includes PostgreSQL + Redis for small apps)
- PostgreSQL: ~$2-3/month for small DB
- Redis: ~$1-2/month for small instance
- **Total: ~$3-5/month** (covered by free credit)

**Vercel Free Tier:**
- Serverless Functions: Free (with limits)
- Bandwidth: 100 GB/month
- **Total: $0/month** for hobby projects

## Troubleshooting

### "Connection refused" errors:
- Check `DATABASE_URL` is correct in Vercel env vars
- Verify Railway PostgreSQL is running
- Check Railway didn't pause services (needs payment method)

### Redis connection errors:
- Verify `REDIS_HOST` and `REDIS_PORT` in Vercel
- Check Railway Redis is running
- Test connection with `redis-cli`

### Database migration fails:
- Make sure `DATABASE_URL` points to Railway PostgreSQL
- Run `npx prisma db push` locally first to test
- Check PostgreSQL logs in Railway for errors

### Invite codes not working:
- Generate codes on production database:
  ```bash
  DATABASE_URL="railway-url" npm run generate-invites -- 10
  ```
- Verify codes exist:
  ```bash
  DATABASE_URL="railway-url" npx prisma studio
  ```

## Alternative: Upstash Redis

If you prefer Upstash Redis over Railway Redis (better Vercel integration):

1. Go to https://console.upstash.com/redis
2. Create new database
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. Add to Vercel env vars instead of Railway Redis
5. Update `src/lib/queue.ts` to use Upstash REST API

## Next Steps After Setup

1. ✅ Test signup with invite codes
2. ✅ Test campaign creation
3. ✅ Test PDF upload (verifies Redis queue)
4. ✅ Monitor Railway usage dashboard
5. ✅ Add payment method to Railway (prevents service pause)
6. ✅ Set up database backups in Railway
7. ✅ Configure custom domain in Vercel (optional)

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Vercel Docs: https://vercel.com/docs
