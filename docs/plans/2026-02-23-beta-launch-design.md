# QuiverDM Beta Launch Design
**Date:** 2026-02-23
**Status:** Approved
**Scope:** Closed beta readiness → MVP public launch

---

## Goals

1. Polish the existing app to a level fit for real users
2. Smooth the onboarding flow for first-time DMs
3. Full E2E test coverage on critical paths
4. Deploy to production on Vercel + Railway

---

## 1. UI Polish

Fixes sourced from UI audit (`UI_AUDIT.md`, 2026-02-18).

### Medium priority (broken/missing interactions)

| ID | File | Fix |
|----|------|-----|
| M1 | `homebrew/pdfs/page.tsx` | Replace `window.confirm()` on PDF delete with `<ConfirmDialog>` |
| M2 | `campaigns/[slug]/settings/page.tsx` | Add `toast({ title: 'Settings saved' })` in mutation `onSuccess` |
| M3 | `dashboard/page.tsx` | Add `isError` error cards to campaigns, characters, homebrew sections |

### Low priority (UX consistency)

| ID | File | Fix |
|----|------|-----|
| L1 | `invite-dialog.tsx` | Reset `role` state when dialog closes |
| L2 | `invite-dialog.tsx` | Add `<Loader2>` spinner on Create button when `createInvite.isPending` |
| L3 | `campaign-nav.tsx` | Audit Players vs Members tab visibility — document or align |
| L4 | Multiple list pages | Standardise empty states: icon + heading + description + primary CTA |
| L5 | Multiple forms | Add Zod-based client-side validation with inline error messages |
| L6 | `campaigns/*/sessions/page.tsx` | Add `isError` error state |
| L7 | `campaigns/*/npcs/page.tsx` | Add `isError` error state |

---

## 2. Beta Onboarding Flow

The onboarding wizard exists but needs to be reviewed end-to-end for a DM arriving for the first time.

### Required flow

1. **Sign up** → email verification → land on onboarding wizard
2. **Step 1 — Create your first campaign** (name, description, system)
3. **Step 2 — Invite players** (copy invite link or send email invites)
4. **Step 3 — Upload homebrew** (optional, skippable — PDF or manual create)
5. **Step 4 — Start a session** (guided prompt pointing at Sessions tab)
6. **Completion** → land on campaign dashboard with a "What's next?" panel

### Acceptance criteria

- No step can be skipped accidentally (wizard enforces linear progression unless step is marked optional)
- Returning users never see the wizard again (completion flag in DB)
- Mobile-friendly at every step
- Empty states on the dashboard after onboarding point back to the wizard CTA if campaign has no sessions yet

---

## 3. E2E Testing

Framework: Playwright (already in the project).

### Critical paths to cover

| Path | Description |
|------|-------------|
| Auth | Sign up, email verify, sign in, sign out, password reset |
| Onboarding | Full wizard completion flow |
| Campaign | Create, edit settings, delete |
| Session | Create, open, close, view recap |
| NPC | Create, edit, delete |
| Homebrew | Manual create, PDF upload, extraction |
| Members | Invite via link, role change, remove |
| Billing | Upgrade to Pro, view portal (Stripe test mode) |
| Player portal | Join via invite, view session as player |

### Coverage target

All critical paths pass in CI before any deployment. Non-critical paths (e.g. admin pages) are smoke-tested.

---

## 4. Deployment Architecture

### Production stack

| Layer | Service | Notes |
|-------|---------|-------|
| Next.js app | Vercel | Zero-config deploys, CDN, preview URLs per PR |
| PostgreSQL | Railway (pgvector image) | Existing `pgvector/pgvector:pg15` image |
| Redis | Railway | BullMQ + caching |
| MeiliSearch | Railway | Full-text search |
| Docling | Railway | PDF processing container |
| BullMQ workers | Railway | pdf, transcription, webhooks, summary, embeddings — long-running Node processes |
| WebSocket server | Railway | `npm run dev:ws` as a separate Railway service |

### Migration from local Docker

Railway can import the existing `docker-compose.yml` directly. Steps:
1. Create Railway project, add services from compose file
2. Set all environment variables (see `CLAUDE.md` env var list)
3. Point `DATABASE_URL`, `REDIS_URL`, `MEILI_URL`, `DOCLING_URL` at Railway-provisioned URLs
4. Deploy Next.js to Vercel, set same env vars pointing at Railway services
5. Configure Stripe webhook endpoint to Vercel production URL
6. Run `npm run db:push` against production DB
7. Run `npm run check:launch` to validate all integrations

### Environment checklist

- [ ] `DATABASE_URL` — Railway Postgres
- [ ] `REDIS_URL` — Railway Redis
- [ ] `NEXTAUTH_URL` — Vercel production URL
- [ ] `NEXTAUTH_SECRET` — strong secret
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + price IDs
- [ ] `RESEND_API_KEY` + `EMAIL_FROM`
- [ ] `ADMIN_EMAILS`
- [ ] `MEILI_URL` + `MEILI_MASTER_KEY`
- [ ] `DOCLING_URL`
- [ ] `OLLAMA_BASE_URL` (if using local Ollama — may switch to cloud AI for production)
- [ ] `ASSEMBLYAI_API_KEY`

---

## 5. Beta Launch Sequence

1. Fix all M-priority UI issues
2. Review and harden onboarding flow
3. Write E2E tests for all critical paths
4. Set up Railway services + Vercel project
5. Deploy to staging, run `npm run check:launch`
6. Fix any issues found in staging
7. Deploy to production
8. Run `npm run generate-beta-invites`, send to first cohort

---

## V2-3 Vision (Future Reference)

*Not being built now. Documented for continuity — revisit 6-8 months post-MVP after beta feedback and stabilisation.*

### V2 — Homebrew Marketplace + Reward Economy
- Single virtual currency ("Quills") earned by session participation
- Players: 1 Quill/min in active session
- DMs: 2 Quills/min running + monthly subscription allocation (Pro: 1,000/mo, Team: 3,000/mo)
- Marketplace: existing homebrew types + character templates, listed with Quill price, purchased items copied into buyer's library
- No platform cut in v2; cash-out deferred to v3
- Adventure modules and maps as marketplace content

### V3 — Group Finder + Social + Cash-out
- TTRPG group finder (campaign posts + player profiles)
- Real money cash-out for accumulated Quills
- Reviews, ratings, social profiles
- Full multi-monitor / ultra-wide layout tiers (1920px / 2560px+ breakpoints)
