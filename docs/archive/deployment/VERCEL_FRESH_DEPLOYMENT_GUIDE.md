# QuiverDM - Fresh Vercel Deployment Guide

**Complete step-by-step guide to deploy QuiverDM from scratch**

Last Updated: 2025-11-18

---

## Prerequisites Checklist

Before starting, you'll need accounts for:

- ✅ GitHub account (for code hosting)
- ✅ Vercel account (for hosting the Next.js app)
- ✅ Railway account (for PostgreSQL database)
- ✅ Upstash account (for Redis job queue)
- ✅ Cloudflare account (for R2 object storage)
- ✅ Google Cloud Console (for OAuth)
- ✅ OpenAI account (for AI features)
- ✅ Anthropic account (for Claude AI)
- ✅ Gemini API key (optional, for alternative AI)

---

## Part 1: Infrastructure Setup

### 1.1 PostgreSQL Database (Railway)

**Time:** 5 minutes
**Cost:** $5/month (500 hours)

1. **Go to Railway:** https://railway.app
2. **Sign up/Login** with GitHub
3. **Click "New Project"**
4. **Select "Provision PostgreSQL"**
5. **Wait for deployment** (2-3 minutes)
6. **Copy credentials:**
   - Click on PostgreSQL service
   - Go to "Variables" tab
   - Copy `DATABASE_URL` value
   - Format: `postgresql://postgres:password@host.railway.app:5432/railway`

**Save this for later:** `DATABASE_URL` postgresql://postgres:vbMOkjFUjfWWgiYUwccyvUpIsGhxFFQH@postgres.railway.internal:5432/railway

---

### 1.2 Redis Queue (Upstash)

**Time:** 5 minutes
**Cost:** Free tier (10,000 commands/day)

**Why Upstash over Railway Redis:**
- ✅ No egress fees when connecting from Vercel
- ✅ Optimized for serverless (better than traditional Redis)
- ✅ Free tier is generous for PDF processing queue
- ✅ Global edge network for low latency

**Setup:**

1. **Go to Upstash:** https://console.upstash.com
2. **Sign up** (free)
3. **Click "Create Database"**
4. **Configure:**
   - Name: `quiverdm-production`
   - Type: **Regional**
   - Region: **US East (Virginia)** (closest to Vercel `iad1`)
   - Eviction: No Eviction (default)
5. **Click "Create"**
6. **Copy connection string:**
   - Click on your database name
   - Click **"Redis"** tab at top
   - Copy **"Redis Connection String"**
   - Format: `rediss://default:password@your-endpoint.upstash.io:6379
   - 
   - `

**Save this for later:** `REDIS_URL` REDIS_URL="rediss://default:AXQ2AAIncDI0NDIwN2FlYzEzNWM0OGNmOTE1ZjkyMWI4MzEyNzkyMnAyMjk3NTA@golden-redfish-29750.upstash.io:6379"

---

### 1.3 File Storage (Cloudflare R2)

**Time:** 10 minutes
**Cost:** Free tier (10GB storage, 1M reads/month)

1. **Go to Cloudflare:** https://dash.cloudflare.com
2. **Sign up/Login**
3. **Go to R2 Object Storage** (left sidebar)
4. **Click "Create bucket"**
   - Name: `quiverdm-media-prod` (must be globally unique)
   - Location: Automatic
5. **Click "Create bucket"**

**Create API Token:**

1. **Click "Manage R2 API Tokens"** (top right)
2. **Click "Create API Token"**
3. **Configure:**
   - Token name: `quiverdm-vercel-production`
   - Permissions: **Admin Read & Write**
   - Specific buckets: Select `quiverdm-media-prod`
4. **Click "Create API Token"**
5. **Copy these values:**
   - Access Key ID
   - Secret Access Key
   - Account ID (shown in URL or dashboard)

**Save these for later:**
- `R2_ACCOUNT_ID` oBDJrX0gx5UVs7CHOjxU_lgyf4jFOfxCayXUfTGt (token id)
- `R2_ACCESS_KEY_ID` 6abd4e5e09541ef2feca096acd8146bf
- `R2_SECRET_ACCESS_KEY` dc1b525dab8bee0f25940a0fa32fd6975885615b30f5de47c5a0c0ca9e331fd0
- `R2_BUCKET_NAME=quiverdm-media-prod`

---

### 1.4 Google OAuth (Authentication)

**Time:** 10 minutes
**Cost:** Free

1. **Go to Google Cloud Console:** https://console.cloud.google.com
2. **Create new project:**
   - Click project dropdown (top)
   - Click "New Project"
   - Name: `QuiverDM`
3. **Enable Google+ API:**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"
4. **Create OAuth credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Web application**
   - Name: `QuiverDM Production`
   - Authorized JavaScript origins:
     - `https://quiver.blakewales.au`
     - `https://*.vercel.app` (for preview deployments)
   - Authorized redirect URIs:
     - `https://quiver.blakewales.au/api/auth/callback/google`
     - `https://*.vercel.app/api/auth/callback/google`
5. **Click "Create"**
6. **Copy:**
   - Client ID
   - Client Secret

**Save these for later:**
- `GOOGLE_CLIENT_ID` 436366008044-21i0ouol8a61krgjvsq5e14lbo56lf8i.apps.googleusercontent.com
- `GOOGLE_CLIENT_SECRET` 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

---

### 1.5 AI Services

#### OpenAI (Whisper transcription)

1. **Go to:** https://platform.openai.com/api-keys
2. **Click "Create new secret key"**
3. **Name:** `QuiverDM Production`
4. **Copy the key** (starts with `sk-proj-`)

**Save:** `OPENAI_API_KEY`

#### Anthropic (Claude AI summaries)

1. **Go to:** https://console.anthropic.com/settings/keys
2. **Click "Create Key"**
3. **Name:** `QuiverDM Production`
4. **Copy the key** (starts with `sk-ant-`)

**Save:** `ANTHROPIC_API_KEY`

#### Gemini (Optional - alternative AI)

1. **Go to:** https://aistudio.google.com/app/apikey
2. **Click "Create API Key"**
3. **Copy the key**

**Save (optional):** `GEMINI_API_KEY`

---

## Part 2: Vercel Deployment

### 2.1 Create New Vercel Project

**Time:** 15 minutes

1. **Go to Vercel:** https://vercel.com
2. **Sign up/Login** with GitHub
3. **Click "Add New" → "Project"**
4. **Import Git Repository:**
   - Connect GitHub account if needed
   - Select `DevVentari/QuiverDM-Live`
   - Click "Import"

5. **Configure Project:**
   - **Project Name:** `quiverdm-live` (or your preferred name)
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** (leave default: `next build`)
   - **Output Directory:** (leave default: `.next`)
   - **Install Command:** (leave default: `npm install`)

6. **DO NOT CLICK DEPLOY YET** - We need to add environment variables first

---

### 2.2 Add Environment Variables

**In the Vercel project configuration (before first deploy):**

Click **"Environment Variables"** section and add ALL of these:

#### Required - Database & Auth

```bash
# PostgreSQL Database (from Railway)
DATABASE_URL="postgresql://postgres:password@host.railway.app:5432/railway"

# NextAuth Configuration
NEXTAUTH_URL="https://quiver.blakewales.au"
NEXTAUTH_SECRET="GENERATE_THIS_SEE_BELOW"

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"
```

**Generate NEXTAUTH_SECRET:**
Run this locally:
```bash
openssl rand -base64 32
```
Paste the output as `NEXTAUTH_SECRET` value.

#### Required - Storage & Queue

```bash
# Cloudflare R2 (from Cloudflare dashboard)
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key-id"
R2_SECRET_ACCESS_KEY="your-secret-access-key"
R2_BUCKET_NAME="quiverdm-media-prod"
R2_PUBLIC_URL=""

# Upstash Redis (from Upstash dashboard)
REDIS_URL="rediss://default:password@your-endpoint.upstash.io:6379"
```

#### Required - AI Services

```bash
# OpenAI (from OpenAI platform)
OPENAI_API_KEY="sk-proj-your-key-here"

# Anthropic (from Anthropic console)
ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
```

#### Optional - Additional Services

```bash
# Gemini (optional - alternative AI)
GEMINI_API_KEY="AIzaSy..."

# HuggingFace (for speaker diarization in transcription)
HF_TOKEN="hf_..."

# Discord OAuth (if you want Discord login)
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-secret"

# Browserbase (for browser automation testing)
BROWSERBASE_PROJECT_ID="your-project-id"
BROWSERBASE_API_KEY="bb_live_your-key"
```

#### Environment Selection

For EACH environment variable:
- ✅ Check **Production**
- ✅ Check **Preview**
- ✅ Check **Development**

This ensures the variables work in all environments.

---

### 2.3 Deploy

1. **Click "Deploy"** button
2. **Wait for build** (5-10 minutes first time)
3. **Monitor build logs** for errors

**Expected build time:** 5-10 minutes

**Build should succeed** if all environment variables are correct.

---

### 2.4 Post-Deployment Configuration

#### A. Initialize Database

After first successful deployment:

1. **Go to deployment URL** (Vercel will show it)
2. **The database tables will auto-create** on first connection (Prisma migration)
3. **Or manually run migrations:**
   - Local terminal:
     ```bash
     # Point to production database
     DATABASE_URL="your-railway-url" npm run db:migrate
     ```

#### B. Set Up Custom Domain

1. **In Vercel project → Settings → Domains**
2. **Add domain:** `quiver.blakewales.au`
3. **Follow DNS configuration instructions**
4. **Wait for DNS propagation** (5-60 minutes)

#### C. Update Google OAuth Redirect URIs

After domain is configured:

1. **Go back to Google Cloud Console**
2. **Update OAuth credentials:**
   - Authorized JavaScript origins: Add `https://quiver.blakewales.au`
   - Authorized redirect URIs: Add `https://quiver.blakewales.au/api/auth/callback/google`

---

## Part 3: Verification & Testing

### 3.1 Test Deployment

**Check these critical paths:**

1. **Homepage:** https://quiver.blakewales.au
   - ✅ Should load marketing page
   - ✅ Navigation bar should be HIDDEN when logged out
   - ✅ "Sign In" and "Get Started" buttons visible

2. **Sign Up:** https://quiver.blakewales.au/auth/signup
   - ✅ Form should load
   - ✅ Invite code field should be visible
   - ✅ Try signup with valid code: `180F9349`
   - ✅ Should create account without 500 errors

3. **Sign In:** https://quiver.blakewales.au/auth/signin
   - ✅ Google OAuth button works
   - ✅ Email/password login works

4. **Dashboard (after login):** https://quiver.blakewales.au/dashboard
   - ✅ Should load user dashboard
   - ✅ Navigation bar should be VISIBLE when logged in
   - ✅ Can create campaigns

5. **Campaigns (without login):** https://quiver.blakewales.au/campaigns
   - ✅ Should redirect to signin page
   - ✅ Should NOT show campaign UI

---

### 3.2 Test Redis Queue (PDF Processing)

1. **Login to dashboard**
2. **Go to Homebrew Library**
3. **Upload a small PDF** (test file)
4. **Check Upstash dashboard:**
   - Go to https://console.upstash.com
   - Click your database
   - Click "Data Browser" tab
   - Should see keys like: `bull:pdf-processing:*`

---

### 3.3 Check Vercel Function Logs

1. **Vercel Dashboard → Deployments**
2. **Click latest deployment → "Functions" tab**
3. **Look for errors:**
   - ❌ Should NOT see: `ENOTFOUND redis.railway.internal`
   - ❌ Should NOT see: `Failed to fetch Prisma binaries`
   - ✅ Should see successful function executions

---

## Part 4: Troubleshooting

### Issue: Build Fails with Prisma Error

**Error:**
```
Failed to fetch sha256 checksum at https://binaries.prisma.sh/...
```

**Solution:**
Add environment variable:
```bash
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
```

---

### Issue: Redis Connection Errors

**Error:**
```
ENOTFOUND redis.railway.internal
```

**Solution:**
- Verify `REDIS_URL` is set (not `REDIS_HOST`/`REDIS_PORT`)
- Ensure using Upstash Redis URL (not Railway internal URL)
- Check Upstash database status is "Active"

---

### Issue: Signup Returns 500 Error

**Possible causes:**

1. **Edge Runtime Issue:**
   - Verify `src/app/api/auth/signup/route.ts` has:
     ```typescript
     export const runtime = 'nodejs';
     export const maxDuration = 60;
     ```

2. **Database Connection:**
   - Verify `DATABASE_URL` is correct
   - Test connection from Vercel functions logs

3. **Missing Environment Variables:**
   - Check `NEXTAUTH_SECRET` is set
   - Check `DATABASE_URL` is set

---

### Issue: Navigation Bar Shows When Logged Out

**Solution:**
- This means Vercel deployed OLD code
- Check deployment commit hash in Vercel
- Should be latest commit with auth fixes (343d3ac or later)
- If stuck on old commit (f304127):
  1. Disconnect Git integration
  2. Reconnect GitHub repository
  3. Force fresh deployment

---

### Issue: Vercel Not Deploying Latest Commits

**Symptoms:**
- Push to GitHub succeeds
- Webhook shows successful
- But Vercel deploys old commit

**Solutions:**

1. **Check Production Branch:**
   - Settings → Git → Production Branch
   - Should be `main`

2. **Check Ignored Build Step:**
   - Settings → Git → Ignored Build Step
   - Set to `exit 1` (forces all builds)

3. **Disconnect/Reconnect Git:**
   - Settings → Git → Disconnect
   - Wait 10 seconds
   - Reconnect repository

4. **Force Deployment:**
   ```bash
   git commit --allow-empty -m "Force Vercel deployment"
   git push origin main
   ```

---

## Part 5: Environment Variables Reference

### Complete List (Copy-Paste Ready)

```bash
# =============================================================================
# DATABASE & AUTHENTICATION
# =============================================================================
DATABASE_URL="postgresql://postgres:password@host.railway.app:5432/railway"
NEXTAUTH_URL="https://quiver.blakewales.au"
NEXTAUTH_SECRET="your-generated-secret-from-openssl"

# =============================================================================
# OAUTH PROVIDERS
# =============================================================================
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-secret"

# =============================================================================
# STORAGE (Cloudflare R2)
# =============================================================================
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="quiverdm-media-prod"
R2_PUBLIC_URL=""

# =============================================================================
# REDIS QUEUE (Upstash)
# =============================================================================
REDIS_URL="rediss://default:password@your-endpoint.upstash.io:6379"

# =============================================================================
# AI SERVICES
# =============================================================================
OPENAI_API_KEY="sk-proj-your-openai-key"
ANTHROPIC_API_KEY="sk-ant-api03-your-anthropic-key"
GEMINI_API_KEY="AIzaSy-your-gemini-key"
HF_TOKEN="hf_your-huggingface-token"

# =============================================================================
# OPTIONAL SERVICES
# =============================================================================
BROWSERBASE_PROJECT_ID="your-browserbase-project-id"
BROWSERBASE_API_KEY="bb_live_your-browserbase-key"

# =============================================================================
# PRISMA (if needed for build issues)
# =============================================================================
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
```

---

## Part 6: Post-Setup Checklist

### ✅ Infrastructure

- [ ] Railway PostgreSQL database created
- [ ] Upstash Redis database created
- [ ] Cloudflare R2 bucket created with API token
- [ ] Google OAuth credentials created

### ✅ Vercel Configuration

- [ ] Project imported from GitHub
- [ ] All required environment variables added
- [ ] First deployment successful
- [ ] Custom domain configured
- [ ] SSL certificate active

### ✅ Authentication

- [ ] Can access signup page
- [ ] Can create account with invite code
- [ ] Google OAuth login works
- [ ] Navigation bar hidden when logged out
- [ ] Navigation bar visible when logged in

### ✅ Core Features

- [ ] Dashboard loads after login
- [ ] Can create campaigns
- [ ] Can upload PDFs to homebrew library
- [ ] PDF processing queue works (check Upstash)
- [ ] Unauthenticated users redirected from protected routes

### ✅ Monitoring

- [ ] No errors in Vercel function logs
- [ ] No Redis connection errors
- [ ] No Prisma connection errors
- [ ] No 500 errors on signup/signin

---

## Part 7: Ongoing Maintenance

### Daily Monitoring

- **Upstash Dashboard:** Check Redis command usage (free tier: 10,000/day)
- **Vercel Dashboard:** Monitor function execution errors
- **Railway Dashboard:** Check database usage (free tier: 500 hours/month)

### Monthly Costs (Estimated)

- **Vercel:** $0 (Hobby plan - free)
- **Railway PostgreSQL:** $5/month
- **Upstash Redis:** $0 (within free tier)
- **Cloudflare R2:** $0 (within free tier)
- **Google OAuth:** $0 (free)
- **OpenAI:** Pay-as-you-go (varies by usage)
- **Anthropic:** Pay-as-you-go (varies by usage)

**Total baseline:** ~$5/month + AI API usage

---

## Part 8: Support & Documentation

### Key Documentation Files

- `README.md` - Getting started guide
- `docs/RAILWAY_SETUP.md` - Railway deployment details
- `docs/UPSTASH_REDIS_SETUP.md` - Upstash Redis setup
- `docs/API_KEYS_SETUP_GUIDE.md` - Comprehensive API key guide
- `docs/PDF_JOB_QUEUE_GUIDE.md` - PDF processing system
- `SETUP_CHECKLIST.md` - Development setup checklist

### Getting Help

- **GitHub Issues:** https://github.com/DevVentari/QuiverDM-Live/issues
- **Vercel Support:** https://vercel.com/support
- **Railway Support:** https://railway.app/help
- **Upstash Discord:** https://upstash.com/discord

---

## Part 9: Common Pitfalls to Avoid

### ❌ DON'T

1. **Use Railway Redis public URL with Vercel** → Incurs egress fees
2. **Set NEXTAUTH_URL to localhost in production** → OAuth will break
3. **Forget to add environment variables for Preview/Development** → Preview deploys will fail
4. **Use Edge Runtime for signup route** → bcrypt won't work
5. **Skip NEXTAUTH_SECRET generation** → Security vulnerability
6. **Use old commit for deployment** → Missing critical fixes

### ✅ DO

1. **Use Upstash Redis** → No egress fees, optimized for serverless
2. **Set NEXTAUTH_URL to production domain** → OAuth works correctly
3. **Add env vars to all environments** → Consistent behavior
4. **Force Node.js runtime for auth routes** → Proper bcrypt support
5. **Generate strong NEXTAUTH_SECRET** → Secure sessions
6. **Deploy latest commit with fixes** → All features working

---

## Final Notes

**This guide creates a production-ready deployment with:**
- ✅ Secure authentication (NextAuth + Google OAuth)
- ✅ Invite-only registration system
- ✅ PDF processing with job queue
- ✅ File storage with Cloudflare R2
- ✅ AI-powered features (transcription, summaries)
- ✅ Proper navigation bar authentication flow
- ✅ No egress fees (Upstash Redis)
- ✅ Cost-optimized ($5/month baseline)

**Deployment time:** ~45 minutes (including account creation)

**Difficulty:** Intermediate (requires familiarity with cloud services)

---

**Last Updated:** 2025-11-18
**Compatible with:** QuiverDM commit 8f298d1 or later
