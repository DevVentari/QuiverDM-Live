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
