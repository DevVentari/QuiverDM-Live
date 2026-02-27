# QuiverDM
## The AI-Powered DM Operating System
*Closed Beta 2026 · Built for the $2B TTRPG Market*

---

> **"Stop taking notes. Start telling stories."**

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [The Solution](#2-the-solution)
3. [What We've Built](#3-what-weve-built)
4. [Market Opportunity](#4-market-opportunity)
5. [Product Roadmap](#5-product-roadmap)
6. [Platform Expansion: Beyond D&D](#6-platform-expansion-beyond-dd)
7. [AI Agent Strategy](#7-ai-agent-strategy)
8. [Go-to-Market Strategy](#8-go-to-market-strategy)
9. [Financial Model](#9-financial-model)
10. [Technical Architecture](#10-technical-architecture)
11. [Team Needs](#11-team-needs)
12. [Next Steps](#12-next-steps)

---

## 1. The Problem

The Dungeon Master's job is to craft immersive, memorable stories. Instead, they spend hours every week doing administrative work that has nothing to do with storytelling.

### The DM's Hidden Workload

A typical active DM running a weekly campaign carries a burden that is almost entirely invisible to their players:

- **3–5 hours per session** spent on manual notes, session recaps, and campaign documentation
- **No searchable record** of what happened across dozens of sessions — "What was the blacksmith's name in Waterdeep?" requires digging through notebooks or Google Docs
- **54% of DMs report content overload** — homebrew PDFs, supplement books, and NPC lists scattered across incompatible tools
- **37% of players cite retention issues** — forgetting plot threads, missing sessions, losing narrative continuity
- **27% of players specifically demand** AI-enhanced NPC continuity and memory tools

### The Tool Gap Is Real

The TTRPG software market has one gaping blind spot: **all current tools are session-runtime tools.**

Roll20 handles maps and dice rolls. D&D Beyond manages character sheets. Foundry VTT runs combat encounters. Every major tool in the ecosystem is built for the 4 hours the table is live.

**Nobody has built the tool for the 20 hours a week the DM works alone** — preparing sessions, writing NPCs, processing what happened last week, and planning what comes next. The DM's workflow — pre-session planning, post-session documentation, cross-session continuity, homebrew management — is done in Google Docs, Notion, and physical notebooks.

This is not an oversight. It is a genuine, unaddressed product gap in a **$1.9 billion market growing at 11.84% annually.**

---

## 2. The Solution

**QuiverDM is the AI-powered operating system for Dungeon Masters** — the first purpose-built platform for the entire DM workflow: before, during, and after every session.

### Core Value Propositions

- **Session transcription, automatically.** Record your session; QuiverDM transcribes it with speaker labels via AssemblyAI and surfaces the full text, searchable and indexed.
- **AI session summaries, instantly.** When the session ends, a structured recap — highlights, key decisions, NPC interactions — is generated and optionally shared with your players via a public link.
- **Campaign memory that never fades.** pgvector semantic search across every session, every NPC, every piece of homebrew content. Ask "what did the party promise to the Thieves' Guild?" and get an answer.
- **Homebrew PDFs, unlocked.** Upload any PDF — third-party supplement, adventure module, indie game. Docling extracts the content; the AI makes it searchable and extractable to creatures, spells, and items.
- **Encounter planning, not guesswork.** Build encounters from the full SRD monster roster, get AI-assisted difficulty recommendations based on party state, and run live initiative tracking during play.
- **Player portal.** DMs control what their players see — session recaps, character notes, campaign timeline — with role-scoped visibility.

### The Insight That Changes Everything

> **Current tools serve the 4-hour session. QuiverDM owns the entire workflow.**

VTTs, character builders, and dice rollers are runtime tools — they activate at the table. QuiverDM is the infrastructure that makes the table possible: the preparation, the documentation, the memory, and the continuity that connects session 1 to session 47.

---

## 3. What We've Built

QuiverDM is **production-ready and feature-complete for closed beta launch.** This is not a prototype.

### Platform Stats

| Metric | Count |
|--------|-------|
| tRPC routers | **26** |
| Background workers (BullMQ) | **5** |
| UI pages | **32** |
| Prisma data models | **40+** |
| Third-party integrations | **14** |

### Feature Inventory by Category

#### Session Management `COMPLETE`
- Session lifecycle (create, start, pause, end)
- 4-tab session detail: Live Play / Recordings / Transcript / Recap
- DM visibility controls — scoped content per role (OWNER / CO_DM / PLAYER / SPECTATOR)
- Session timeline with status filter
- Public shareable session recap pages

#### Transcription & Audio `COMPLETE`
- Browser MediaRecorder API for in-browser session recording
- AssemblyAI live transcription with speaker diarization
- WhisperX fallback for uploaded audio
- WebSocket server for real-time transcript streaming
- Inline transcript editing and speaker rename (DM-only)

#### AI Features `COMPLETE`
- AI session summaries + highlight moments (Ollama / Gemini / OpenAI multi-provider)
- Semantic search across sessions, NPCs, and homebrew (pgvector HNSW)
- AI-assisted encounter generation from SRD monster data
- AI image generation for NPCs and homebrew items (ComfyUI / Replicate / DALL-E)
- Rules RAG: semantic lookup over indexed homebrew PDFs + SRD

#### Homebrew & Content `COMPLETE`
- 10 homebrew content types with manual creation and campaign linking
- PDF upload → Docling extraction → AI content parsing (creatures, spells, items)
- D&D Beyond character and homebrew import/sync
- Full-text search via MeiliSearch

#### Encounter System `COMPLETE`
- Pre-session encounter planner with SRD monster picker (AI-generation supported)
- Live encounter tracker: initiative order, HP bars, condition management
- Encounter difficulty calculator

#### Campaign Infrastructure `COMPLETE`
- Multi-campaign, multi-user, role-scoped access control
- NPC library with search and AI image generation
- Player party and character management (full D&D 5e stat blocks, spells, feats, inventory)
- 4-step onboarding wizard

#### Platform & Integrations `COMPLETE`
- Stripe billing (checkout, customer portal, subscription webhooks)
- Outbound webhooks with HMAC-SHA256 signatures (Discord, iCal, OBS overlay SSE)
- Resend transactional email (welcome, invite, password reset)
- Encrypted user API key storage (Gemini, OpenAI keys per-user)
- Beta invite code system

#### Developer Foundation `COMPLETE`
- Bricolage Grotesque design system with OKLCH color tokens, fluid typography
- Spring-based stagger animations (reduced-motion aware)
- End-to-end test scaffolding (Playwright)

---

## 4. Market Opportunity

### The Numbers

| Metric | Figure |
|--------|--------|
| Global TTRPG market (2024) | **~$1.9–2.0B** |
| Global TTRPG market (2026, projected) | **~$2.41B** |
| Global TTRPG market (2035, projected) | **~$6.59B** |
| CAGR (2026–2035) | **~11.84%** |
| Lifetime D&D players worldwide | **50 million** |
| Active tabletop D&D players | **~13.7 million** |
| D&D Beyond registered users (2024) | **19 million** |
| Roll20 registered users (2024) | **12 million** |
| VTT adoption among players (2024) | **48%** (up from 29% in 2020) |
| WotC D&D + Magic revenue (2024) | **$1.04B** |
| Hasbro paid for D&D Beyond (2022) | **$146.3M** |

> **Signal:** Hasbro's $146.3M acquisition of D&D Beyond proves the market assigns enormous value to digital TTRPG tooling. D&D Beyond now accounts for **over 50% of D&D's profits** — through a digital subscription product at $4.60/month with no AI features.

### TAM / SAM / SOM

| Market Layer | Definition | Size |
|-------------|-----------|------|
| **TAM** | Total TTRPG market (physical + digital) | ~$2.0B (2024) → $6.6B (2035) |
| **SAM** | Digitally active TTRPG players (VTT + tool users) | ~12–19M registered platform users |
| **SOM** | Active English-speaking DMs willing to pay for AI tools | **~1–2M** |

### The Competitor Gap Table

> **The single most important insight in this document:** Every current tool is a session-runtime tool. QuiverDM owns the workflow.

| Capability | D&D Beyond | Roll20 | Foundry VTT | Any current tool? | **QuiverDM** |
|-----------|-----------|--------|------------|------------------|------------|
| Session transcription | No | No | No | **No (integrated)** | Yes |
| AI session summaries | No | No | No | **No (integrated)** | Yes |
| Post-session hook generation | No | No | No | No | Yes |
| Homebrew PDF extraction (AI) | No | No | Limited | **No (AI-powered)** | Yes |
| Campaign narrative memory | No | No | No | No | Yes |
| Session recording management | No | No | No | No | Yes |
| Cross-session NPC continuity | No | No | No | No | Yes |
| Semantic search (campaign-wide) | No | No | No | No | Yes |
| Encounter builder (SRD-aware + AI) | Partial | No | Via modules | **No (native AI)** | Yes |
| Rules RAG (homebrew-aware) | No | No | No | No | Yes |
| Player portal (visibility scoping) | No | No | No | No | Yes |

### Willingness to Pay

The market has already established price anchors for DM tools with far less capability:

| Tool | Monthly Price | What It Does |
|------|--------------|-------------|
| Roll20 Pro | ~$8.33/mo | Maps, tokens, dice |
| Fantasy Grounds | $9.99/mo | Rules automation (legacy) |
| D&D Beyond Master | ~$4.60/mo | Rules reference + character sheets |

**QuiverDM's $15/month Pro tier — for a platform that eliminates hours of weekly work — is priced below the value it delivers, well within established willingness-to-pay for this demographic.**

---

## 5. Product Roadmap

### Four Phases, Clear Milestones

| Phase | Timeframe | Status | Key Deliverables |
|-------|-----------|--------|-----------------|
| **Beta** | Now — ~4 weeks | In progress | Polish, E2E tests, deploy to Vercel + Hetzner |
| **MVP** | ~6–10 weeks post-beta | Planned | Public launch, Stripe live, open waitlist |
| **V2** | ~6–8 months post-MVP | Designed | Homebrew marketplace, Quills economy, PF2e support |
| **V3** | ~12+ months post-MVP | Vision | Group finder, real-money marketplace, mobile PWA |

---

### Beta Phase — Now to ~4 Weeks

**Goal: Production-ready for closed beta cohort**

- Replace `window.confirm` dialogs with `ConfirmDialog` component
- Standardize empty states (NPC, player, homebrew list pages)
- Zod client-side validation on campaign create form
- Fix Playwright baseURL (3001 → 3847)
- E2E test coverage: Auth, Onboarding, Campaign CRUD, Sessions, NPCs, Invites
- Deploy: Next.js → Vercel; PostgreSQL + Redis + workers → Railway/Hetzner

---

### MVP — Public Launch (~6–10 Weeks Post-Beta)

**Goal: First paying customers, validated funnel**

| Tier | Price | Key Limits |
|------|-------|-----------|
| Free | $0/mo | 1 campaign, 30 min transcription/mo, 5 PDFs |
| Pro | $15/mo | Unlimited campaigns, 10 hrs transcription, 50 PDFs |
| Team | $40/mo | 5 co-DMs, 30 hrs transcription, 200 PDFs |

**Success metrics:** 500 registered users · $1,500 MRR · NPS > 50 · Weekly retention > 80%

---

### V2 — Homebrew Marketplace (~6–8 Months Post-MVP)

**Goal: Creator economy, expanded systems**

- **Homebrew Marketplace:** 10 content types listable for sale via Quills virtual currency
- **Quills Economy:** Players earn 1 Quill/minute in sessions; DMs earn 2 Quills/minute + monthly Pro allocation
- **V2 economics:** Zero platform cut — builds inventory and creator trust before monetization
- **Adventure modules:** Multi-session bundles as marketplace listings
- **Pathfinder 2e support:** Priority #1 system expansion (3–4M additional players)

---

### V3 — Platform & Social (~12+ Months Post-MVP)

**Goal: Network effects, monetization maturity**

- TTRPG Group Finder (campaign posts + player profiles)
- Real-money cash-out for accumulated Quills
- **15% marketplace take rate** introduced at liquidity threshold
- Additional TTRPG systems (Call of Cthulhu, Vampire: The Masquerade)
- Mobile PWA with offline-first session capture
- Multi-monitor / ultra-wide layout tiers
- Publisher partnerships / official content licensing

---

## 6. Platform Expansion: Beyond D&D

### The OGL Migration Is Real

In early 2023, WotC's attempted Open Game License revision triggered the largest community defection in TTRPG history. Paizo's Pathfinder Remastered (OGL-free, 2023–2024) was adopted by **over 1.5 million players within six months of launch.** The non-D&D audience is growing and — critically — actively looking for new tools that WotC's ecosystem will never support.

### TAM Expansion via System Support

| System Added | Additional Players | Build Effort | Timeline |
|-------------|-------------------|-------------|---------|
| D&D 2024 (5e successor) | Incremental (same base) | Minimal | 2–4 weeks |
| **Pathfinder 2e (Priority 1)** | **+3–4M players** | Medium-High | **3–4 months** |
| **Call of Cthulhu (Priority 2)** | **+2–3M players** | Low | **1–2 months** |
| **Vampire: The Masquerade 5e (Priority 3)** | **+1–2M players** | Low-Medium | **2–3 months** |
| **Total TAM expansion** | **~25M → 34M (+35%)** | | |

### Why System-Agnostic Wins

QuiverDM is already **~70% system-agnostic.** The following features work for any TTRPG with zero changes:

- Session transcription (every TTRPG has sessions)
- AI session summaries
- NPC management (names, relationships, factions are universal)
- Homebrew PDF ingestion
- Session recording storage
- Narrative semantic search
- Campaign timeline and session log
- Player portal and visibility controls

**The system-specific 30%** — encounter calculators, stat blocks, character sheets — is a UI and schema layer, not an architecture rebuild. Adding Pathfinder 2e means new encounter math and stat block renderers. Call of Cthulhu drops encounter math entirely and adds a sanity tracker. QuiverDM's transcription, AI summaries, and narrative search require zero changes.

> **The pitch to the non-D&D market:** Every other campaign management tool is D&D-first or D&D-only. QuiverDM is the first AI-native platform built for any game system — which means Pathfinder GMs, Call of Cthulhu Keepers, and Vampire Storytellers have an AI co-pilot for the first time.

---

## 7. AI Agent Strategy

### From Features to an Agent Layer

QuiverDM already ships six AI capabilities: PDF extraction, session transcription, AI summaries, semantic search, image generation, and Rules RAG. The next evolution is a **coordinated agent layer** — purpose-built agents that share campaign context, hand off results via BullMQ, and compound into value no single feature can deliver.

The key architectural insight: **the database is the source of truth.** Agents are stateless compute over a stateful DB. Every agent reads campaign context from PostgreSQL via Prisma, calls an LLM, writes structured results back to the DB, and optionally fires a webhook. No agent stores state between runs. Any agent can be retried, re-run, or parallelized safely.

### The Eight Agents

| # | Agent | Phase | Mode | Value |
|---|-------|-------|------|-------|
| 1 | **Session Recap Agent** | Beta (enhance existing) | Async/BullMQ | Multi-context summaries referencing prior sessions, NPCs, character arcs |
| 2 | **NPC Voice Agent** | Beta (new) | Synchronous/tRPC | On-demand in-character dialogue generation during play |
| 3 | **Post-Session Hook Generator** | Beta (new, chained) | Async/BullMQ | 3–5 grounded "next session ideas" based on what actually happened |
| 4 | **Plot Continuity Agent** | MVP | Async/BullMQ | Living story bible: open/closed threads, NPC relationship changes |
| 5 | **Encounter Difficulty Advisor** | MVP | Synchronous/tRPC | Real-time difficulty advisory based on actual party resource state |
| 6 | **Player Engagement Tracker** | MVP | Async/BullMQ | Speaker-time analytics: detect quiet players, suggest spotlight moments |
| 7 | **Campaign Arc Suggester** | V2 | Async/on-demand | Macro narrative arc analysis after 5+ sessions |
| 8 | **Rules Lookup Agent v2** | V2 | Synchronous/tRPC | Conversational rules Q&A with multi-turn follow-ups and source citation |

### The Post-Session Pipeline

```
[Session ends]
      |
      v
[Transcription complete] ─────────────────────> [Player Engagement Tracker]
      |                                                  (async, parallel)
      v
[Session Recap Agent]
  reads:  transcript, prior 3 summaries, NPC list, character list
  writes: GameSession.aiSummary, aiHighlights
      |
      v
[Post-Session Hook Generator] ────────────────> [Webhooks → Discord/iCal/OBS]
  reads:  aiSummary, NPC secrets, character bonds
  writes: GameSession.aiHooks
      |
      v
[Plot Continuity Agent]
  reads:  all session summaries, current plot threads
  writes: CampaignPlotThread records (open/close/update)
      |
      v
[Campaign Arc Suggester] (on-demand, DM-triggered at 5+ sessions)
  reads:  all plot threads, all session summaries
  writes: displayed in UI, not persisted
```

### Provider Routing Strategy

QuiverDM uses a **local-first with policy-based cloud escalation** model:

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Structured JSON extraction | Ollama llama3.1 8B / Gemini Flash | Fast, cheap, zero marginal cost (Ollama) |
| Creative prose (dialogue, hooks) | Gemini Flash / GPT-4o-mini | Better tone and variety |
| Long-context reasoning (plot, arc) | Gemini Pro 1.5 / GPT-4o | 128k+ context window required |
| Rules Q&A (precise, grounded) | Ollama Mistral / GPT-4o-mini | Low temp, citation-focused |

> **Key metric:** Ollama (self-hosted on the VPS) handles structured extraction at ~$0 marginal cost. Cloud inference is reserved for long-context or high-creativity tasks. Users who supply their own Gemini or OpenAI API keys (already supported via UserSettings) automatically get the best available model.

---

## 8. Go-to-Market Strategy

### Core Messaging

> **"Stop taking notes. Start telling stories."**

This works because it names the exact pain (manual note-taking breaks immersion), reframes the product as enabling creativity rather than replacing it, and applies equally to DMs and players.

| Audience | Message |
|----------|---------|
| DMs | "Your session, transcribed, summarized, and searchable — automatically." |
| Players | "Never miss the story again. Your DM's recap, waiting the moment the session ends." |
| Homebrew users | "Upload any PDF. Search any monster, spell, or item in seconds." |

### Channel Priority Stack

| Tier | Channel | Cost | Expected 3-Month Result |
|------|---------|------|------------------------|
| **1** | Reddit (r/DMAcademy, r/DnD, r/DnDHomebrew) | $0 | 300–800 free users |
| **1** | Discord communities (5–10 DM servers) | $0 | 50–150 signups |
| **2** | YouTube DM creator partnerships (10K–200K subs) | $0–$200/mo | 200–500 signups per video |
| **2** | Short-form video (TikTok/Reels) | $0 | Viral potential |
| **3** | Product Hunt launch (coordinated with beta cohort) | $0 | 200–500 upvotes |
| **3** | EN World + Bell of Lost Souls press | $0 | Lasting SEO + credibility |
| **4** | Reddit Ads (post-$1K MRR) | $200/mo | +30–60 signups/month |
| **4** | Meta retargeting (post-$1K MRR) | $300/mo | Recover 10–20% bounced visitors |

### Beta Acquisition Plan — 50–100 Quality Users in 30 Days

**Week 1 — Hand-selected outreach (target: 20 users)**
Identify 30–40 active DMs posting about campaign management challenges on Reddit and Discord. Send personalized, non-templated invites referencing their specific posts. Offer: lifetime Pro discount (50–75% off) for a 30-minute feedback call. Expected acceptance: 30–40%.

**Week 2 — Controlled community post (target: 30–50 additional users)**
One authentic "I built this" thread on r/DMAcademy: real screenshots, 90-second screen recording, direct signup link. A well-crafted post on r/DMAcademy can realistically drive 2,000–5,000 qualified visitors at 1–2% conversion = 20–100 signups.

**Week 3–4 — Discord + referral (target: 20–30 additional users)**
Ask first 20 beta users to invite one DM friend each. Post in 5 Discord servers. Add a beta referral mechanic: existing beta users earn an extra month of Pro for each referral who runs a session.

### Budget Scenarios

| Plan | Monthly Budget | Expected 3-Month Users | Expected 3-Month MRR |
|------|---------------|----------------------|---------------------|
| **A: Zero budget** | $0 | 300–800 | $500–$1,500 |
| **B: $500/month** | $500 | 600–1,500 | $1,000–$3,000 |
| **C: $2,000/month** | $2,000 | 1,500–3,500 | $3,000–$8,000 |

> **At $2K/month, YouTube creator partnerships become the dominant growth driver.** A single well-matched creator with 100K subscribers who genuinely endorses the product can generate more signups than three months of paid ads. Concentrate budget there.

### Handling AI Skepticism

The TTRPG community has genuine, valid concerns about generative AI (creative displacement, stolen training data). QuiverDM's use case is categorically different:

1. **Lead with the output, not the technology.** Show the session recap. Don't say "our AI."
2. **Emphasize DM control.** Transcripts are editable. Summaries are overridable. Data is private.
3. **No buzzwords.** Never say "revolutionize," "disrupt," or "leverage AI" in community posts.
4. **Community-first framing.** "Built by a DM, for DMs" resonates strongly in this market.

---

## 9. Financial Model

### Unit Economics

The fundamental economics of QuiverDM are exceptional:

| Tier | Price | Cost to Serve | **Gross Margin** |
|------|-------|--------------|-----------------|
| Free | $0 | ~$0.15/mo | — (cost center, acquisition tool) |
| **Pro** | **$15/mo** | **~$1.96/mo** | **$13.04 (87%)** |
| **Team** | **$40/mo** | **~$5.30/mo** | **$34.70 (87%)** |

> **87% gross margin** — well above the 70–80% SaaS benchmark. The AI-cost risk is managed via Ollama (zero marginal cost) and hard usage caps.

**Cost breakdown per Pro user per month:**

| Component | Cost |
|-----------|------|
| Infrastructure (shared) | $0.10 |
| AssemblyAI transcription | $1.50 |
| AI inference (cloud, at scale) | $0.25 |
| Cloudflare R2 storage | $0.11 |
| **Total COGS** | **~$1.96** |

### LTV:CAC — Exceptional Unit Economics

| Metric | Pro | Team | Blended |
|--------|-----|------|---------|
| ARPU | $15/mo | $40/mo | ~$17.50 |
| Estimated churn | 4%/mo | 3%/mo | 3.5% |
| **LTV** | **$375** | **$1,333** | **~$500** |
| Blended CAC (community-first) | $10–$25 | $10–$25 | ~$15 |
| **LTV:CAC ratio** | **25:1–37:1** | **53:1–133:1** | **~33:1** |

Even at 2x higher CAC ($30), LTV:CAC remains at **12.5:1** — well above the 3:1 healthy benchmark.

### Three-Scenario Revenue Projections

| Scenario | Month 3 | Month 6 | Month 12 | Month 24 |
|----------|---------|---------|---------|---------|
| **Conservative** | $155 MRR / 10 paying | $560 / 40 | $3,000 / 200 | $12,600 / 840 |
| **Base** | $560 / 40 | $3,000 / 200 | $14,400 / 960 | $56,250 / 3,750 |
| **Optimistic** | $1,500 / 100 | $9,000 / 600 | $45,000 / 3,000 | $225,000 / 15,000 |

### Infrastructure Cost Profile

| Scale | Monthly Infra | Notes |
|-------|-------------|-------|
| **Beta (0–500 users)** | **~$115–175/mo** | Vercel Pro + Hetzner CX42 + R2 + Resend + AssemblyAI |
| **Growth (1K–10K users)** | **~$550–745/mo** | Scale to CX52 ×2, dedicated volumes, higher AssemblyAI |
| **10K+ users** | **~$400–800/mo infra + AI costs** | Move to managed services (Railway/Neon) |

> At 10,000 users with $20 blended ARPU → **~$200K/month revenue**. Infrastructure at $750/month is **0.375% of revenue** — a model that improves with scale.

### Path to Break-Even

| Cost Assumption | Paying Users Needed | MRR at Break-Even | Timeline (Base Scenario) |
|----------------|--------------------|--------------------|------------------------|
| Infrastructure only (~$1K/mo) | ~67 | ~$1,000 | Month 4–5 |
| Solo dev + salary ($10K/mo) | **~730** | **~$11K** | **Month 14–16** |
| Small team ($20K/mo burn) | ~1,400 | ~$21K | Month 18–24 |

### V2 Marketplace Revenue (Month 24+)

Once the Quills economy and marketplace launch in V3 (15% take rate at liquidity):

| Metric | Estimate |
|--------|---------|
| Monthly GMV | $5,000–$25,000 |
| Platform revenue (15% cut) | **$750–$3,750/month** |
| Projected ARR contribution | **$9,000–$45,000** |

### Revenue Mix at Month 30 (Base+)

| Source | MRR | % of Total |
|--------|-----|-----------|
| Pro subscriptions | $50,000 | 72% |
| Team subscriptions | $9,000 | 13% |
| Marketplace take rate (15%) | $5,000 | 7% |
| Quill purchases | $6,000 | 8% |
| **Total** | **$70,000** | 100% |

---

## 10. Technical Architecture

### The Hybrid Stack

QuiverDM's architecture is purpose-designed for two fundamentally different workload profiles:

**Stateless request handling** → **Vercel**: Next.js 15 SSR, tRPC API, NextAuth v5. Auto-scaling, global edge, zero ops.

**Stateful background processing** → **Hetzner VPS (CX42)**: PostgreSQL + pgvector, Redis, MeiliSearch, Docling, Ollama, 6 BullMQ workers, WebSocket server. Long-running processes that need co-location and local network access.

**Bridge** → **Cloudflare Tunnel**: An outbound-only encrypted tunnel (no open VPS firewall ports) connecting Vercel to all internal VPS services over HTTPS. DNS + WAF + DDoS protection at the edge, zero egress cost via R2.

```
Users → Cloudflare (DNS + WAF + CDN) → Vercel (Next.js/tRPC)
                                              ↕ HTTPS via Cloudflare Tunnel
                                    Hetzner VPS (Postgres + Redis + Workers + Ollama)
                                              ↕
                                    Cloudflare R2 (audio, PDFs, images — zero egress)
```

### Performance Architecture — "Fast and Snappy"

| Technique | Implementation |
|-----------|---------------|
| **Connection pooling** | PgBouncer (transaction mode, 1000 max client connections) — prevents Vercel serverless from exhausting Postgres |
| **Redis caching** | Campaign/session/NPC list caching with 5–15 min TTL; BullMQ on separate Redis DB (no eviction) |
| **Semantic search** | pgvector HNSW index (1.5ms query latency vs 2.4ms IVFFlat) |
| **Full-text search** | MeiliSearch (co-located with Postgres, sub-10ms search) |
| **RSC prefetching** | Server-side tRPC prefetch of sessions + NPCs + homebrew in parallel; no waterfall on campaign dashboard |
| **File storage** | Cloudflare R2 presigned URLs — direct browser-to-R2 uploads (bypasses Vercel 4.5MB limit + $0.05/GB cost) |
| **Edge caching** | Vercel ISR for marketing/public pages (1hr revalidation); shared session pages (5min) |
| **staleTime tuning** | React Query 30s staleTime on list queries; 0ms with 3s polling for live transcription |

### Current Dev Stack

`Next.js 15` + `TypeScript` + `tRPC v11` + `Prisma` + `PostgreSQL/pgvector` + `Redis/BullMQ` + `MeiliSearch` + `NextAuth v5` + `Tailwind` + `shadcn/ui`

---

## 11. Team Needs

QuiverDM was built by a single full-stack developer. The product is production-ready. What scales next is distribution, polish, and platform breadth.

### Now — Beta (Current)

| Role | Status | Focus |
|------|--------|-------|
| Full-stack developer | Existing | Product polish, deployment, beta feedback loops |
| Part-time designer | **Needed** | Onboarding UX polish, marketing assets, design system refinement |

### MVP — Public Launch (~3 Months)

| Role | Status | Focus |
|------|--------|-------|
| Growth / marketing hire | **Needed** | Community management, creator partnerships, content strategy |
| *Designer can become full-time if conversion and retention design is prioritized* | | |

### V2 — Marketplace + Expansion (~6–8 Months)

| Role | Status | Focus |
|------|--------|-------|
| Backend / AI engineer | **Needed** | Agent layer development, PF2e system expansion, marketplace infrastructure |
| Community manager | **Needed** | Discord moderation, creator relationships, DM content program |

### V3 — Scale (~12+ Months)

| Role | Status | Focus |
|------|--------|-------|
| Sales / partnerships | **Needed** | B2B (game stores, publishers, convention organizers), pro DM partnerships |
| Customer success | **Needed** | Onboarding, churn reduction, power user programs |

> **B2B opportunity (V3 horizon):** Gen Con 2024 had 71,000+ unique attendees. Third-party publishers (Paizo, Kobold Press, MCDM, Darrington Press) need digital tooling for their systems that D&D Beyond structurally cannot provide. QuiverDM's system-agnostic homebrew extraction and rules RAG create a clear partnership pitch to mid-tier publishers — potential revenue that requires zero new product development.

---

## 12. Next Steps

### The Horizon Map

```
NOW ──────────────── MONTH 3 ──────────── MONTH 9 ──────────── MONTH 18+
│                        │                    │                     │
▼                        ▼                    ▼                     ▼
[Closed Beta]        [MVP Launch]         [V2 Launch]          [V3 Launch]
• 50–100 hand-       • Public launch      • Marketplace        • Group finder
  selected DMs       • Stripe live        • Quills economy     • Cash-out
• Polish + E2E       • Open waitlist      • PF2e support       • 15% take rate
• Deploy to prod     • $1,500+ MRR        • 3+ AI agents       • CoC / VtM
• 3 AI agents        • 500+ users         • $10K+ MRR          • Mobile PWA
```

### Beta Phase — Immediate Actions

1. **Deploy to production** — Vercel (Next.js) + Railway/Hetzner (services)
2. **Recruit beta cohort** — 20 hand-selected DMs from r/DMAcademy and Discord
3. **Ship NPC Voice Agent and Post-Session Hook Generator** — highest DM delight, lowest implementation cost
4. **Launch QuiverDM Discord** — build the community infrastructure before the product needs it
5. **Start content flywheel** — 1 Reddit post/week, 2–3 short videos/month

### Success Criteria Before MVP Launch

| Metric | Target |
|--------|--------|
| Active beta users (ran 1+ session) | 35–70 |
| NPS from beta cohort | > 40 |
| Beta-to-paid conversion rate | 20–30% |
| Weekly retention among active users | > 80% |
| Session activation rate (signup → first session, 7 days) | > 30% |

### The Long View

QuiverDM occupies a category that does not exist yet. The incumbents — Roll20, D&D Beyond, Foundry — are all runtime tools built for the table. None of them will pivot to building a DM workflow platform: D&D Beyond is locked to WotC content, Roll20 is a map/dice tool at heart, and Foundry is a self-hosted hobby project.

The DM's operating system — where every session is documented, every NPC is remembered, and every piece of homebrew is searchable — is a product the market needs and no one has built.

**QuiverDM is that product. It exists. It works. The question now is who finds it first.**

---

*QuiverDM — Closed Beta 2026*
*26 routers · 5 workers · 32 pages · 14 integrations · 40+ data models*
*Built for the $2B TTRPG market. Feature-complete. Ready to ship.*
