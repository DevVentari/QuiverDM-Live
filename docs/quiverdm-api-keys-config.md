# QuiverDM - API Keys & Services Configuration

## 🔑 Complete API Keys Required

### MVP Required Services (Launch Critical)

#### 1. **OpenAI API**
- **Purpose**: Whisper transcription, GPT-4 for content extraction
- **Keys Needed**: 
  ```env
  OPENAI_API_KEY=sk-...
  OPENAI_ORG_ID=org-... (optional)
  ```
- **Pricing**: 
  - Whisper: $0.006/minute (~$1.08 for 3-hour session)
  - GPT-4: $0.03/1K tokens input, $0.06/1K output
- **Monthly Estimate**: $100-200 for 100 users
- **Setup**: https://platform.openai.com/api-keys
- **Rate Limits**: 500 RPM (requests per minute) for tier 1

#### 2. **Anthropic Claude API**
- **Purpose**: High-quality summaries, content understanding
- **Keys Needed**:
  ```env
  ANTHROPIC_API_KEY=sk-ant-...
  ```
- **Pricing**: 
  - Claude 3 Sonnet: $3/1M input tokens, $15/1M output tokens
  - ~$0.20 per session summary
- **Monthly Estimate**: $50-100 for 100 users
- **Setup**: https://console.anthropic.com/
- **Rate Limits**: 1000 RPM default

#### 3. **Supabase (Database + Auth)**
- **Purpose**: PostgreSQL hosting, user authentication, real-time subscriptions
- **Keys Needed**:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
  ```
- **Pricing**: 
  - Free tier: 500MB database, 2GB storage, 50K auth users
  - Pro: $25/month for 8GB database, 100GB storage
- **Setup**: https://app.supabase.com/
- **Features Used**: Auth, Database, Storage, Realtime

#### 4. **Cloudflare R2 (Object Storage)**
- **Purpose**: Store audio/video files, PDFs, generated content
- **Keys Needed**:
  ```env
  R2_ACCOUNT_ID=...
  R2_ACCESS_KEY_ID=...
  R2_SECRET_ACCESS_KEY=...
  R2_BUCKET_NAME=quiverdm-media
  R2_PUBLIC_URL=https://media.quiverdm.com (after custom domain setup)
  ```
- **Pricing**: 
  - Storage: $0.015/GB/month
  - Operations: $0.36/million requests
  - NO egress fees (huge savings)
- **Monthly Estimate**: $5-10 for 100 users
- **Setup**: https://dash.cloudflare.com/ → R2

#### 5. **NextAuth Configuration**
- **Purpose**: Authentication system
- **Keys Needed**:
  ```env
  NEXTAUTH_URL=http://localhost:3000 (prod: https://quiverdm.com)
  NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
  
  # Google OAuth
  GOOGLE_CLIENT_ID=...
  GOOGLE_CLIENT_SECRET=...
  
  # Discord OAuth  
  DISCORD_CLIENT_ID=...
  DISCORD_CLIENT_SECRET=...
  
  # Email (using Resend)
  EMAIL_SERVER_USER=apikey
  EMAIL_SERVER_PASSWORD=re_...
  EMAIL_SERVER_HOST=smtp.resend.com
  EMAIL_SERVER_PORT=587
  EMAIL_FROM=noreply@quiverdm.com
  ```
- **Setup Google**: https://console.cloud.google.com/apis/credentials
- **Setup Discord**: https://discord.com/developers/applications

#### 6. **Upstash (Redis + Queue)**
- **Purpose**: Job queues, caching, rate limiting
- **Keys Needed**:
  ```env
  UPSTASH_REDIS_REST_URL=https://...upstash.io
  UPSTASH_REDIS_REST_TOKEN=...
  QSTASH_TOKEN=... (for scheduled jobs)
  QSTASH_CURRENT_SIGNING_KEY=...
  QSTASH_NEXT_SIGNING_KEY=...
  ```
- **Pricing**: 
  - Free tier: 10K commands/day
  - Pay-as-you-go: $0.20/100K commands
- **Monthly Estimate**: $10-20
- **Setup**: https://console.upstash.com/

#### 7. **MeiliSearch (Search Engine)**
- **Purpose**: Fast, typo-tolerant search across all content
- **Keys Needed**:
  ```env
  MEILISEARCH_HOST=https://ms-...meilisearch.io
  MEILISEARCH_MASTER_KEY=...
  MEILISEARCH_SEARCH_KEY=... (public, for frontend)
  MEILISEARCH_ADMIN_KEY=... (private, for indexing)
  ```
- **Pricing**: 
  - Cloud: $29/month for starter
  - Self-hosted: Free (recommended for MVP)
- **Setup**: https://cloud.meilisearch.com/ or self-host
- **Alternative**: Use PostgreSQL full-text search for MVP

#### 8. **Vercel (Hosting)**
- **Purpose**: Next.js hosting, serverless functions, analytics
- **Keys Needed**:
  ```env
  VERCEL_URL=... (auto-set)
  VERCEL_ENV=... (auto-set)
  VERCEL_GIT_COMMIT_SHA=... (auto-set)
  ```
- **Pricing**: 
  - Hobby: Free
  - Pro: $20/month (needed for commercial use)
- **Setup**: Connect GitHub repo to Vercel
- **Domain**: Configure in Vercel dashboard

#### 9. **Sentry (Error Tracking)**
- **Purpose**: Error monitoring, performance tracking
- **Keys Needed**:
  ```env
  SENTRY_DSN=https://...@...sentry.io/...
  NEXT_PUBLIC_SENTRY_DSN=https://...@...sentry.io/...
  SENTRY_ORG=quiverdm
  SENTRY_PROJECT=quiverdm-web
  SENTRY_AUTH_TOKEN=... (for source maps)
  ```
- **Pricing**: 
  - Free: 5K errors/month
  - Team: $26/month for 50K errors
- **Setup**: https://sentry.io/

#### 10. **PostHog (Analytics)**
- **Purpose**: User behavior analytics, feature flags
- **Keys Needed**:
  ```env
  NEXT_PUBLIC_POSTHOG_KEY=phc_...
  NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
  ```
- **Pricing**: 
  - Free: 1M events/month
  - Paid: $0.00031/event after
- **Setup**: https://posthog.com/

---

### Phase 2 Services (Live Features - Months 4-6)

#### 11. **Deepgram (Alternative Transcription)**
- **Purpose**: Real-time streaming transcription
- **Keys Needed**:
  ```env
  DEEPGRAM_API_KEY=...
  ```
- **Pricing**: $0.0059/minute for streaming
- **Better for**: Real-time transcription with lower latency
- **Setup**: https://console.deepgram.com/

#### 12. **Daily.co (WebRTC)**
- **Purpose**: Real-time audio streaming for live sessions
- **Keys Needed**:
  ```env
  DAILY_API_KEY=...
  DAILY_DOMAIN=https://quiverdm.daily.co
  ```
- **Pricing**: 
  - Free: 10K participant minutes
  - Scale: $0.004/participant minute
- **Setup**: https://dashboard.daily.co/

#### 13. **Pinecone (Vector Database)**
- **Purpose**: Semantic search, AI memory
- **Keys Needed**:
  ```env
  PINECONE_API_KEY=...
  PINECONE_ENVIRONMENT=us-west1-gcp
  PINECONE_INDEX_NAME=quiverdm-campaigns
  ```
- **Pricing**: 
  - Free: 1 index, 100K vectors
  - Standard: $70/month
- **Setup**: https://app.pinecone.io/

#### 14. **Replicate (Local AI Models)**
- **Purpose**: Run open-source models (Whisper, Llama)
- **Keys Needed**:
  ```env
  REPLICATE_API_TOKEN=r8_...
  ```
- **Pricing**: Pay per second of compute
- **Use Case**: Privacy-conscious users, local processing
- **Setup**: https://replicate.com/

---

### Phase 3 Services (Platform Features - Months 7-12)

#### 15. **Stripe (Payments)**
- **Purpose**: Subscriptions, marketplace payments
- **Keys Needed**:
  ```env
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_PUBLISHABLE_KEY=pk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_PRICE_ID_DM=price_...
  STRIPE_PRICE_ID_PARTY=price_...
  ```
- **Pricing**: 2.9% + $0.30 per transaction
- **Setup**: https://dashboard.stripe.com/

#### 16. **Discord API (Bot)**
- **Purpose**: Discord bot for summaries, notifications
- **Keys Needed**:
  ```env
  DISCORD_BOT_TOKEN=...
  DISCORD_APPLICATION_ID=...
  DISCORD_PUBLIC_KEY=...
  DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
  ```
- **Setup**: https://discord.com/developers/applications

#### 17. **D&D Beyond (Integration)**
- **Purpose**: Character import, content sync
- **Keys Needed**:
  ```env
  DDB_CLIENT_ID=... (when available)
  DDB_CLIENT_SECRET=... (when available)
  ```
- **Status**: No public API yet, use web scraping carefully
- **Alternative**: Manual import via JSON export

#### 18. **AWS Services (Scale)**
- **Purpose**: Transcription, text-to-speech, additional storage
- **Keys Needed**:
  ```env
  AWS_ACCESS_KEY_ID=...
  AWS_SECRET_ACCESS_KEY=...
  AWS_REGION=us-east-1
  AWS_S3_BUCKET=quiverdm-backups
  ```
- **Services**: Transcribe, Polly, S3
- **When Needed**: Only at scale (10K+ users)

---

## 🔧 Development & Testing Services

#### Local Development
```env
# Development overrides
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quiverdm
REDIS_URL=redis://localhost:6379
```

#### Testing Services
- **Mailtrap** (Email testing): https://mailtrap.io/
  ```env
  EMAIL_SERVER_HOST=smtp.mailtrap.io
  EMAIL_SERVER_PORT=2525
  EMAIL_SERVER_USER=...
  EMAIL_SERVER_PASSWORD=...
  ```

- **ngrok** (Webhook testing): https://ngrok.com/
  ```bash
  ngrok http 3000
  ```

---

## 📊 Service Priority & Cost Summary

### MVP Monthly Costs (First 3 Months)
```
Essential Services:
- OpenAI API:        $100-200
- Anthropic Claude:  $50-100  
- Supabase:         $25
- Cloudflare R2:    $10
- Vercel:           $20
- Upstash:          $10
- Sentry:           $0 (free tier)
- PostHog:          $0 (free tier)
----------------------
Total:              $215-365/month
```

### Scaling Costs (100-1000 users)
```
Per 100 active users:
- Transcription:    $100-200
- AI Summaries:     $50-100
- Storage:          $10-20
- Database:         $25-50
- Hosting:          $20-100
----------------------
Total:              $205-470 per 100 users
```

---

## 🚀 Setup Checklist

### Day 1 - Essential Services
- [ ] Create Supabase project
- [ ] Set up Cloudflare R2 bucket
- [ ] Get OpenAI API key
- [ ] Get Anthropic Claude key
- [ ] Configure Google OAuth
- [ ] Set up Vercel project

### Day 2 - Supporting Services  
- [ ] Configure Upstash Redis
- [ ] Set up Sentry error tracking
- [ ] Install PostHog analytics
- [ ] Configure email service (Resend)
- [ ] Set up MeiliSearch (or use Postgres FTS)

### Week 1 - Complete Setup
- [ ] Discord OAuth (optional)
- [ ] Development email testing
- [ ] Local Redis/Postgres via Docker
- [ ] Environment variables documented
- [ ] Secrets in Vercel dashboard

---

## 🔐 Security Best Practices

1. **Never commit API keys to git**
   ```bash
   # .gitignore
   .env
   .env.local
   .env.production
   ```

2. **Use different keys for environments**
   - Development: Test keys with limits
   - Staging: Production-like but monitored
   - Production: Real keys with alerts

3. **Rotate keys regularly**
   - Set calendar reminders every 90 days
   - Keep old keys for 30 days during transition

4. **Monitor usage**
   - Set up billing alerts for all services
   - Use rate limiting on expensive APIs
   - Log all API calls for audit

5. **Secure storage**
   - Production keys only in Vercel/hosting environment
   - Use secret management service for team access
   - Document which keys are where

---

## 📝 Environment File Template

Save as `.env.local` for development:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quiverdm

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=development-secret-change-in-production

# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI Services
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=quiverdm-media-dev

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Redis Queue
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Search (optional for MVP)
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_MASTER_KEY=masterKey

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=
SENTRY_DSN=

# Email (optional)
EMAIL_FROM=noreply@localhost
EMAIL_SERVER_HOST=localhost
EMAIL_SERVER_PORT=1025
```

---

*Remember: Start with the minimum required services for MVP. Add others as features demand them. Most services have generous free tiers perfect for launch.*
