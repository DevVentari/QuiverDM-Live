# CLAUDE.md

Guidance for coding agents working in `E:\Projects\QuiverDM`.

## Project Overview
AI-powered D&D session management app. Beta launch target: March 2026. Live at https://app.nerdt.au.
29 tRPC routers, 12+ services, 9 repositories. App Router (pages + API routes).

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

## Local Services

| Service | Port | Purpose |
| --- | --- | --- |
| PostgreSQL (pgvector) | 5433 | Primary database — pgvector extension required |
| Redis | 6380 | BullMQ queue + caching |
| MeiliSearch | 7701 | Full-text search |
| Docling | 5001 | PDF-to-markdown conversion |
| Ollama | 11434 | Local LLM for AI features |

## Dev Commands

```bash
npm run dev                # Next.js on http://localhost:3847
npm run dev:ws             # WebSocket server
npm run worker:pdf         # PDF processing worker
npm run worker:transcription   # Transcription worker
npm run worker:summary     # AI session summary worker
npm run worker:embeddings  # Narrative search embeddings worker
npm run worker:image       # Image generation worker
npm run worker:webhooks    # Outbound webhooks worker
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
  routers/                       # 29 routers
  services/                      # 12+ services
  repositories/                  # 9 repositories
  errors/                        # Typed app errors
  trpc.ts                        # tRPC init + procedures
```

### Router List (29)

- campaigns, sessions, npcs, players
- characters, charactersDndBeyond
- sessionTranscription, sessionRecordings, transcript
- homebrew, homebrewDndBeyond, homebrewPdf, homebrewExtraction, homebrewImage
- userSettings, members, invites, onboarding, feedback
- usage, billing, passwordReset
- encounters, encounterPlans
- rules, webhooks, search, whisper
- foundry

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
DOCLING_URL=
OLLAMA_BASE_URL=
```

## Operational Notes

- Local build may fail if Stripe environment variables are missing.
- `scripts/stripe-webhook-local.sh` forwards Stripe events during local testing.
- `npm run check:launch` performs DB/Redis/env/Stripe/invite readiness checks.

## Definition of Done

A feature is not shipped until it has a workflow spec.

- New feature → write `tests/workflows/<feature>.workflow.spec.ts` before or alongside the PR
- New user journey → implement or update the relevant `tests/personas/*.persona.spec.ts`
- Run `npm run qa:cycle` and it must pass before merging to main
- No `test.fixme` on new tests — stubs must be implemented before the feature is considered done

**Persona specs are the acceptance gate.** When all 6 personas pass, QuiverDM is ready for that tier of users:
- `new-dm` (Nora) — onboarding, first campaign, first NPC
- `veteran-dm` (Vic) — rapid prep, full stat block NPC, session surfaces
- `power-dm` (Dana) — PDF upload, homebrew create/link, character sheet tabs
- `player-join` — invite accept, character access, campaign surfaces
- `mobile-dm` — critical flows on phone viewport
- `error-resilience` — API failures surface clean errors, not crashes

## Task Tracking

Kanban board lives at `docs/obsidian-vault/KANBAN.md` (Obsidian Kanban plugin format).

- **Check it** when starting new feature work to pick up the next task
- **Update it** when completing a feature (move card to Done) or starting work (move to In Progress)
- Columns: Backlog → In Progress → Review → Done

## Skills

Project skills live in `.claude/skills/` and are auto-loaded. Available: `quiverdm-worker`, `quiverdm-repository`, `quiverdm-auth`, `homebrew-schema`, `trpc-architect`, `pipeline-debugger`, `d5e-rules`.

**Build a new skill when:**
- You implement the same pattern a 2nd time (worker, repo, auth procedure, etc.)
- A pattern has subtle mistakes that keep recurring (wrong queue name, missing `maxRetriesPerRequest`, etc.)
- Saving the pattern would meaningfully reduce context usage on future tasks

Skills go in `.claude/skills/<name>/SKILL.md` and are immediately available.

## Codex Delegation

Use the `codex-router` skill to decide what to delegate. Claude = architect/reviewer. Codex = pattern-following implementation.

## File Placement

Keep the project root clean. Use these locations:

| File type | Where it goes |
|-----------|---------------|
| Codex handoff docs | `docs/codex-handoffs/` (gitignored, delete after shipping) |
| Screenshots / UI captures | `docs/screenshots/` (gitignored) |
| Implementation plans | `docs/plans/YYYY-MM-DD-<topic>-impl.md` |
| Design docs | `docs/plans/YYYY-MM-DD-<topic>-design.md` |
| Temp / scratch files | Delete when done — never commit to root |

## Design System

### Vibe
- Dark, atmospheric, immersive — this is a D&D tool, not a SaaS dashboard
- Inspiration: Baldur's Gate 3 character sheets, D&D Beyond but with more depth and atmosphere
- Color mood: Deep indigo-blacks, warm amber/gold primary, parchment-toned accents
- Feel: Like opening an ancient tome in a candlelit room

### Typography
- Display: Use a distinctive serif or display font for headings — never Inter/Arial/Roboto for display text
- Body: System font stack or a clean sans-serif — readability is critical for long stat blocks
- Mono: JetBrains Mono for dice rolls, stat values, and code-like content

### Colors
- All colors via CSS variables in `globals.css` — never hardcode hex values
- Primary: warm amber/gold (oklch 0.65 0.16 55) — used for CTAs, active states, important highlights
- Background: deep indigo-black with layered card surfaces for depth
- Cards use subtle transparency (oklch with alpha) for glass-like depth
- Destructive: muted red, not alarming — D&D is about adventure, not enterprise warnings

### Components
- ALWAYS use shadcn/ui components from `src/components/ui/`
- Use the shadcn MCP server to verify correct props and patterns
- Animations via Framer Motion for page transitions, card reveals, dice rolls
- Minimum touch target: 44x44px (mobile DMs at the table)
- Dark mode is the default and primary experience

### Anti-Patterns
- No generic "AI slop" aesthetic — be distinctive and creative
- No bright white backgrounds — dark mode is king
- No flat, single-color cards — use layered shadows and subtle borders for depth
- No cookie-cutter layouts — asymmetry and negative space are tools, use them
- No purple gradients on white — this isn't a startup landing page
- Research how BG3, D&D Beyond, and Roll20 handle specific UI patterns before building

## Maintenance

Keep this file synced with architecture changes (router count, scripts, and deployment-critical flows).
