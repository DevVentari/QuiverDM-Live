# QuiverDM — Codex Handoff Document

> **Created**: 2026-02-15 by Claude Code
> **Purpose**: Continue development using ChatGPT Codex agents
> **Launch Target**: March 2026, $1,500 MRR

---

## Current State

QuiverDM is an AI-powered D&D session management tool for Dungeon Masters. It's a Next.js 15 full-stack app (App Router, TypeScript, tRPC, Prisma, PostgreSQL, Redis/BullMQ, MeiliSearch) in closed beta preparation.

### What's Done

| Area | Status | Key Files |
|------|--------|-----------|
| Auth (NextAuth v5 beta) | Complete | `src/lib/auth.ts`, `src/middleware.ts` |
| 19 tRPC routers | Complete | `src/server/routers/_app.ts` |
| 10 services, 9 repositories | Complete | `src/server/services/`, `src/server/repositories/` |
| Closed beta (invites, admin) | Complete | `src/server/routers/invites.ts`, `src/app/(app)/admin/` |
| Onboarding wizard | Complete | `src/app/(app)/onboarding/page.tsx` |
| PDF processing pipeline | Complete | `src/lib/queue/worker.ts`, `src/lib/pdf/` |
| Transcription (WhisperX) | Complete | `src/lib/transcription/` |
| Transcription viewer UI | Complete | `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` |
| Usage/quota tracking | Complete | `src/server/services/usage.service.ts`, settings page |
| Stripe billing (backend) | Complete | `src/server/services/billing.service.ts`, `src/server/routers/billing.ts` |
| Deployment infra | Complete | `Dockerfile`, `docker-compose.prod.yml`, `.github/workflows/` |
| Security hardening | Complete | Middleware, admin enforcement, password min 8 |

### What's Remaining (ordered by priority)

#### Task 1: Pricing/Upgrade UI (Small — ~100 lines)

The settings page (`src/app/(app)/settings/page.tsx`) already shows usage meters and a tier badge, but the "Upgrade to Pro" button links to `#`. Wire it up to Stripe checkout.

**What to do:**
- In the settings page, make the upgrade button call `trpc.billing.createCheckout.mutate({ priceId })` and redirect to the returned URL via `window.location.href`
- Add a "Manage Subscription" button for paid users that calls `trpc.billing.createPortal.mutate()` and redirects
- Add a "Cancel Subscription" button that calls `trpc.billing.cancel.mutate()` with a confirmation dialog
- Show subscription status (active, canceling, past_due) with appropriate messaging
- Price IDs come from env vars `STRIPE_PRO_PRICE_ID` and `STRIPE_TEAM_PRICE_ID` — expose them to the client via a tRPC query or hardcode display prices ($9/mo Pro, $19/mo Team)

**Existing tRPC endpoints to use:**
```typescript
trpc.billing.getStatus.useQuery()       // { tier, hasSubscription, subscriptionStatus, currentPeriodEnd }
trpc.billing.createCheckout.useMutation()  // input: { priceId: string }, returns { url }
trpc.billing.createPortal.useMutation()    // returns { url }
trpc.billing.cancel.useMutation()          // returns { success: true }
```

**Reference files:**
- `src/server/routers/billing.ts` — see all available endpoints
- `src/server/services/billing.service.ts` — see business logic
- `src/app/(app)/settings/page.tsx` — the page to modify

#### Task 2: D&D Beyond Character Import UI (Medium — ~200 lines)

Backend is fully built. Need a frontend page for importing characters from D&D Beyond.

**What to do:**
- Create or enhance `src/app/(app)/characters/page.tsx` to add an "Import from D&D Beyond" button
- Create an import modal/dialog that takes a D&D Beyond character URL (e.g., `https://www.dndbeyond.com/characters/12345678`)
- Call `trpc.charactersDndBeyond.import.mutate({ url })` to import
- Show loading state during import, success with character details, or error
- After import, redirect to the character detail page or refresh the character list
- Add a "Sync" button on existing imported characters that calls `trpc.charactersDndBeyond.sync.mutate({ characterId })`

**Existing tRPC endpoints:**
```typescript
trpc.charactersDndBeyond.import.useMutation()  // input: { url: string }
trpc.charactersDndBeyond.sync.useMutation()    // input: { characterId: string }
```

**Reference files:**
- `src/server/routers/characters-dndbeyond.ts` — see endpoints
- `src/server/services/characters-dndbeyond.service.ts` — see business logic
- `src/app/(app)/characters/page.tsx` — existing characters list page
- `src/app/(app)/characters/[characterId]/page.tsx` — character detail page

#### Task 3: Feedback Form UI (Small — ~150 lines)

Backend exists. Need a simple feedback form accessible from the app.

**What to do:**
- Create `src/app/(app)/feedback/page.tsx` — a feedback submission form
- Fields: type (bug/feature/improvement/other dropdown), title (text), description (textarea), rating (1-5 stars, optional), category (transcription/pdf/ui/performance/other dropdown, optional)
- Call `trpc.feedback.create.mutate({ type, title, description, rating, category })`
- Show success toast after submission
- Add a "My Feedback" section below showing `trpc.feedback.getUserFeedback.useQuery()`
- Add a link to the feedback page in the app shell sidebar/nav

**Existing tRPC endpoints:**
```typescript
trpc.feedback.create.useMutation()          // input: { type, title, description, rating?, category? }
trpc.feedback.getUserFeedback.useQuery()    // returns array of feedback items
trpc.feedback.getById.useQuery({ id })      // single feedback item
```

**Reference files:**
- `src/server/routers/feedback.ts` — see endpoints and input schemas
- `src/server/services/feedback.service.ts` — see validation rules (title 3-200 chars, description 10+ chars, rating 1-5)

#### Task 4: Transactional Email (Medium — ~300 lines)

Currently no email sending capability. Need it for invite notifications and password resets.

**What to do:**
- Install `resend` package (MIT license, simple API, free tier: 100 emails/day)
- Create `src/lib/email.ts` — email service singleton using Resend
- Create email templates for: welcome email, invite code delivery, password reset (if implementing)
- Wire into invite generation: when admin generates codes, optionally send them via email
- Wire into signup: send a welcome email after successful registration
- Env var: `RESEND_API_KEY`, `EMAIL_FROM` (e.g., `noreply@quiverdm.com`)

#### Task 5: Email Verification (Medium — can defer to post-beta)

Currently `emailVerified: new Date()` is hardcoded in signup (`src/app/api/auth/signup/route.ts` line 69). This auto-verifies everyone.

**What to do (if implementing):**
- Generate a verification token on signup, store it in a new `VerificationToken` model (NextAuth adapter already supports this)
- Send verification email with a link
- Create `/auth/verify` page that validates the token
- Don't set `emailVerified` until the token is validated
- This can wait until after beta launch

---

## Project Architecture Quick Reference

### Tech Stack
- **Framework**: Next.js 15 (App Router), TypeScript
- **API**: tRPC v11 (RC), Zod validation
- **Auth**: NextAuth v5 beta, JWT sessions, Google/GitHub/Discord/Credentials providers
- **Database**: PostgreSQL (port 5433 dev), Prisma ORM
- **Queue**: BullMQ + Redis (port 6380 dev)
- **Search**: MeiliSearch (port 7701 dev)
- **AI**: Ollama (local, default), Gemini, OpenAI — multi-provider in `src/lib/ai/`
- **UI**: Tailwind CSS, shadcn/ui components, Lucide icons, Framer Motion
- **Payments**: Stripe (just installed, backend complete)

### Directory Structure
```
src/
├── app/
│   ├── (app)/           # Authenticated app pages (dashboard, campaigns, settings, etc.)
│   ├── (auth)/          # Auth pages (signin, signup, error)
│   ├── (marketing)/     # Marketing pages (landing)
│   └── api/             # API routes (auth, uploads, tRPC, webhooks, health, storage)
├── components/          # React components (shadcn/ui in ui/, app components at root)
├── hooks/               # React hooks (usePDFProgress, use-toast)
├── lib/                 # Core libraries (auth, prisma, stripe, ai, pdf, queue, storage, etc.)
└── server/
    ├── routers/         # 19 tRPC routers
    ├── services/        # 10+ services (business logic)
    ├── repositories/    # 9 repositories (data access)
    ├── errors/          # 8 typed error classes
    └── trpc.ts          # tRPC init + campaign-scoped procedures
```

### Key Patterns

**tRPC router pattern:**
```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const myRouter = router({
  myEndpoint: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ctx.session.user.id is the authenticated user
      return result;
    }),
});
```

**Campaign-scoped procedures** (for campaign-specific endpoints):
```typescript
import { campaignDMProcedure } from '../trpc';
// Validates campaignId input + user is DM, adds ctx.membership
```

**Error throwing:**
```typescript
import { NotFoundError, ForbiddenError, ValidationError, BadRequestError } from '../errors';
throw new NotFoundError('campaign', campaignId);
throw ForbiddenError.forPermission('edit', 'NPC');  // NO `new` — static factory
throw ValidationError.forField('email', 'Required'); // NO `new` — static factory
```

**UI components** — use shadcn/ui from `@/components/ui/`:
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
```

**tRPC client in React:**
```typescript
'use client';
import { trpc } from '@/lib/trpc';

// Queries
const { data, isLoading, error } = trpc.billing.getStatus.useQuery();

// Mutations
const mutation = trpc.billing.createCheckout.useMutation();
const handleClick = () => mutation.mutate({ priceId: '...' });
```

### Dev Commands
```bash
npm run dev          # Next.js at http://localhost:3847
npm run dev:ws       # WebSocket server (separate terminal)
npm run worker:pdf   # PDF worker (separate terminal)
npm run lint         # ESLint
npm run db:push      # Push schema changes
npm run db:studio    # Prisma Studio GUI
```

### Docker Services (dev)
```bash
docker-compose up -d   # Postgres:5433, Redis:6380, MeiliSearch:7701, Ollama:11434, n8n:5678
```

---

## Instructions for Codex

### General Guidelines
- **Read before writing** — always read existing files before modifying them
- **Follow existing patterns** — match the coding style of adjacent files
- **Use existing components** — shadcn/ui components are in `src/components/ui/`, don't install new UI libraries
- **TypeScript strict** — no `any` types unless absolutely necessary, use Zod for validation
- **Dark mode** — all UI uses Tailwind theme tokens (bg-card, text-foreground, etc.), never hardcode colors
- **Error handling** — use the typed error classes from `src/server/errors/`, never throw raw strings
- **No `new` on static factories** — `ValidationError.forField()` and `ForbiddenError.forPermission()` are static methods, do NOT use `new`
- **Prisma Json fields** — use `Prisma.JsonNull` instead of `null` for Json columns (see `src/server/repositories/characters-dndbeyond.repository.ts` for the `jsonField()` helper)
- **Don't modify CLAUDE.md** — that's for Claude Code, not Codex

### Parallel Execution Strategy
Tasks 1, 2, and 3 are independent and can be worked on simultaneously:
- **Agent A**: Task 1 (Pricing/Upgrade UI) — modify `src/app/(app)/settings/page.tsx`
- **Agent B**: Task 2 (D&D Beyond Import UI) — modify `src/app/(app)/characters/page.tsx`
- **Agent C**: Task 3 (Feedback Form UI) — create `src/app/(app)/feedback/page.tsx`

Task 4 (Email) depends on none of the above and can also run in parallel.

### After Completing Code Tasks
1. Run `npx tsc --noEmit` to verify no TypeScript errors (ignore the 2 pre-existing ones in `docs/Test/` and `worker.ts`)
2. Run `npm run lint` to check for linting issues
3. Commit with descriptive messages
4. The deployment infrastructure is ready — just needs Railway project setup and env vars configured

### Environment Variables Needed for New Features
```env
# Already in .env.production.example:
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...

# New for email (Task 4):
RESEND_API_KEY=re_...
EMAIL_FROM=QuiverDM <noreply@quiverdm.com>
```

---

## Build Verification

After all changes, verify:
```bash
npx tsc --noEmit          # Should show only 2 pre-existing errors
npm run lint              # Should pass
npm run build             # Full production build
```

The 2 known pre-existing TypeScript errors to ignore:
1. `docs/Test/pdf-processing/test-pdf-processing.ts` — wrong import path (test file)
2. `src/lib/queue/worker.ts` — `__webpack_require__` (Next.js bundler API, works at runtime)
