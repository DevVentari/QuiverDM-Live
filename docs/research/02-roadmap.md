# QuiverDM Product Roadmap
*Generated 2026-02-23*

## Current Status

- **All 8 features merged to main** — 26 tRPC routers, 7 Docker services (pgvector)
- **Feature-complete for beta launch** — now in polish & testing phase
- **Dev port:** 3847

---

## Completed Features (All Merged to Main)

| Feature | Description |
|---------|-------------|
| F1 — AI Session Summaries | Transcripts → LLM summary + highlights with speaker labels. Shareable public page per session. |
| F2 — Narrative Search | pgvector embeddings for semantic search across sessions, NPCs, and homebrew. |
| F3 — Encounter Builder | Initiative tracking, HP bars, condition management. SRD monster picker. AI-assisted encounter generation. |
| F4 — Audio Ingest | Browser MediaRecorder + live speaker labeling via WebSocket server. |
| F5 — Visual Assets | AI image generation for NPCs and homebrew items. Supports ComfyUI and cloud providers. |
| F6 — Player Portal | Role-scoped session visibility — DMs control what players can see. |
| F7 — Rules RAG | Local semantic search over D&D SRD + user-uploaded homebrew PDFs as rules sources. |
| F8 — Webhooks | Discord/iCal integrations, OBS overlay SSE streaming, outbound webhook delivery. |

**Design system (merged):** Bricolage Grotesque font, OKLCH color tokens, fluid type utilities.
**Motion (merged):** Spring-based stagger animations on sessions and encounters lists.

---

## Beta Phase — Now to ~4 Weeks

### Polish
- Replace `window.confirm` in encounters page + encounter builder with `ConfirmDialog`
- Standardize empty states across NPC, player, homebrew list pages
- Add Zod client-side validation to campaign create form
- Redirect to new campaign after onboarding completion

### Testing
- Fix Playwright baseURL (3001 → 3847)
- E2E tests: Auth, Onboarding, Campaign CRUD, Sessions, NPCs, Member invites

### Deployment
- Next.js → Vercel
- PostgreSQL (pgvector) + Redis + MeiliSearch + Docling → Railway
- 5 BullMQ workers + WebSocket server → Railway services
- Cloudflare Tunnel (self-hosted option)

---

## MVP — Public Launch (~6-10 Weeks Post-Beta)

### Features
- Stripe billing live (checkout, portal, cancel)
- Email notifications (Resend — welcome, invite, password reset)
- Invite-only beta → open waitlist → public

### Pricing
| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 1 campaign, 30 min transcription/mo, 5 PDFs |
| Pro | $15/mo | Unlimited campaigns, 10 hrs transcription, 50 PDFs |
| Team | $40/mo | 5 co-DMs, 30 hrs transcription, 200 PDFs |

### Success Metrics
- 500 registered users
- $1,500 MRR
- NPS > 50
- Weekly retention > 80%

---

## V2 — 6-8 Months Post-MVP

### Homebrew Marketplace
- 10 homebrew types + character templates listable for sale
- Virtual currency "Quills" as payment
- Free listings allowed

### Reward Economy (Virtual Only)
- Players earn: 1 Quill/minute in active sessions
- DMs earn: 2 Quills/minute running + Pro 1,000/mo allocation, Team 3,000/mo
- All Quills go seller-to-buyer (no platform cut in V2)
- Cash-out deferred to V3

### Expanded Marketplace Content
- Adventure modules (multi-session bundles)
- Battle maps + visual assets

### TTRPG Expansion
- Support for Pathfinder 2e (priority #1 beyond D&D)
- System-agnostic features (transcription, session notes, PDF extraction)

---

## V3 — 12+ Months Post-MVP

### Social & Discovery
- TTRPG Group Finder (campaign posts + player profiles)
- Player profiles with play history
- Reviews and ratings for DM listings

### Economy Maturation
- Real money cash-out for accumulated Quills
- Platform cut introduced (15% on marketplace sales)
- Creator fund / revenue sharing

### Platform Expansion
- Multi-monitor / ultra-wide layout tiers (1920px / 2560px+)
- Mobile PWA (offline-first)
- Additional TTRPG systems (CoC, VtM, Pathfinder)
- Publisher partnerships / official content
