# CLAUDE.md

Guidance for coding agents working in `E:\Projects\QuiverDM`.

## Project Overview

QuiverDM is an AI-powered D&D session management app for closed beta.

Current status:
- Feature-complete for beta launch
- Frontend + backend both active (App Router pages + API routes)
- 20 tRPC routers
- 12+ services
- 9 repositories

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- tRPC v11 + Zod
- NextAuth v5 beta
- Prisma + PostgreSQL
- BullMQ + Redis
- MeiliSearch
- Stripe (billing)
- Resend (transactional email)
- Tailwind + shadcn/ui + Lucide

## Quick Start

```bash
docker-compose up -d
npm install
npm run db:push
npm run dev
npm run dev:ws
npm run worker:pdf
```

## Dev Commands

```bash
npm run dev                # Next.js on http://localhost:3847
npm run dev:ws             # WebSocket server
npm run worker:pdf         # PDF worker
npm run lint               # ESLint
npx tsc --noEmit           # Type checking
npm run build              # Production build
npm run db:push            # Prisma schema push
npm run db:studio          # Prisma Studio
npm run setup:stripe       # Create/find Stripe products and prices
npm run check:launch       # Pre-launch environment/integration checks
npm run generate-beta-invites
```

## Architecture

### App Structure

```text
src/app/
  page.tsx                       # Root redirect (auth -> dashboard, else signin)
  (app)/                         # Authenticated app pages
  (auth)/auth/                   # signin, signup, error
  (marketing)/                   # landing, pricing
  api/                           # auth, trpc, webhooks/stripe, uploads, health
```

### Server Structure

```text
src/server/
  routers/                       # 20 routers
  services/                      # 12+ services
  repositories/                  # 9 repositories
  errors/                        # Typed app errors
  trpc.ts                        # tRPC init + procedures
```

### Router List (20)

- campaigns
- sessions
- npcs
- players
- characters
- charactersDndBeyond
- sessionTranscription
- sessionRecordings
- transcript
- homebrew
- homebrewDndBeyond
- homebrewPdf
- homebrewExtraction
- userSettings
- members
- invites
- onboarding
- feedback
- usage
- billing

## Core Patterns

### tRPC Client in React

```tsx
'use client';
import { trpc } from '@/lib/trpc';

const { data } = trpc.npcs.getById.useQuery({ id });
const update = trpc.npcs.update.useMutation();
```

### Campaign Context

```tsx
import { useCampaign } from '@/components/campaign/campaign-context';
const { campaignId, slug, isDM } = useCampaign();
```

### Error Usage

```ts
throw new NotFoundError('npc', npcId);
throw ForbiddenError.forPermission('edit', 'NPC');
throw ValidationError.forField('name', 'Required');
```

Important:
- Static factory methods are called without `new`
- Use typed errors from `src/server/errors`

### JSON Fields

Use `Prisma.JsonNull` for Prisma JSON-null writes (not plain `null`) where required by model semantics.

## Billing and Email

- Billing backend and UI are implemented (checkout, portal, cancel, usage tiers)
- Stripe webhook handler: `src/app/api/webhooks/stripe/route.ts`
- Email service: `src/lib/email.ts` (welcome, invite, password reset templates)

## Environment Variables (Primary)

```env
DATABASE_URL=
REDIS_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_TEAM_PRICE_ID=

RESEND_API_KEY=
EMAIL_FROM=

ADMIN_EMAILS=
MEILI_URL=
MEILI_MASTER_KEY=
OLLAMA_BASE_URL=
```

## Operational Notes

- Local build may fail if Stripe environment variables are missing.
- `scripts/stripe-webhook-local.sh` forwards Stripe events during local testing.
- `npm run check:launch` performs DB/Redis/env/Stripe/invite readiness checks.

## Maintenance

Keep this file synced with architecture changes (router count, scripts, and deployment-critical flows).
