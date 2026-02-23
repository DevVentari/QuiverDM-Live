# QuiverDM Financial Model

**Date:** 2026-02-23
**Status:** Working model — update assumptions as actuals emerge

---

## Table of Contents

1. [Unit Economics](#1-unit-economics)
2. [Revenue Projections](#2-revenue-projections)
3. [Marketplace Revenue Model (V2)](#3-marketplace-revenue-model-v2)
4. [Funding Needs](#4-funding-needs)
5. [Comparable SaaS Benchmarks](#5-comparable-saas-benchmarks)
6. [Key Financial Risks](#6-key-financial-risks)
7. [Summary Dashboard](#7-summary-dashboard)

---

## 1. Unit Economics

### Infrastructure Assumptions (per month at different scales)

#### Current Stack (Beta: ~0–500 users)

| Service | Config | Monthly Cost |
|---------|--------|-------------|
| **Vercel** (Next.js hosting) | Pro plan | $20 flat |
| **Railway** (Postgres + Redis + workers) | Hobby/Pro | $20–$50 |
| **MeiliSearch** (Railway-hosted) | Shared container | ~$10 |
| **Cloudflare R2** (audio/PDF/image storage) | Pay-as-you-go | $0.015/GB + $0/egress |
| **Docling** (Railway container) | Shared | ~$5 |
| **Total fixed (beta)** | | **~$55–$85/month** |

#### Scale Infrastructure (1,000–10,000 users)

| Service | Config | Monthly Cost |
|---------|--------|-------------|
| **Vercel Pro** | 1 seat, usage included | $20 |
| **Railway Pro** | 2 vCPU / 8GB RAM — Postgres + Redis | $60–$120 |
| **BullMQ workers** (Railway) | 2 worker containers | $40 |
| **MeiliSearch** (Railway) | Dedicated | $30 |
| **Cloudflare R2** | ~500 GB audio + PDFs + images | $7.50 |
| **AssemblyAI** | Variable (see below) | Variable |
| **CDN / bandwidth** | Cloudflare free tier | $0 |
| **Total fixed (scale, ex-AI)** | | **~$160–$220/month** |

#### Scale Infrastructure (10,000+ users / growth)

At this scale, Railway costs scale linearly with compute. Estimated $400–$800/month in infra before AI costs. Vercel Pro suffices to ~100K monthly active users on $20/month. Database may require vertical scaling or read replicas (+$100–$200/month).

---

### Transcription Cost: AssemblyAI

AssemblyAI pricing (2025–2026):
- **Async (pre-recorded):** $0.15/hour ($0.0025/min)
- **Streaming (real-time):** $0.15/hour
- **Speaker diarization add-on:** +$0.02/hour
- **Effective rate with speaker ID:** ~$0.17/hour

> Note: The $0.37/hour figure referenced at project start reflects older pricing or enterprise add-ons. Current base rate is $0.15/hour. Budget $0.20/hour to include speaker diarization and a buffer.

#### Transcription cost by tier:

| Tier | Included Hours | Monthly AI Cost | Notes |
|------|---------------|-----------------|-------|
| **Free** | 0.5 hr/month | $0.10 | 30 min cap; low-cost to serve |
| **Pro** | 10 hr/month | $2.00 | Most users won't hit cap |
| **Team** | 30 hr/month | $6.00 | Heavy usage assumed |

**Actual usage will be significantly lower than caps.** Typical D&D sessions run 3–4 hours but groups play 2–3x/month. Pro users realistically use 6–8 hours/month.

Blended actual transcription cost per Pro user: ~**$1.20–$1.60/month**

---

### AI Inference Cost (Ollama / Cloud LLM)

**Beta (Ollama local, self-hosted):** ~$0 marginal cost — electricity + hardware amortized.

**At scale (cloud inference required):**

| Model tier | Use case | Cost per request | Monthly est. per active user |
|------------|----------|-----------------|------------------------------|
| GPT-4o mini / equivalent | Summary gen, NPC extraction | $0.0002–$0.001 | $0.05–$0.20 |
| Embedding model | Narrative search (vector) | $0.0001/1K tokens | $0.01–$0.05 |
| Rules RAG (Ollama or cloud) | Rules lookup | $0.0001–$0.0005 | $0.02–$0.10 |

**Blended AI inference per active Pro user at scale:** ~**$0.10–$0.35/month**

For 1,000 Pro users: $100–$350/month in cloud inference.

> Key lever: Keep Ollama self-hosted on Railway for as long as possible. An A10G GPU on Railway (~$2/hour, used 8 hrs/day) runs ~$480/month and serves thousands of simultaneous requests. Break-even vs. OpenAI at ~2,000+ daily inference calls.

---

### Storage Cost (Cloudflare R2)

Storage breakdown per user-type:

| Content type | Size estimate | Per Pro user/month |
|--------------|--------------|-------------------|
| Audio recordings (raw) | ~300 MB/session × 2 sessions | ~600 MB |
| PDFs (homebrew) | ~5 MB × 10 PDFs | ~50 MB |
| Generated images | ~2 MB × 20 images | ~40 MB |
| Transcripts (text) | Negligible | ~1 MB |
| **Total per Pro user** | | **~700 MB** |

At $0.015/GB on R2 (no egress fees):

| Users | Storage | R2 Cost/month |
|-------|---------|--------------|
| 100 Pro | 70 GB | $1.05 |
| 500 Pro | 350 GB | $5.25 |
| 2,000 Pro | 1.4 TB | $21.00 |
| 8,000 Pro | 5.6 TB | $84.00 |

Storage is negligible at all realistic scales. R2's zero-egress model is ideal for audio playback.

---

### Cost Per User Summary

| User Type | Infra (shared) | Transcription | AI Inference | Storage | **Total/month** |
|-----------|---------------|---------------|--------------|---------|-----------------|
| **Free** | $0.03 | $0.10 | $0.01 | $0.01 | **~$0.15** |
| **Pro** | $0.10 | $1.50 | $0.25 | $0.11 | **~$1.96** |
| **Team** | $0.15 | $4.50 | $0.40 | $0.25 | **~$5.30** |

> Shared infra cost is allocated across user base. At 1,000 users, $200/month fixed = $0.20/user.

---

### Gross Margin at Scale

| Tier | Price | COGS | **Gross Margin** |
|------|-------|------|-----------------|
| **Free** | $0 | ~$0.15 | N/A (cost center) |
| **Pro** | $15 | ~$1.96 | **$13.04 (87%)** |
| **Team** | $40 | ~$5.30 | **$34.70 (87%)** |

**Target gross margin: 85–90%** — well above the 70–80% SaaS benchmark. The main risk to margin is AI cost growth (transcription, inference) if usage patterns shift toward cap.

---

## 2. Revenue Projections

### Key Assumptions

- **Freemium funnel:** Free tier drives signups; 60–70% of paying users try free first
- **Conversion rate:** 8–12% of active free users convert to Pro over 6 months
- **Pro/Team split:** ~85% Pro, ~15% Team at early stage; Team share grows with word-of-mouth in gaming groups
- **Blended ARPU:** ~$17.50 (weighted 85/15 Pro/Team split)
- **Monthly churn:** 3–5% for prosumer/hobbyist segment (see benchmarks section)
- **Net MRR growth** includes new signups minus churned accounts

### Scenario: Conservative

| Month | Total Users | Paying | MRR (Pro) | MRR (Team) | **Total MRR** |
|-------|------------|--------|-----------|------------|--------------|
| 3 | 200 | 10 (5%) | $135 | $20 | **$155** |
| 6 | 500 | 40 (8%) | $480 | $80 | **$560** |
| 9 | 1,000 | 90 (9%) | $1,080 | $180 | **$1,260** |
| 12 | 2,000 | 200 (10%) | $2,550 | $450 | **$3,000** |
| 18 | 4,000 | 480 (12%) | $6,120 | $1,080 | **$7,200** |
| 24 | 7,000 | 840 (12%) | $10,710 | $1,890 | **$12,600** |

**ARR at Month 12:** ~$36,000
**ARR at Month 24:** ~$151,200

### Scenario: Base

| Month | Total Users | Paying | MRR (Pro) | MRR (Team) | **Total MRR** |
|-------|------------|--------|-----------|------------|--------------|
| 3 | 500 | 40 (8%) | $480 | $80 | **$560** |
| 6 | 2,000 | 200 (10%) | $2,550 | $450 | **$3,000** |
| 9 | 4,500 | 495 (11%) | $6,300 | $1,125 | **$7,425** |
| 12 | 8,000 | 960 (12%) | $12,240 | $2,160 | **$14,400** |
| 18 | 15,000 | 2,100 (14%) | $26,775 | $4,725 | **$31,500** |
| 24 | 25,000 | 3,750 (15%) | $47,813 | $8,438 | **$56,250** |

**ARR at Month 12:** ~$172,800
**ARR at Month 24:** ~$675,000

### Scenario: Optimistic

| Month | Total Users | Paying | MRR (Pro) | MRR (Team) | **Total MRR** |
|-------|------------|--------|-----------|------------|--------------|
| 3 | 1,000 | 100 (10%) | $1,275 | $225 | **$1,500** |
| 6 | 5,000 | 600 (12%) | $7,650 | $1,350 | **$9,000** |
| 9 | 12,000 | 1,680 (14%) | $21,420 | $3,780 | **$25,200** |
| 12 | 20,000 | 3,000 (15%) | $38,250 | $6,750 | **$45,000** |
| 18 | 40,000 | 7,200 (18%) | $91,800 | $16,200 | **$108,000** |
| 24 | 75,000 | 15,000 (20%) | $191,250 | $33,750 | **$225,000** |

**ARR at Month 12:** ~$540,000
**ARR at Month 24:** ~$2,700,000

### Monthly COGS at Scale

| Scenario | MRR (Mo 12) | Total COGS | **Gross Profit** | **Margin** |
|----------|------------|------------|-----------------|------------|
| Conservative | $3,000 | ~$400 | $2,600 | 87% |
| Base | $14,400 | ~$2,100 | $12,300 | 85% |
| Optimistic | $45,000 | ~$6,500 | $38,500 | 86% |

COGS includes: infra ($200–$2,000), transcription ($150–$4,000), AI inference ($50–$500 scaling with Ollama).

---

## 3. Marketplace Revenue Model (V2)

### Concept: Quills Currency Economy

- **Quills** are virtual currency earned through gameplay activity (sessions completed, achievements) and purchasable
- **Marketplace:** homebrew creators list content (adventures, NPC packs, item collections, custom rules modules)
- **V2 (0% platform cut):** Creator-direct listings — drives community adoption, builds inventory before monetization
- **V3 (15% platform cut):** Introduce take rate once marketplace has liquidity (100+ active listings, 1,000+ transactions)

### GMV Estimation (Base Scenario)

**V2 (Months 12–24, 0% cut):**

| Metric | Estimate | Basis |
|--------|---------|-------|
| Active creators listing content | 50–150 | ~1–2% of paying users |
| Average listings per creator | 3–5 | |
| Average listing price (Quills equivalent) | $3–$8 | Comparable: DMs Guild $2–$10 |
| Monthly transactions | 200–800 | |
| **Monthly GMV** | **$1,200–$4,800** | |
| **Platform revenue (0% cut)** | **$0** | Intentional — community building |

**V3 (Month 24+, 15% cut):**

| Metric | Estimate | Basis |
|--------|---------|-------|
| Active creators | 200–500 | Growth from V2 flywheel |
| Monthly transactions | 1,000–5,000 | |
| Average transaction | $5 | |
| **Monthly GMV** | **$5,000–$25,000** | |
| **Platform revenue (15%)** | **$750–$3,750/month** | |

At Base scenario growth, marketplace could add **$9,000–$45,000 ARR** by year 3 (V3 launch).

### Quills Economy Mechanics (Financial Impact)

| Mechanism | Revenue Impact |
|-----------|---------------|
| **Earned Quills (free)** | No direct revenue; drives engagement + retention |
| **Purchased Quills** | If 10% of Pro users buy $5/month in Quills → +$750 MRR at 500 users |
| **Creator payouts** | 85% of transaction goes to creator (V3); reduces platform liability |
| **Quill expiry / breakage** | 5–15% unspent Quills represent pure margin; common in virtual currency models |

### Revenue Mix Projection (Month 30, Base+)

| Source | MRR | % of Total |
|--------|-----|------------|
| Pro subscriptions | $50,000 | 72% |
| Team subscriptions | $9,000 | 13% |
| Marketplace (15% cut) | $5,000 | 7% |
| Quill purchases | $6,000 | 8% |
| **Total** | **$70,000** | 100% |

---

## 4. Funding Needs

### Bootstrap Path to Profitability

**Developer salary assumption:** $120,000/year ($10,000/month) — solo US-based founder/developer. Adjust for geography (50–70% lower in Eastern Europe, India, LATAM).

**Break-even MRR calculation:**

| Cost Category | Monthly |
|---------------|---------|
| Infrastructure (at ~2,000 users) | $300 |
| AssemblyAI (at usage) | $350 |
| AI inference | $150 |
| Vercel Pro | $20 |
| SaaS tools (Stripe, Resend, error monitoring) | $100 |
| **Total COGS + Ops** | **$920** |
| Developer salary | $10,000 |
| **Total burn** | **$10,920** |
| **Break-even MRR** | **~$11,000** |

At $15 ARPU (Pro-weighted), break-even requires **~730 paying users**.

At 10% conversion, that means **~7,300 registered users** to reach break-even as a solo bootstrapped product.

**Timeline to break-even by scenario:**

| Scenario | Break-even month | MRR at break-even |
|----------|-----------------|-------------------|
| Conservative | Month 24–30 | $11,000 |
| Base | Month 14–16 | $14,400 |
| Optimistic | Month 8–10 | $9,000+ |

### Pre-Seed / Self-Fund Runway

**Without any external funding**, a founder with $50K–$100K in savings can:
- Run beta for 12–18 months at ~$1,000–$3,000/month infra cost
- Validate product-market fit before needing revenue
- Reach Base scenario MRR ($14K+) before needing outside capital

**Bootstrap runway at $3,000/month burn:**
- $50K → 16 months
- $100K → 33 months

### Seed Round: $250K Scenario

**Allocation:**

| Category | Amount | Notes |
|----------|--------|-------|
| Developer salary (2 years) | $180,000 | 1.5 FTE equivalent |
| Infrastructure | $24,000 | $1,000/month × 24 months |
| Marketing (content, community) | $20,000 | $833/month |
| Legal, accounting, tools | $10,000 | Formation, SaaS subscriptions |
| Buffer | $16,000 | ~2 months contingency |
| **Total** | **$250,000** | |

**Runway:** ~20–22 months
**Goal:** Reach Base scenario ($14K MRR) by month 14; become default-alive before runway ends.

### Seed Round: $500K Scenario

**Allocation:**

| Category | Amount | Notes |
|----------|--------|-------|
| Engineering (1 FTE + contractor) | $240,000 | Year 1: founder + $60K contractor |
| Infrastructure | $48,000 | $2,000/month × 24 months |
| Marketing / community / content | $80,000 | ~$3,300/month aggressive push |
| Product/design (part-time) | $60,000 | $2,500/month |
| Legal, accounting, misc | $20,000 | |
| Buffer | $52,000 | ~3 months |
| **Total** | **$500,000** | |

**Runway:** ~24 months at higher burn ($18–$20K/month)
**Goal:** Reach Optimistic scenario ($45K MRR) by month 12; raise Series A or become profitable.

### Break-Even Summary Table

| Scenario | Paying Users Needed | MRR at BE | Timeline |
|----------|--------------------|-----------|---------:|
| Solo, no salary | 65 | $975 | Month 4–6 |
| Solo + salary ($10K/mo) | 730 | $10,950 | Month 14–24 |
| Small team ($20K/mo burn) | 1,400 | $21,000 | Month 18–30 |

---

## 5. Comparable SaaS Benchmarks

### TTRPG / VTT Market Context

| Platform | Users | Revenue Model | Notes |
|----------|-------|--------------|-------|
| **Roll20** | 10M+ accounts (~1–2M active) | Freemium + $5.99/$9.99/mo | Acquired by OneBookShelf 2022 |
| **Foundry VTT** | ~300K licenses | One-time purchase ($50) | No subscription; marketplace revenue |
| **D&D Beyond** | 13M+ accounts | Freemium + content purchases | Acquired by Hasbro/WotC 2022 |
| **Shard Tabletop** | Unknown | Subscription | Smaller competitor |
| **StartPlaying** | ~100K GMs | Marketplace (15–20% cut) | GM-for-hire marketplace |

**Market size:** TTRPG market projected $2.4B (2026) → $6.6B (2035), 11.84% CAGR. Digital tooling captures an estimated 15–25% of total market spend.

**QuiverDM's addressable audience:** DMs/GMs who run campaigns (estimated 5–10M globally); session management tools target the active DM subset (~2–4M power users who would pay for AI tooling).

### CAC Benchmarks for Gaming/Hobbyist SaaS

| Channel | Estimated CAC | Notes |
|---------|--------------|-------|
| Organic / SEO | $0–$5 | Long-term; D&D session management has low competition |
| Reddit / Discord community | $2–$15 | r/DMAcademy, r/DnD, Discord servers |
| YouTube creator partnerships | $10–$30 | DM-focused channels (e.g., Matt Colville, MCDM) |
| Paid social (Meta/TikTok) | $20–$60 | Hobbyist targeting; lower intent |
| Content marketing (blog/SEO) | $5–$20 | 3–6 month lag; compounding returns |
| **Blended CAC (realistic)** | **$10–$25** | Primarily organic + community |

**Hobbyist SaaS CAC** tends to be low because:
1. Passionate communities actively discuss tools in Discord, Reddit, forums
2. Word-of-mouth from gaming groups (one DM converts 4–5 players)
3. Content creation around D&D has massive organic reach

### LTV Estimates

| Tier | ARPU/month | Avg. Churn | Avg. LTV |
|------|-----------|-----------|---------|
| **Pro** | $15 | 4%/month | $375 |
| **Team** | $40 | 3%/month | $1,333 |
| **Blended** | ~$17.50 | 3.5%/month | **$500** |

> LTV formula: ARPU / monthly churn rate

At CAC of $15, **LTV:CAC = 33:1** (Pro), **89:1** (Team) — exceptional unit economics for a bootstrapped product.

Even at higher CAC of $30 with conservative LTV, **LTV:CAC = 12.5:1** — well above the 3:1 benchmark.

### Churn Rate Analysis

Hobbyist gaming SaaS sits between consumer (6–8%) and prosumer (3–5%). QuiverDM's structural advantages for retention:
- **Campaign lock-in:** Users store sessions, transcripts, NPCs, homebrews — high switching cost
- **Group network effect:** One DM subscribing brings in their whole group's data
- **Completionist psychology:** Hobbyists hate incomplete archives; they'll renew to keep records

**Target churn: 3–4%/month** (prosumer level). At 3%, median LTV is ~33 months.

### Gross Margin Benchmarks

| Company type | Gross Margin |
|-------------|-------------|
| Best-in-class SaaS | 75–85% |
| AI-native SaaS (high inference cost) | 60–75% |
| **QuiverDM estimate** | **85–90%** |

QuiverDM's high margin comes from: AI via Ollama (near-zero marginal), low storage costs (R2), transcription caps limiting worst-case usage.

---

## 6. Key Financial Risks

### Risk 1: AI Cost Scaling (HIGH)

**Risk:** Transcription costs scale linearly with usage. If Pro users consistently use 8–10 hours/month (vs assumed 5–7), COGS rises 20–40%.

**Quantified impact at 2,000 Pro users:**
- Assumed: $1.50/user × 2,000 = $3,000/month transcription
- Heavy usage: $2.50/user × 2,000 = $5,000/month (60% increase)
- Gross margin impact: 85% → 80%

**Mitigations:**
- Enforce hard monthly caps (already implemented in product)
- Optimize: transcribe only when explicitly triggered (not auto)
- Negotiate volume discounts with AssemblyAI at >$1,000/month spend
- Route shorter clips through cheaper Whisper self-hosted model

### Risk 2: Free Tier Abuse (MEDIUM)

**Risk:** Free tier (30 min/month) costs $0.10/user in transcription alone. At 10,000 free users, that's $1,000/month in non-revenue-generating cost.

**Quantified impact:** 10,000 free users × $0.15 COGS = $1,500/month pure cost.

**Mitigations:**
- Rate limit at IP + email level; require email verification before transcription
- Consider requiring credit card on file for free tier (reduces abuse, hurts conversion)
- Optimize free tier to only process completed uploads (not live streaming)
- Feature-gate: live transcription (streaming, more expensive) behind Pro only

### Risk 3: D&D Beyond / WotC Adding Transcription (MEDIUM-HIGH)

**Risk:** Hasbro/WotC has incentive and resources to add session management features to D&D Beyond (13M+ users). If they ship AI transcription, it would commoditize the core QuiverDM value proposition.

**Timeline estimate:** 12–24 months (Hasbro has moved slowly with D&D Beyond since acquisition; prioritized character sheets and content sales).

**Mitigations:**
- Move beyond transcription: AI summaries, NPC continuity tracking, encounter builder, player portals — these require deeper game-state integration WotC won't prioritize
- Focus on system-agnostic support (Pathfinder, CoC, Blades in the Dark) — WotC only builds for D&D 5e/2024
- Build community/marketplace moat before WotC can react
- Pursue acquisition as upside scenario (WotC paid ~$146M for D&D Beyond)

### Risk 4: Churn Exceeds Projections (MEDIUM)

**Risk:** If monthly churn hits 6–8% (consumer-app level vs prosumer 3–4%), LTV collapses from $375 to $188–$250 per Pro user.

**Impact:** At 6% churn, LTV:CAC ratio drops from 33:1 to 10:1 — still healthy but growth efficiency degrades significantly.

**Mitigations:**
- Prioritize onboarding: get users to their first session transcript within 24 hours of signup
- Group viral loop: DMs invite players; players become invested in the data
- Annual plan discount (e.g., $120/year Pro = 33% discount) reduces churn by locking in revenue

### Risk 5: Slow Growth / No Virality (MEDIUM)

**Risk:** Conservative scenario ($3K MRR at Month 12) requires 5+ years to reach $100K MRR without funding. Without a viral growth mechanism, growth stays linear.

**Mitigations:**
- Built-in virality: player portal invite links (each DM sends link to 3–5 players)
- Session share links (public campaign summaries drive SEO and word-of-mouth)
- Creator marketplace (V2) incentivizes homebrew authors to market their own content on the platform
- Webhook/iCal integrations increase stickiness and public discovery

### Risk 6: Regulatory / Data Privacy (LOW-MEDIUM)

**Risk:** Audio recordings of real people (gaming sessions) may trigger GDPR Article 9 (biometric data) or CCPA concerns if sessions include identifiable speech.

**Mitigations:**
- Store audio with explicit user consent at upload time
- Implement right-to-erasure (already standard with tRPC/Prisma architecture)
- Terms of Service: data is user-owned; QuiverDM processes for user's stated purpose
- Consider EU data residency option at scale (Hetzner/Fly.io European regions)

---

## 7. Summary Dashboard

### One-Year Financial Summary (Base Scenario)

| Metric | Month 6 | Month 12 |
|--------|---------|---------|
| Total users | 2,000 | 8,000 |
| Paying users | 200 | 960 |
| MRR | $3,000 | $14,400 |
| COGS | $450 | $2,100 |
| Gross Profit | $2,550 | $12,300 |
| Gross Margin | 85% | 85% |
| Infra cost | $250 | $600 |
| Transcription cost | $175 | $1,350 |
| AI inference cost | $25 | $150 |

### Key Milestones

| Milestone | MRR | Paying Users | Scenario |
|-----------|-----|-------------|---------|
| Cover infra costs | $300 | 20 | Month 1–2, all scenarios |
| Cover founder salary | $10,950 | 730 | Month 14 (Base) |
| $100K ARR | $8,333 | 555 | Month 10 (Base) |
| Default-alive (profitable) | $11,000+ | 733+ | Month 14–16 (Base) |
| $1M ARR | $83,333 | 5,555 | Month 22–24 (Base) |

### Investor Metrics (Series A readiness)

For a credible Series A at $3–5M:
- Target: $50K–$100K MRR with 20%+ month-over-month growth
- Show: <4% monthly churn, improving LTV:CAC
- Timeline: Month 18–24 under Base scenario, Month 12–14 under Optimistic

---

## Sources and Data References

- [AssemblyAI Pricing](https://www.assemblyai.com/pricing) — $0.15/hour async, $0.17/hour with speaker diarization
- [AssemblyAI Pricing Breakdown (Brass Transcripts)](https://brasstranscripts.com/blog/assemblyai-pricing-per-minute-2025-real-costs)
- [Railway Pricing](https://railway.com/pricing) — $5 Hobby / Pro with $20 usage credit; compute at $20/vCPU + $10/GB RAM/month
- [Vercel Pricing](https://vercel.com/pricing) — Pro at $20/month; 1TB bandwidth included
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) — $0.015/GB, zero egress fees
- [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/) — $0.023/GB Standard (comparison baseline)
- [TTRPG Market Size 2026–2035](https://www.globalgrowthinsights.com/market-reports/tabletop-role-playing-game-ttrpg-market-103239) — $2.4B→$6.6B, 11.84% CAGR
- [SaaS Churn Rate Benchmarks 2024](https://usermotion.com/saas-churn-rate-benchmark-2024) — 3–5% prosumer, 6–8% consumer
- [B2B SaaS Benchmarks 2025](https://www.saas-capital.com/blog-posts/benchmarking-metrics-for-bootstrapped-saas-companies/) — Revenue per employee, growth rates
- [Bootstrapped SaaS Micro-SaaS Analysis 2025](https://www.rockingweb.com.au/micro-saas-revenue-analysis-2025/) — Median $15K MRR, 85% margins
- [LTV:CAC Ratio Benchmarks](https://firstpagesage.com/seo-roi/the-saas-ltv-to-cac-ratio-fc/) — 3:1–5:1 healthy; 3.6:1 median 2024
- [Startup Burn Rate and Runway](https://finmark.com/how-much-runway-should-startups-have/) — 24–30 months target runway
- [Ollama Pricing 2026](https://ollama.com/pricing) — Cloud Pro $20/month; local deployment free
- [LLM API Pricing Comparison 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025) — GPT-4o mini at $0.15/$0.60 per M tokens
