# QuiverDM — Codex Handoff #3 (Final)

> **Created**: 2026-02-15 by Claude Code
> **Status**: Feature-complete. Zero TypeScript errors. 16 commits on main.
> **What's left**: Stripe product setup, deployment config, and final integration testing.

---

## What's Done

The app is **feature-complete for closed beta**:

- 19 tRPC routers, 10+ services, 9 repositories
- 28+ frontend pages, all functional
- Auth (NextAuth v5): Google, GitHub, Discord, Credentials
- Middleware for route protection
- Onboarding wizard (4-step)
- Campaign, session, NPC (CRUD + edit), character management
- PDF processing pipeline (Marker + pdfplumber fallback)
- Transcription viewer with search, segments, audio/video playback
- D&D Beyond character import + sync
- Homebrew content library with AI extraction
- Stripe billing backend (checkout, portal, webhooks, cancel)
- Stripe UI (upgrade/downgrade/cancel in settings, public pricing page)
- Usage/quota tracking with tier-based limits
- Feedback form with star rating
- Email service (Resend) — welcome, invite, password reset templates
- Admin panel (invite code management with email delivery)
- Deployment infra (Dockerfile, docker-compose.prod, CI/CD, Railway)
- Health check endpoint
- Root page redirect, public pricing page

---

## Remaining Tasks (Config/Ops — No Major Code)

### Task 1: Stripe Product & Price Setup

This is done in the Stripe dashboard, not in code. But Codex can help create a setup script.

**What to do:**
- Create `scripts/setup-stripe.ts` — a script that creates Stripe products and prices programmatically
- Uses the Stripe SDK (already installed)
- Creates two products: "QuiverDM Pro" and "QuiverDM Team"
- Creates monthly prices: $9/mo for Pro, $19/mo for Team
- Outputs the price IDs to copy into `.env`

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

async function setup() {
  // Create Pro product + price
  const pro = await stripe.products.create({
    name: 'QuiverDM Pro',
    description: 'Unlimited campaigns, 10 hrs transcription, 50 PDF uploads',
  });
  const proPrice = await stripe.prices.create({
    product: pro.id,
    unit_amount: 900, // $9.00
    currency: 'usd',
    recurring: { interval: 'month' },
  });

  // Create Team product + price
  const team = await stripe.products.create({
    name: 'QuiverDM Team',
    description: 'Unlimited campaigns, 30 hrs transcription, 200 PDF uploads',
  });
  const teamPrice = await stripe.prices.create({
    product: team.id,
    unit_amount: 1900, // $19.00
    currency: 'usd',
    recurring: { interval: 'month' },
  });

  console.log('Add these to your .env:');
  console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);
  console.log(`STRIPE_TEAM_PRICE_ID=${teamPrice.id}`);
}

setup().catch(console.error);
```

- Add a package.json script: `"setup:stripe": "tsx scripts/setup-stripe.ts"`
- The script should check if products already exist (search by name) before creating duplicates

### Task 2: Stripe Webhook Local Testing Setup

**What to do:**
- Create `scripts/stripe-webhook-local.sh` — a helper script to forward Stripe webhooks locally:

```bash
#!/bin/bash
# Forward Stripe webhooks to local dev server
# Requires: stripe CLI (https://stripe.com/docs/stripe-cli)
stripe listen --forward-to localhost:3847/api/webhooks/stripe
```

- Add instructions in a comment at the top explaining:
  1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe` (Mac) or download from stripe.com
  2. Login: `stripe login`
  3. Run the script — it prints the webhook signing secret
  4. Copy the `whsec_...` value to `.env` as `STRIPE_WEBHOOK_SECRET`

### Task 3: Pre-Launch Checklist Page (Optional)

**What to do:**
- Create `scripts/pre-launch-check.ts` — a script that verifies the app is ready for deployment
- Checks:
  - Database connection works (`prisma.$queryRaw`)
  - Redis connection works (connect + ping)
  - Required env vars are set (NEXTAUTH_SECRET, DATABASE_URL, REDIS_URL, STRIPE_SECRET_KEY, etc.)
  - Stripe products/prices exist (fetch by price ID)
  - At least 1 admin email configured (ADMIN_EMAILS)
  - At least 1 invite code exists in the database
- Outputs a pass/fail checklist to console
- Add script: `"check:launch": "tsx scripts/pre-launch-check.ts"`

### Task 4: Update CLAUDE.md with Final State

**What to do:**
- Read the current `CLAUDE.md` and update it to reflect the final state:
  - Router count: 20 tRPC routers (add billing)
  - Service count: 12+ services (add billing, email, invite)
  - Add billing/email to architecture diagram
  - Add Stripe env vars to the docs
  - Add `setup:stripe`, `check:launch` to dev commands table
  - Remove any references to "backend-only" — the app has 28+ frontend pages
  - Keep it under 200 lines

---

## Architecture Quick Reference

### File Structure (Final)
```
src/
├── app/
│   ├── page.tsx                    # Root redirect (auth → dashboard, unauth → signin)
│   ├── (app)/                      # 23 authenticated pages
│   │   ├── dashboard/
│   │   ├── campaigns/ (list, new, [slug] with sessions/npcs/members/homebrew/settings)
│   │   ├── characters/ (list, new, [id])
│   │   ├── homebrew/ (list, pdfs/)
│   │   ├── feedback/
│   │   ├── settings/               # API keys + usage + billing
│   │   ├── admin/invites/
│   │   ├── onboarding/
│   │   └── join/
│   ├── (auth)/auth/                # signin, signup, error
│   ├── (marketing)/                # landing, pricing
│   └── api/                        # auth, health, storage, uploads, webhooks/stripe, trpc
├── lib/
│   ├── auth.ts, prisma.ts, stripe.ts, email.ts, trpc.ts
│   ├── ai/, pdf/, queue/, storage/, transcription/
│   └── dndbeyond-api.ts, dndbeyond-character-mapper.ts
├── server/
│   ├── routers/ (20): campaigns, sessions, npcs, players, characters,
│   │   charactersDndBeyond, sessionTranscription, sessionRecordings,
│   │   transcript, homebrew, homebrewDndBeyond, homebrewPdf,
│   │   homebrewExtraction, userSettings, members, invites,
│   │   onboarding, feedback, usage, billing
│   ├── services/ (12+)
│   ├── repositories/ (9)
│   └── errors/ (8 typed error classes)
├── components/
│   ├── ui/ (shadcn components)
│   ├── campaign/ (context, layout)
│   ├── sidebar.tsx, onboarding-check.tsx, PDFProcessingProgress.tsx
│   └── ...
└── middleware.ts
```

### Key Patterns (same as previous handoffs)

**Error classes** — NO `new` on static factory methods:
```typescript
throw new NotFoundError('npc', id);               // with new
throw ForbiddenError.forPermission('edit', 'NPC'); // NO new
throw ValidationError.forField('name', 'Required'); // NO new
```

**Prisma Json fields** — use `Prisma.JsonNull` not `null`

**UI** — shadcn/ui components, Lucide icons, Tailwind theme tokens for dark mode

### Dev Commands
```bash
npm run dev              # http://localhost:3847
npm run dev:ws           # WebSocket server
npm run worker:pdf       # PDF worker
npx tsc --noEmit         # Type check (should be 0 errors)
npm run lint             # ESLint
npm run build            # Full production build
npm run db:push          # Push schema changes
npm run db:studio        # Prisma Studio
npm run generate-beta-invites  # Generate invite codes
```

### Environment Variables (Full List)
```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Auth
NEXTAUTH_URL=http://localhost:3847
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=QuiverDM <noreply@quiverdm.com>

# Search
MEILI_URL=http://localhost:7701
MEILI_MASTER_KEY=...

# AI
OLLAMA_BASE_URL=http://localhost:11434

# Admin
ADMIN_EMAILS=your@email.com

# Storage
STORAGE_MODE=local
```

---

## Parallel Execution Strategy

- **Agent A**: Task 1 (Stripe setup script) — new file
- **Agent B**: Task 2 (Webhook local testing) — new file
- **Agent C**: Task 3 (Pre-launch check script) — new file
- **Agent D**: Task 4 (Update CLAUDE.md) — modify existing file

All tasks are independent.

---

## Build Verification

```bash
npx tsc --noEmit   # Should be 0 errors
npm run lint        # Should pass
npm run build       # Full production build
```

## After This Handoff

**The app is ready to deploy.** The only remaining steps are manual:

1. Run `npm run setup:stripe` with your Stripe test key
2. Run `stripe listen --forward-to localhost:3847/api/webhooks/stripe` for local testing
3. Test the full flow: signup → onboarding → create campaign → upload PDF → upgrade to Pro
4. Run `npm run check:launch` to verify everything
5. Set up Railway project and deploy
6. Connect domain
7. Generate beta invite codes and invite first users
