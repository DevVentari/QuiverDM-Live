# QuiverDM - API Keys Setup Guide

Complete step-by-step guide to obtain all API keys needed for QuiverDM.

---

## 🚀 Quick Start - MVP Essential Keys

These are the **minimum required** keys to get started with development:

1. ✅ OpenAI API (Whisper transcription)
2. ✅ Anthropic Claude API (Summaries)
3. ✅ Supabase (Database + Auth)
4. ✅ Cloudflare R2 (File storage)
5. ✅ Google OAuth (User login)

---

## 1. OpenAI API Key

**Purpose:** Whisper transcription for audio/video files

### Steps:

1. **Sign up/Login:** https://platform.openai.com/signup
2. **Add payment method:** https://platform.openai.com/account/billing/overview
   - Required for API access
   - Pay-as-you-go pricing
3. **Create API Key:** https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Name it: `QuiverDM Development`
   - Copy the key immediately (you won't see it again!)
   - Starts with `sk-proj-...` or `sk-...`

### Pricing:
- Whisper API: $0.006/minute (~$1.08 for 3-hour session)
- GPT-4: $0.03/1K tokens input, $0.06/1K output

### Add to .env.local:
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

**Direct Link:** https://platform.openai.com/api-keys

---

## 2. Anthropic Claude API Key

**Purpose:** High-quality AI summaries and content understanding

### Steps:

1. **Sign up:** https://console.anthropic.com/
2. **Request API Access:** https://console.anthropic.com/settings/keys
3. **Add payment method:** https://console.anthropic.com/settings/billing
4. **Create API Key:**
   - Click "Create Key"
   - Name it: `QuiverDM`
   - Copy the key (starts with `sk-ant-...`)

### Pricing:
- Claude 3.5 Sonnet: $3/1M input tokens, $15/1M output tokens
- ~$0.20 per session summary

### Add to .env.local:
```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

**Direct Link:** https://console.anthropic.com/settings/keys

---

## 3. Supabase (Database + Auth + Storage)

**Purpose:** PostgreSQL database, authentication, real-time subscriptions

### Steps:

1. **Sign up:** https://supabase.com/dashboard/sign-up
2. **Create New Project:** https://supabase.com/dashboard
   - Click "New Project"
   - Name: `QuiverDM`
   - Database Password: Generate strong password (save it!)
   - Region: Choose closest to you
   - Wait 2-3 minutes for setup
3. **Get API Keys:**
   - Go to Settings → API: https://supabase.com/dashboard/project/_/settings/api
   - Copy **Project URL**
   - Copy **anon public** key
   - Copy **service_role** key (keep this secret!)
4. **Get Database URL:**
   - Go to Settings → Database: https://supabase.com/dashboard/project/_/settings/database
   - Under "Connection String" → "URI"
   - Copy the connection string
   - Replace `[YOUR-PASSWORD]` with your database password

### Pricing:
- Free tier: 500MB database, 2GB storage, 50K auth users
- Pro: $25/month for 8GB database, 100GB storage

### Add to .env.local:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

**Direct Links:**
- Dashboard: https://supabase.com/dashboard
- API Settings: https://supabase.com/dashboard/project/_/settings/api
- Database Settings: https://supabase.com/dashboard/project/_/settings/database

---

## 4. Cloudflare R2 (Object Storage)

**Purpose:** Store audio/video files, PDFs, images (S3-compatible, no egress fees!)

### Steps:

1. **Sign up:** https://dash.cloudflare.com/sign-up
2. **Enable R2:** https://dash.cloudflare.com/?to=/:account/r2
   - May need to add payment method (but free tier is generous)
3. **Create R2 Bucket:**
   - Click "Create bucket"
   - Name: `quiverdm-media-dev` (or `quiverdm-media-prod`)
   - Location: Automatic
4. **Create API Token:**
   - Go to R2 → Manage R2 API Tokens
   - Click "Create API token"
   - Permissions: "Object Read & Write"
   - Apply to specific bucket: `quiverdm-media-dev`
   - Copy **Access Key ID** and **Secret Access Key**
5. **Get Account ID:**
   - Found in R2 dashboard URL: `dash.cloudflare.com/:account/r2`
   - Or in R2 settings

### Pricing:
- Storage: $0.015/GB/month
- Operations: $0.36/million requests
- **NO egress fees** (huge savings vs S3!)
- Free tier: 10GB storage, 1M Class A operations/month

### Add to .env.local:
```env
R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=quiverdm-media-dev
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

**Direct Links:**
- R2 Dashboard: https://dash.cloudflare.com/?to=/:account/r2
- Create Bucket: https://dash.cloudflare.com/?to=/:account/r2/new

---

## 5. Google OAuth (Authentication)

**Purpose:** Allow users to sign in with Google

### Steps:

1. **Go to Google Cloud Console:** https://console.cloud.google.com/
2. **Create New Project:**
   - Click project dropdown → "New Project"
   - Name: `QuiverDM`
   - Click "Create"
3. **Enable APIs:**
   - Go to: https://console.cloud.google.com/apis/library
   - Search and enable: "Google+ API" or "People API"
4. **Configure OAuth Consent Screen:**
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - User Type: External
   - App name: `QuiverDM`
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `email`, `profile`, `openid`
   - Save and Continue
5. **Create OAuth 2.0 Client ID:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: `QuiverDM Web Client`
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (development)
     - `https://yourdomain.com/api/auth/callback/google` (production)
   - Click "Create"
   - Copy **Client ID** and **Client Secret**

### Add to .env.local:
```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Direct Links:**
- Google Cloud Console: https://console.cloud.google.com/
- APIs & Credentials: https://console.cloud.google.com/apis/credentials
- OAuth Consent Screen: https://console.cloud.google.com/apis/credentials/consent

---

## 6. NextAuth Secret (Generate Locally)

**Purpose:** Encrypt JWT tokens and session data

### Steps:

**Option 1 - OpenSSL (recommended):**
```bash
openssl rand -base64 32
```

**Option 2 - Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 3 - Online:**
https://generate-secret.vercel.app/32

### Add to .env.local:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-generated-secret-here
```

---

## 🔧 Optional Services (Can Add Later)

### 7. Upstash (Redis + Queue)

**Purpose:** Job queues, caching, rate limiting

1. **Sign up:** https://console.upstash.com/
2. **Create Redis Database:**
   - Click "Create Database"
   - Name: `quiverdm-cache`
   - Type: Regional (cheaper) or Global
   - Free tier: 10K commands/day
3. **Get Credentials:**
   - Click on your database
   - Copy REST URL and REST Token

**Links:**
- Console: https://console.upstash.com/
- Pricing: https://upstash.com/pricing

```env
UPSTASH_REDIS_REST_URL=https://xxx-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxxxxxxx
```

---

### 8. Sentry (Error Tracking)

**Purpose:** Monitor errors and performance

1. **Sign up:** https://sentry.io/signup/
2. **Create Project:**
   - Platform: Next.js
   - Name: `quiverdm`
3. **Get DSN:**
   - Project Settings → Client Keys (DSN)

**Links:**
- Sign up: https://sentry.io/signup/
- Pricing: Free tier (5K errors/month)

```env
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxx.ingest.sentry.io/xxxxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxxx.ingest.sentry.io/xxxxxxx
```

---

### 9. PostHog (Analytics)

**Purpose:** Product analytics, feature flags

1. **Sign up:** https://app.posthog.com/signup
2. **Create Project:**
   - Name: `QuiverDM`
3. **Get Project API Key:**
   - Settings → Project API Key

**Links:**
- Sign up: https://app.posthog.com/signup
- Pricing: Free tier (1M events/month)

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

### 10. Discord OAuth (Optional Login Method)

**Purpose:** Allow users to sign in with Discord

1. **Go to:** https://discord.com/developers/applications
2. **New Application:**
   - Click "New Application"
   - Name: `QuiverDM`
3. **OAuth2:**
   - Go to OAuth2 tab
   - Add Redirect: `http://localhost:3000/api/auth/callback/discord`
   - Copy Client ID and Client Secret

**Links:**
- Developer Portal: https://discord.com/developers/applications

```env
DISCORD_CLIENT_ID=xxxxxxxxxxxxxxxxxx
DISCORD_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 11. Resend (Email Service)

**Purpose:** Send transactional emails (magic links, notifications)

1. **Sign up:** https://resend.com/signup
2. **Get API Key:**
   - Dashboard → API Keys
   - Click "Create API Key"
   - Name: `QuiverDM`

**Links:**
- Sign up: https://resend.com/signup
- Pricing: Free tier (100 emails/day)

```env
EMAIL_SERVER_USER=resend
EMAIL_SERVER_PASSWORD=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_SERVER_HOST=smtp.resend.com
EMAIL_SERVER_PORT=587
EMAIL_FROM=noreply@yourdomain.com
```

---

## 📋 Complete .env.local Template

After getting all MVP keys, your `.env.local` should look like:

```env
# Database
DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-32-char-random-string

# OAuth Providers
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# AI Services
OPENAI_API_KEY=sk-proj-xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=xxxxx
R2_ACCESS_KEY_ID=xxxxx
R2_SECRET_ACCESS_KEY=xxxxx
R2_BUCKET_NAME=quiverdm-media-dev
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx

# Optional - Add later
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
```

---

## ⚡ Quick Setup Order

**Day 1 - Core Services (30-45 minutes):**
1. Generate NextAuth Secret (2 min)
2. Supabase account + project (10 min)
3. Google OAuth (15 min)
4. OpenAI API key (5 min)
5. Anthropic Claude API key (5 min)
6. Cloudflare R2 bucket (10 min)

**Day 2 - Optional Services (if needed):**
7. Upstash Redis (5 min)
8. Sentry monitoring (5 min)
9. PostHog analytics (5 min)

---

## 🔒 Security Best Practices

1. **Never commit `.env.local` to git** - It's already in `.gitignore`
2. **Use different keys for dev/production**
3. **Rotate keys every 90 days**
4. **Set up billing alerts** on all services
5. **Use environment variables in Vercel** for production
6. **Keep service_role keys secret** - Never expose in client code

---

## 💰 Estimated Monthly Costs (100 Active Users)

### Free Tier (Development):
- Supabase: $0 (free tier)
- Cloudflare R2: $0-5 (minimal usage)
- Google OAuth: $0
- Sentry: $0 (free tier)
- PostHog: $0 (free tier)
- **Total: ~$0-5/month**

### Production (100 active DMs):
- Supabase Pro: $25
- OpenAI (Whisper): $100-200
- Anthropic (Claude): $50-100
- Cloudflare R2: $10
- Upstash: $10-20
- Optional services: $15-30
- **Total: ~$210-385/month**

---

## 🆘 Troubleshooting

### "Invalid API Key" Error:
- Check for extra spaces when copying
- Ensure key hasn't expired
- Verify key has correct permissions

### Google OAuth "redirect_uri_mismatch":
- Check callback URL exactly matches
- Ensure `http://` vs `https://` is correct
- No trailing slashes

### Supabase Connection Failed:
- Verify password is correct (no special chars encoded)
- Check if project is paused (free tier)
- Ensure IP isn't blocked

### R2 "Access Denied":
- Verify API token has write permissions
- Check bucket name is correct
- Ensure account ID is correct

---

## 📚 Additional Resources

- **NextAuth.js Setup:** https://next-auth.js.org/getting-started/example
- **Supabase Auth Guide:** https://supabase.com/docs/guides/auth
- **OpenAI API Docs:** https://platform.openai.com/docs/api-reference
- **Anthropic Claude Docs:** https://docs.anthropic.com/claude/reference/getting-started-with-the-api
- **Cloudflare R2 Docs:** https://developers.cloudflare.com/r2/

---

**Need Help?** Check our main documentation at `/docs` or open an issue on GitHub.
