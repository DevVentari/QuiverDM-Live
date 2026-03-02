# Services & Billing Register

Living document — update when adding or removing any external service.
Account logins are in `C:\Users\mail\.claude\credentials.env` unless noted.

---

## Hosting & Infrastructure

### Vercel
- **Purpose:** Next.js app hosting + edge functions + cron jobs
- **Plan:** Hobby (free) — upgrade to Pro ($20/mo) when team grows
- **Free tier limits:** 100GB bandwidth/mo, 6,000 build minutes/mo
- **Account:** blakes-projects-afd12cfa (GitHub: DevVentari)
- **Dashboard:** https://vercel.com/blakes-projects-afd12cfa
- **Notes:** Deploy via `git push origin main` (Vercel CLI fails — node_modules too large)

### Neon (PostgreSQL + pgvector)
- **Purpose:** Primary database — production
- **Plan:** Free tier
- **Free tier limits:** 0.5 GB storage, 1 compute unit, 1 project
- **Account:** credentials.env → QuiverDM Production
- **Dashboard:** https://console.neon.tech
- **Notes:** Autosuspend was causing 504s — Vercel cron hits /api/health every 4 min to keep warm

### Upstash Redis
- **Purpose:** BullMQ queue + caching — production
- **Plan:** Free tier
- **Free tier limits:** 10,000 commands/day, 256 MB
- **Account:** credentials.env → QuiverDM Production
- **Dashboard:** https://console.upstash.com
- **Notes:** REDIS_URL in Vercel env + local .env for worker queue sharing

### Cloudflare R2
- **Purpose:** File storage — PDFs, images, audio recordings
- **Plan:** Free tier
- **Free tier limits:** 10 GB storage, 1M Class A ops/mo, 10M Class B ops/mo
- **Account:** Cloudflare account (same as DNS)
- **Dashboard:** https://dash.cloudflare.com → R2
- **Notes:** R2_* env vars. Also hosts DNS for nerdt.au + quiverdm.com zones

### nerdt server (self-hosted)
- **Purpose:** Proxmox homelab — runs MeiliSearch, Docling, Ollama, local dev services
- **Plan:** Hardware (no recurring cost)
- **IP:** 192.168.1.220
- **SSH:** `root@192.168.1.220` (key auth)
- **Notes:** Not production-critical — services can be run elsewhere if needed

---

## Payments & Email

### Stripe
- **Purpose:** Subscription billing — Pro + Team tiers
- **Plan:** Pay-as-you-go (2.9% + 30¢ per transaction)
- **Account:** credentials.env → QuiverDM Production
- **Dashboard:** https://dashboard.stripe.com
- **Notes:** Test mode for dev. Webhook secret in .env. Setup via `npm run setup:stripe`

### Resend
- **Purpose:** Transactional email — welcome, invite, password reset
- **Plan:** Free tier
- **Free tier limits:** 3,000 emails/mo, 100/day
- **Account:** credentials.env → QuiverDM
- **Dashboard:** https://resend.com
- **Notes:** EMAIL_FROM env var. Templates in `src/lib/email.ts`

---

## Authentication

### Google OAuth
- **Purpose:** Social sign-in (Google)
- **Plan:** Free (Google Cloud — OAuth is free)
- **Account:** Google Cloud Console → QuiverDM project
- **Notes:** GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET

### Discord OAuth + Bot
- **Purpose:** Social sign-in (Discord) + feedback forum bot
- **Plan:** Free
- **Account:** https://discord.com/developers/applications → App ID 1438484597850767380
- **Notes:** Bot posts feedback to forum channel 1477550212007592089. Bot token in credentials.env as QUIVERDM_DISCORD_BOT_TOKEN

---

## AI / ML Services

### Anthropic (Claude)
- **Purpose:** Session summaries, feedback triage, QA agents
- **Plan:** Pay-as-you-go
- **Pricing:** claude-sonnet-4-6 — $3/M input tokens, $15/M output tokens
- **Account:** credentials.env → ANTHROPIC_API_KEY
- **Dashboard:** https://console.anthropic.com
- **Notes:** No credits locally — triage worker silently skips. Production uses real key.

### Google Gemini
- **Purpose:** Per-user AI key (free tier option for users) + QA agents (gemini-2.0-flash)
- **Plan:** Pay-as-you-go (server key) + free per-user keys via AI Studio
- **Pricing:** gemini-2.0-flash — $0.075/M input tokens (under 128k)
- **Account:** credentials.env → GEMINI_API_KEY
- **Dashboard:** https://aistudio.google.com / https://console.cloud.google.com
- **Notes:** Users can bring free key (1,000 req/day via AI Studio). QA default model.

### OpenAI
- **Purpose:** AI features fallback provider
- **Plan:** Pay-as-you-go
- **Account:** credentials.env → OPENAI_API_KEY
- **Dashboard:** https://platform.openai.com
- **Notes:** Used as fallback when Anthropic/Gemini unavailable

### AssemblyAI
- **Purpose:** Live session audio transcription
- **Plan:** Pay-as-you-go
- **Pricing:** ~$0.65/hr audio (real-time streaming)
- **Account:** credentials.env → ASSEMBLYAI_API_KEY
- **Dashboard:** https://www.assemblyai.com/app
- **Notes:** Required for live transcription feature. Worker: `npm run worker:transcription`

### Replicate
- **Purpose:** Homebrew image generation
- **Plan:** Pay-as-you-go
- **Pricing:** Varies by model (~$0.0023/image for SDXL)
- **Account:** credentials.env → REPLICATE_API_KEY
- **Dashboard:** https://replicate.com
- **Notes:** Worker: `npm run worker:image`. Self-hosted Ollama/ComfyUI as local alternative.

---

## Search

### MeiliSearch (self-hosted)
- **Purpose:** Full-text search — homebrew, NPCs, sessions
- **Plan:** Free (self-hosted on nerdt server)
- **Port:** 7701 (local), tunnelled via nerdt server in production-like setups
- **Notes:** MEILI_URL + MEILI_MASTER_KEY. Fire-and-forget; Postgres fallback if unavailable.

---

## Dev & QA Tools

### Browserbase
- **Purpose:** Browser automation for QA agents (legacy — being replaced by claude -p + Playwright MCP)
- **Plan:** Free tier
- **Free tier limits:** Check dashboard
- **Account:** credentials.env → BROWSERBASE_API_KEY
- **Dashboard:** https://browserbase.com
- **Notes:** May be removed when QA pipeline migration is complete

### GitHub Actions / gh CLI
- **Purpose:** CI (linting, type checks), QA issue creation
- **Plan:** Free (public repo) / Free tier (private)
- **Account:** DevVentari (gh auth via keyring)
- **Notes:** `gh` CLI authenticated. Repo: DevVentari/QuiverDM-Live

---

## Analytics

### PostHog
- **Purpose:** Product analytics — autocapture (clicks, page views), funnels, session replay, error tracking
- **Plan:** Free tier
- **Free tier limits:** 1M events/mo, 5k session recordings/mo
- **Account:** credentials.env → POSTHOG_EMAIL / POSTHOG_PASSWORD
- **Dashboard:** https://eu.posthog.com/project/134241 (EU region, Project ID: 134241)
- **Env vars:** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com`
- **Notes:** Autocapture enabled. Page views fired manually via PostHogPageView component (App Router). User identification tied to NextAuth session. Error boundary + unhandledrejection capture client errors.

---

## Cost Summary (Production, current)

| Service | Monthly cost |
|---------|-------------|
| Vercel | $0 (Hobby) |
| Neon | $0 (free tier) |
| Upstash Redis | $0 (free tier) |
| Cloudflare R2 | $0 (free tier) |
| Stripe | 2.9% + 30¢ per txn |
| Resend | $0 (free tier) |
| Anthropic | Pay-per-use |
| Gemini | Pay-per-use |
| AssemblyAI | Pay-per-use |
| Replicate | Pay-per-use |
| PostHog | $0 (free tier) |
| **Fixed overhead** | **~$0/mo at current scale** |

> Update this table when any service moves off free tier.
