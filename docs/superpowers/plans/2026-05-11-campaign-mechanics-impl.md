# Campaign Mechanics + Compendium Sync Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `CampaignMechanic` model (RotFM secrets + CoS Tarokka), a dedicated `/campaigns/[slug]/mechanics` page that mirrors the NPCs/Compendium layout, and extend the DDB chapter extractor so the Compendium's Spells + Feats tabs stop returning empty.

**Architecture:** New Prisma model with stable `externalKey` for idempotent re-sync. Open-string `kind` field (MVP recognises `'secret'` + `'tarot'`). tRPC router with service-layer strip-down for `hiddenTruth` based on viewer identity. Mechanics page reuses the existing `EntityCard` + filter rail + right-side Sheet pattern. Two hand-fed seed scripts (`scripts/seed-mechanics-rotfm.ts`, `scripts/seed-mechanics-cos.ts`) for MVP content. DDB extractor gains two new Zod schemas (`SpellSchema`, `FeatSchema`) merged into `ChapterExtractionSchema`; worker writes spell/feat rows into `HomebrewContent` alongside the existing item/monster writes.

**Tech Stack:** Next.js 15, tRPC v11, Prisma + PostgreSQL, Zod, BullMQ, Tailwind + shadcn/ui + Lucide, V2 primitives (`EntityCard`, shadcn `Sheet`).

---

## File Structure

**New files:**
- `prisma/schema.prisma` — additions only (model + reverse relations)
- `src/lib/mechanics-content.ts` — TS types + Zod schemas for `content` JSON per `kind`
- `src/server/services/campaign-mechanics.service.ts` — strip-down + assignment + reveal
- `src/server/routers/campaign-mechanics.ts` — tRPC router
- `src/app/(app)/campaigns/[slug]/mechanics/page.tsx` — the page
- `src/components/mechanics/mechanic-card.tsx` — `EntityCard` wrapper for mechanics
- `src/components/mechanics/mechanic-filter-rail.tsx` — filter rail
- `src/components/mechanics/mechanic-inspector.tsx` — Sheet content (per-kind detail view)
- `src/components/mechanics/mechanic-create-sheet.tsx` — DM-only create flow
- `scripts/seed-mechanics-rotfm.ts`
- `scripts/seed-mechanics-cos.ts`
- `tests/workflows/mechanics.workflow.spec.ts`
- `src/server/services/__tests__/campaign-mechanics.service.test.ts`
- `src/lib/ai/__tests__/extract-spells.test.ts`
- `src/lib/ai/__tests__/extract-feats.test.ts`

**Modified files:**
- `src/server/routers/_app.ts` — register the new router
- `src/components/shell/CommandRail.tsx` — add the Mechanics nav entry
- `src/lib/ai/extract-chapter-entities.ts` — add `SpellSchema`, `FeatSchema`, extend `ChapterExtractionSchema`, expand the extraction prompt
- `src/lib/queue/ddb-write-sink.ts` — add `upsertSpell` + `upsertFeat`
- `src/lib/queue/ddb-chapter-extract.ts` — call the new sink methods for the extracted spells/feats

---

## Task 1: Schema additions

**Files:**
- Modify: `prisma/schema.prisma` (Campaign model + CampaignCharacter model + new CampaignMechanic model)

- [ ] **Step 1: Add the `CampaignMechanic` model**

Append this block to `prisma/schema.prisma` (after the `CampaignContext` model — search for `model CampaignContext` and add below it):

```prisma
model CampaignMechanic {
  id          String   @id @default(cuid())
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  kind        String
  sourcebook  String?
  externalKey String?

  name        String
  description String?  @db.Text
  content     Json

  assignedToCharacterId String?
  assignedToCharacter   CampaignCharacter? @relation("AssignedMechanics", fields: [assignedToCharacterId], references: [id], onDelete: SetNull)
  revealedAtSessionId   String?
  playerVisible         Boolean @default(false)

  ddbChapterId String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([campaignId, kind, externalKey])
  @@index([campaignId, kind])
  @@index([sourcebook, kind])
  @@index([assignedToCharacterId])
}
```

- [ ] **Step 2: Add reverse relation on `Campaign`**

In `model Campaign`, find the relations block (other `*[] @relation(...)` lines like `gameSessions GameSession[]`) and add:

```prisma
mechanics            CampaignMechanic[]
```

- [ ] **Step 3: Add reverse relation on `CampaignCharacter`**

In `model CampaignCharacter` (line ~538), add:

```prisma
assignedMechanics    CampaignMechanic[] @relation("AssignedMechanics")
```

- [ ] **Step 4: Push the migration to the homelab DB**

Per `memory/feedback_prisma_db_push_wrong_db.md`, `prisma db push` reads only `.env`, so we use `db execute` with the homelab URL. Run:

```bash
HOMELAB_URL=$(grep -E "^DATABASE_URL=" .env.local | cut -d= -f2- | sed 's/^"//;s/"$//')
npx prisma generate
npx prisma db push --skip-generate --accept-data-loss --schema=prisma/schema.prisma
```

Actually `db push` doesn't read `.env.local`; the safest sequence is:

```bash
HOMELAB_URL=$(grep -E "^DATABASE_URL=" .env.local | cut -d= -f2- | sed 's/^"//;s/"$//')
DATABASE_URL="$HOMELAB_URL" npx prisma db push --skip-generate
npx prisma generate
```

Expected: Prisma announces the new table and indexes; existing data untouched.

- [ ] **Step 5: Verify the table**

```bash
DB_URL=$(grep -E "^DATABASE_URL=" .env.local | cut -d= -f2- | sed 's/^"//;s/"$//')
docker run --rm postgres:16 psql "$DB_URL" -c "\d \"CampaignMechanic\"" 2>&1 | tail -20
```

Expected: lists `id, campaignId, kind, sourcebook, externalKey, name, description, content, assignedToCharacterId, revealedAtSessionId, playerVisible, ddbChapterId, createdAt, updatedAt` plus the three indexes and the unique constraint.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add CampaignMechanic model for sourcebook-specific gameplay aids"
git push origin main
```

---

## Task 2: Content schemas (TS + Zod)

**Files:**
- Create: `src/lib/mechanics-content.ts`

- [ ] **Step 1: Write the Zod schemas**

Create `src/lib/mechanics-content.ts`:

```ts
import { z } from 'zod'

export const SecretContentSchema = z.object({
  flavorText: z.string().min(1),
  hiddenTruth: z.string().min(1),
  mechanicalEffect: z.string().optional(),
})

export type SecretContent = z.infer<typeof SecretContentSchema>

export const TarokkaSuitEnum = z.enum(['high', 'swords', 'stars', 'glyphs', 'coins'])
export const TarokkaPositionEnum = z.enum([
  'history',
  'ally',
  'enemy',
  'item',
  'final-battle-location',
])

export const TarotContentSchema = z.object({
  cardName: z.string().min(1),
  suit: TarokkaSuitEnum,
  artUrl: z.string().url().optional(),
  divinationPosition: TarokkaPositionEnum,
  interpretation: z.string().min(1),
})

export type TarotContent = z.infer<typeof TarotContentSchema>

export type MechanicKind = 'secret' | 'tarot'

/** Pick the right Zod schema for a given kind. Throws on unknown kinds. */
export function contentSchemaFor(kind: string) {
  if (kind === 'secret') return SecretContentSchema
  if (kind === 'tarot') return TarotContentSchema
  throw new Error(`Unknown mechanic kind: ${kind}`)
}

/** Strip the DM-only fields from content based on viewer privilege. */
export function stripHiddenContent(kind: string, content: unknown, viewerCanSeeHidden: boolean): unknown {
  if (viewerCanSeeHidden) return content
  if (kind === 'secret') {
    const parsed = SecretContentSchema.safeParse(content)
    if (!parsed.success) return content
    const { hiddenTruth: _strip, ...rest } = parsed.data
    return rest
  }
  // Tarot has no hidden fields today — return as-is.
  return content
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep mechanics-content
```

Expected: empty (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/mechanics-content.ts
git commit -m "feat(mechanics): Zod schemas for secret + tarot content shapes"
git push origin main
```

---

## Task 3: Mechanics service with strip-down

**Files:**
- Create: `src/server/services/campaign-mechanics.service.ts`
- Create: `src/server/services/__tests__/campaign-mechanics.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/services/__tests__/campaign-mechanics.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stripHiddenContent } from '@/lib/mechanics-content';

describe('stripHiddenContent', () => {
  it('returns full content for DM viewer', () => {
    const content = { flavorText: 'You are a spy', hiddenTruth: 'You serve Asmodeus' };
    expect(stripHiddenContent('secret', content, true)).toEqual(content);
  });

  it('strips hiddenTruth for non-DM viewer', () => {
    const content = { flavorText: 'You are a spy', hiddenTruth: 'You serve Asmodeus' };
    const result = stripHiddenContent('secret', content, false) as Record<string, unknown>;
    expect(result.flavorText).toBe('You are a spy');
    expect(result.hiddenTruth).toBeUndefined();
  });

  it('passes tarot content through unchanged for non-DM (no hidden fields)', () => {
    const content = { cardName: 'The Tower', suit: 'high', divinationPosition: 'final-battle-location', interpretation: 'Castle Ravenloft' };
    expect(stripHiddenContent('tarot', content, false)).toEqual(content);
  });
});
```

- [ ] **Step 2: Run the test to verify the import works**

```bash
npx vitest run src/server/services/__tests__/campaign-mechanics.service.test.ts
```

Expected: all 3 tests PASS (the function lives in `src/lib/mechanics-content.ts` from Task 2).

- [ ] **Step 3: Write the service**

Create `src/server/services/campaign-mechanics.service.ts`:

```ts
import { prisma } from '@/lib/prisma';
import { authz } from './authorization.service';
import { NotFoundError, ValidationError } from '../errors';
import { contentSchemaFor, stripHiddenContent } from '@/lib/mechanics-content';

interface ListInput {
  campaignId: string;
  kind?: string;
  sourcebook?: string;
}

interface CreateInput {
  campaignId: string;
  kind: string;
  name: string;
  description?: string;
  content: unknown;
  sourcebook?: string;
  externalKey?: string;
  playerVisible?: boolean;
}

interface UpdateInput {
  id: string;
  name?: string;
  description?: string;
  content?: unknown;
  playerVisible?: boolean;
}

async function viewerCanSeeHidden(
  mechanic: { campaignId: string; assignedToCharacterId: string | null; playerVisible: boolean },
  userId: string,
): Promise<boolean> {
  const access = await authz.campaign(mechanic.campaignId, userId).verify();
  if (access.isDM) return true;
  if (!mechanic.assignedToCharacterId || !mechanic.playerVisible) return false;
  const ownsCharacter = await prisma.campaignCharacter.findFirst({
    where: { id: mechanic.assignedToCharacterId, userId },
    select: { id: true },
  });
  return !!ownsCharacter;
}

export const campaignMechanicsService = {
  async list({ campaignId, kind, sourcebook }: ListInput, userId: string) {
    const access = await authz.campaign(campaignId, userId).verify();
    const rows = await prisma.campaignMechanic.findMany({
      where: {
        campaignId,
        ...(kind ? { kind } : {}),
        ...(sourcebook ? { sourcebook } : {}),
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => ({
      ...row,
      content: stripHiddenContent(row.kind, row.content, access.isDM),
    }));
  },

  async getById(id: string, userId: string) {
    const row = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('campaignMechanic', id);
    const canSeeHidden = await viewerCanSeeHidden(row, userId);
    return { ...row, content: stripHiddenContent(row.kind, row.content, canSeeHidden) };
  },

  async create(input: CreateInput, userId: string) {
    await authz.campaign(input.campaignId, userId).requireDM();
    const schema = contentSchemaFor(input.kind);
    const parsed = schema.safeParse(input.content);
    if (!parsed.success) {
      throw ValidationError.forField('content', `Invalid content shape for kind '${input.kind}': ${parsed.error.message}`);
    }
    return prisma.campaignMechanic.create({
      data: {
        campaignId: input.campaignId,
        kind: input.kind,
        name: input.name,
        description: input.description ?? null,
        content: parsed.data as object,
        sourcebook: input.sourcebook ?? null,
        externalKey: input.externalKey ?? null,
        playerVisible: input.playerVisible ?? false,
      },
    });
  },

  async update({ id, ...patch }: UpdateInput, userId: string) {
    const existing = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('campaignMechanic', id);
    await authz.campaign(existing.campaignId, userId).requireDM();

    let nextContent = existing.content;
    if (patch.content !== undefined) {
      const schema = contentSchemaFor(existing.kind);
      const parsed = schema.safeParse(patch.content);
      if (!parsed.success) {
        throw ValidationError.forField('content', `Invalid content shape: ${parsed.error.message}`);
      }
      nextContent = parsed.data as object;
    }

    return prisma.campaignMechanic.update({
      where: { id },
      data: {
        name: patch.name ?? existing.name,
        description: patch.description ?? existing.description,
        content: nextContent as object,
        playerVisible: patch.playerVisible ?? existing.playerVisible,
      },
    });
  },

  async delete(id: string, userId: string) {
    const existing = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('campaignMechanic', id);
    await authz.campaign(existing.campaignId, userId).requireDM();
    await prisma.campaignMechanic.delete({ where: { id } });
    return { ok: true };
  },

  async assignToCharacter(id: string, characterId: string | null, userId: string) {
    const existing = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('campaignMechanic', id);
    await authz.campaign(existing.campaignId, userId).requireDM();
    if (characterId) {
      const character = await prisma.campaignCharacter.findFirst({
        where: { id: characterId, campaignId: existing.campaignId },
        select: { id: true },
      });
      if (!character) {
        throw new NotFoundError('campaignCharacter', characterId);
      }
    }
    return prisma.campaignMechanic.update({
      where: { id },
      data: { assignedToCharacterId: characterId },
    });
  },

  async markRevealed(id: string, sessionId: string, userId: string) {
    const existing = await prisma.campaignMechanic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('campaignMechanic', id);
    await authz.campaign(existing.campaignId, userId).requireDM();
    return prisma.campaignMechanic.update({
      where: { id },
      data: { revealedAtSessionId: sessionId, playerVisible: true },
    });
  },
};
```

- [ ] **Step 4: Verify `authz.campaign(...).requireDM()` exists**

```bash
grep -n "requireDM\|isDM" src/server/services/authorization.service.ts | head -5
```

Expected: at least one `requireDM` reference. If it's named differently (e.g., `verify({ requireDM: true })`), adjust the service calls accordingly before continuing.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "campaign-mechanics.service|mechanics-content" | head -10
```

Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mechanics-content.ts src/server/services/campaign-mechanics.service.ts src/server/services/__tests__/campaign-mechanics.service.test.ts
git commit -m "feat(mechanics): service layer with hiddenTruth strip-down and assignment"
git push origin main
```

---

## Task 4: tRPC router

**Files:**
- Create: `src/server/routers/campaign-mechanics.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Write the router**

Create `src/server/routers/campaign-mechanics.ts`:

```ts
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { campaignMechanicsService } from '../services/campaign-mechanics.service';

export const campaignMechanicsRouter = router({
  list: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      kind: z.string().optional(),
      sourcebook: z.string().optional(),
    }))
    .query(({ input, ctx }) => campaignMechanicsService.list(input, ctx.session.user.id)),

  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input, ctx }) => campaignMechanicsService.getById(input.id, ctx.session.user.id)),

  create: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      kind: z.string().min(1),
      name: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      content: z.any(),
      sourcebook: z.string().max(64).optional(),
      externalKey: z.string().max(128).optional(),
      playerVisible: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) => campaignMechanicsService.create(input, ctx.session.user.id)),

  update: protectedProcedure
    .input(z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(2000).optional(),
      content: z.any().optional(),
      playerVisible: z.boolean().optional(),
    }))
    .mutation(({ input, ctx }) => campaignMechanicsService.update(input, ctx.session.user.id)),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input, ctx }) => campaignMechanicsService.delete(input.id, ctx.session.user.id)),

  assignToCharacter: protectedProcedure
    .input(z.object({
      id: z.string().min(1),
      characterId: z.string().min(1).nullable(),
    }))
    .mutation(({ input, ctx }) =>
      campaignMechanicsService.assignToCharacter(input.id, input.characterId, ctx.session.user.id),
    ),

  markRevealed: protectedProcedure
    .input(z.object({ id: z.string().min(1), sessionId: z.string().min(1) }))
    .mutation(({ input, ctx }) =>
      campaignMechanicsService.markRevealed(input.id, input.sessionId, ctx.session.user.id),
    ),
});
```

- [ ] **Step 2: Register the router**

In `src/server/routers/_app.ts`, find the existing `appRouter = router({ ... })` block and:

1. Import: `import { campaignMechanicsRouter } from './campaign-mechanics';`
2. Add to the router object: `mechanics: campaignMechanicsRouter,`

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "campaign-mechanics|_app" | head -10
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/campaign-mechanics.ts src/server/routers/_app.ts
git commit -m "feat(mechanics): tRPC router (list/getById/create/update/delete/assign/reveal)"
git push origin main
```

---

## Task 5: Mechanic card component

**Files:**
- Create: `src/components/mechanics/mechanic-card.tsx`

- [ ] **Step 1: Write the card**

Create `src/components/mechanics/mechanic-card.tsx`:

```tsx
'use client'

import { Eye, Sparkles, EyeOff } from 'lucide-react'
import { EntityCard, type EntityCardBadge } from '@/components/primitives/EntityCard'

export interface MechanicCardData {
  id: string
  kind: string
  name: string
  description?: string | null
  sourcebook?: string | null
  playerVisible: boolean
  assignedToCharacterId?: string | null
  content?: Record<string, unknown> | null
}

interface MechanicCardProps {
  mechanic: MechanicCardData
  assignedCharacterName?: string | null
  onClick: () => void
}

function kindBadge(kind: string, sourcebook: string | null | undefined): EntityCardBadge {
  if (sourcebook) return { label: sourcebook.toUpperCase() }
  return { label: kind === 'secret' ? 'SECRET' : kind === 'tarot' ? 'TAROT' : kind.toUpperCase() }
}

function fallbackIcon(kind: string) {
  if (kind === 'secret') return <Eye size={32} />
  if (kind === 'tarot') return <Sparkles size={32} />
  return <Sparkles size={32} />
}

function flavorPreview(content: Record<string, unknown> | null | undefined): string | null {
  if (!content) return null
  if (typeof content.flavorText === 'string') return content.flavorText
  if (typeof content.interpretation === 'string') return content.interpretation
  return null
}

export function MechanicCard({ mechanic, assignedCharacterName, onClick }: MechanicCardProps) {
  const description = mechanic.description ?? flavorPreview(mechanic.content)
  const subtitle = (
    <>
      {!mechanic.playerVisible && (
        <span className="inline-flex items-center gap-1 truncate">
          <EyeOff size={10} className="shrink-0" />
          <span>Hidden</span>
        </span>
      )}
      {assignedCharacterName && (
        <>
          {!mechanic.playerVisible && <span className="text-[var(--q-border-subtle)]">·</span>}
          <span className="truncate">Assigned to {assignedCharacterName}</span>
        </>
      )}
    </>
  )

  return (
    <EntityCard
      imageUrl={null}
      imageFallback={fallbackIcon(mechanic.kind)}
      title={mechanic.name}
      badge={kindBadge(mechanic.kind, mechanic.sourcebook)}
      subtitle={(!mechanic.playerVisible || assignedCharacterName) ? subtitle : null}
      description={description}
      onClick={onClick}
      testId={`mechanic-card-${mechanic.id}`}
    />
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep mechanic-card | head -5
```

Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add src/components/mechanics/mechanic-card.tsx
git commit -m "feat(mechanics): MechanicCard component built on EntityCard primitive"
git push origin main
```

---

## Task 6: Filter rail + inspector + create sheet

**Files:**
- Create: `src/components/mechanics/mechanic-filter-rail.tsx`
- Create: `src/components/mechanics/mechanic-inspector.tsx`
- Create: `src/components/mechanics/mechanic-create-sheet.tsx`

- [ ] **Step 1: Write the filter rail**

Create `src/components/mechanics/mechanic-filter-rail.tsx`:

```tsx
'use client'

import { Eye, Sparkles, Plus, Search, Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type MechanicKindFilter = 'all' | 'secret' | 'tarot'

interface MechanicFilterRailProps {
  kindFilter: MechanicKindFilter
  onKindFilterChange: (k: MechanicKindFilter) => void
  sourcebookFilter: string | null
  onSourcebookFilterChange: (s: string | null) => void
  sourcebooks: string[]
  search: string
  onSearchChange: (s: string) => void
  counts: { all: number; secret: number; tarot: number }
  isDM: boolean
  onCreate: () => void
}

const KIND_OPTIONS: Array<{ id: MechanicKindFilter; label: string; icon: typeof Layers; countKey: keyof MechanicFilterRailProps['counts'] }> = [
  { id: 'all',    label: 'All mechanics', icon: Layers,   countKey: 'all' },
  { id: 'secret', label: 'Secrets',       icon: Eye,      countKey: 'secret' },
  { id: 'tarot',  label: 'Tarokka',       icon: Sparkles, countKey: 'tarot' },
]

export function MechanicFilterRail({
  kindFilter, onKindFilterChange,
  sourcebookFilter, onSourcebookFilterChange, sourcebooks,
  search, onSearchChange, counts, isDM, onCreate,
}: MechanicFilterRailProps) {
  return (
    <aside className="flex flex-col gap-5 w-full">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--q-text-faint)]" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search mechanics"
          className="h-9 pl-9 text-sm"
          data-testid="mechanic-filter-search"
        />
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)] mb-2">Filter by kind</p>
        {KIND_OPTIONS.map(({ id, label, icon: Icon, countKey }) => {
          const active = kindFilter === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onKindFilterChange(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                  : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
              )}
              data-testid={`mechanic-filter-${id}`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              <span className={cn('tabular-nums text-[10px]', active ? 'text-[var(--q-amber)]' : 'text-[var(--q-text-faint)]')}>
                {counts[countKey]}
              </span>
            </button>
          )
        })}
      </div>

      {sourcebooks.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)] mb-2">Filter by sourcebook</p>
          <button
            type="button"
            onClick={() => onSourcebookFilterChange(null)}
            className={cn(
              'flex w-full items-center rounded-sm px-3 py-1.5 text-sm transition-colors',
              sourcebookFilter === null
                ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
            )}
          >
            <span className="flex-1 text-left">All sourcebooks</span>
          </button>
          {sourcebooks.map((s) => {
            const active = sourcebookFilter === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSourcebookFilterChange(active ? null : s)}
                className={cn(
                  'flex w-full items-center rounded-sm px-3 py-1.5 text-sm transition-colors uppercase tracking-[1.5px] text-[10px]',
                  active
                    ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                    : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
                )}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}

      {isDM && (
        <div className="pt-2 border-t border-[var(--q-border-subtle)]">
          <Button onClick={onCreate} size="sm" className="w-full justify-start" data-testid="mechanic-create-trigger">
            <Plus size={14} className="mr-2" />
            New Mechanic
          </Button>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 2: Write the inspector**

Create `src/components/mechanics/mechanic-inspector.tsx`:

```tsx
'use client'

import { trpc } from '@/lib/trpc'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/primitives'

interface MechanicInspectorProps {
  mechanicId: string
  campaignId: string
  isDM: boolean
}

export function MechanicInspector({ mechanicId, campaignId, isDM }: MechanicInspectorProps) {
  const utils = trpc.useUtils()
  const mechanic = trpc.mechanics.getById.useQuery({ id: mechanicId }, { staleTime: 60_000 })
  const characters = trpc.characters?.listForCampaign?.useQuery
    ? trpc.characters.listForCampaign.useQuery({ campaignId }, { staleTime: 120_000 })
    : { data: [] as Array<{ id: string; name: string }> } as any

  const assign = trpc.mechanics.assignToCharacter.useMutation({
    onSuccess: () => {
      void utils.mechanics.getById.invalidate({ id: mechanicId })
      void utils.mechanics.list.invalidate({ campaignId })
    },
  })

  const togglePlayerVisible = trpc.mechanics.update.useMutation({
    onSuccess: () => {
      void utils.mechanics.getById.invalidate({ id: mechanicId })
      void utils.mechanics.list.invalidate({ campaignId })
    },
  })

  if (mechanic.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (mechanic.isError || !mechanic.data) {
    return <div className="p-6 text-sm text-[var(--q-text-dim)]">Failed to load mechanic.</div>
  }

  const m = mechanic.data
  const content = (m.content ?? {}) as Record<string, unknown>

  return (
    <div className="flex h-full flex-col">
      <header className="p-6 border-b border-[var(--q-border-subtle)] space-y-3">
        <p className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase">
          {m.kind === 'secret' ? 'Secret' : m.kind === 'tarot' ? 'Tarokka card' : m.kind}
          {m.sourcebook ? ` · ${m.sourcebook.toUpperCase()}` : ''}
        </p>
        <h2 className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)]">{m.name}</h2>
        <div className="flex flex-wrap gap-2">
          <Pill variant={m.playerVisible ? 'info' : 'neutral'}>
            {m.playerVisible ? 'Visible to players' : 'DM only'}
          </Pill>
          {m.assignedToCharacterId && <Pill variant="neutral">Assigned</Pill>}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {m.kind === 'secret' && (
          <SecretBody content={content} isDM={isDM} />
        )}
        {m.kind === 'tarot' && (
          <TarotBody content={content} />
        )}

        {isDM && (
          <div className="space-y-3 pt-4 border-t border-[var(--q-border-subtle)]">
            <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">DM controls</p>
            <div className="flex flex-col gap-2">
              <select
                value={m.assignedToCharacterId ?? ''}
                onChange={(e) => assign.mutate({ id: m.id, characterId: e.target.value || null })}
                className="rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)] px-3 py-2 text-sm text-[var(--q-text)]"
                data-testid="mechanic-assign-select"
              >
                <option value="">Unassigned</option>
                {(characters.data ?? []).map((c: { id: string; name: string }) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => togglePlayerVisible.mutate({ id: m.id, playerVisible: !m.playerVisible })}
                data-testid="mechanic-toggle-visible"
              >
                {m.playerVisible ? 'Hide from players' : 'Reveal to players'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SecretBody({ content, isDM }: { content: Record<string, unknown>; isDM: boolean }) {
  return (
    <>
      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">Flavor</p>
        <p className="text-sm text-[var(--q-text)] leading-relaxed">
          {String(content.flavorText ?? '')}
        </p>
      </section>
      {isDM && typeof content.hiddenTruth === 'string' && (
        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-amber)]">DM-only · Hidden truth</p>
          <p className="text-sm text-[var(--q-text)] leading-relaxed">{content.hiddenTruth}</p>
        </section>
      )}
      {typeof content.mechanicalEffect === 'string' && (
        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">Mechanical effect</p>
          <p className="text-sm text-[var(--q-text-dim)]">{content.mechanicalEffect}</p>
        </section>
      )}
    </>
  )
}

function TarotBody({ content }: { content: Record<string, unknown> }) {
  return (
    <>
      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          {String(content.cardName ?? '')} · {String(content.suit ?? '')}
        </p>
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          Position: {String(content.divinationPosition ?? '')}
        </p>
      </section>
      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">Interpretation</p>
        <p className="text-sm text-[var(--q-text)] leading-relaxed">{String(content.interpretation ?? '')}</p>
      </section>
    </>
  )
}
```

- [ ] **Step 3: Write the create sheet**

Create `src/components/mechanics/mechanic-create-sheet.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/lib/trpc'

interface MechanicCreateSheetProps {
  campaignId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}

export function MechanicCreateSheet({ campaignId, open, onOpenChange, onCreated }: MechanicCreateSheetProps) {
  const utils = trpc.useUtils()
  const [kind, setKind] = useState<'secret' | 'tarot'>('secret')
  const [name, setName] = useState('')
  const [flavorText, setFlavorText] = useState('')
  const [hiddenTruth, setHiddenTruth] = useState('')
  const [cardName, setCardName] = useState('')
  const [interpretation, setInterpretation] = useState('')

  const create = trpc.mechanics.create.useMutation({
    onSuccess: (m) => {
      void utils.mechanics.list.invalidate({ campaignId })
      onCreated?.(m.id)
      onOpenChange(false)
      setName(''); setFlavorText(''); setHiddenTruth(''); setCardName(''); setInterpretation('')
    },
  })

  function submit() {
    if (!name.trim()) return
    if (kind === 'secret') {
      create.mutate({
        campaignId, kind, name,
        content: { flavorText, hiddenTruth },
      })
    } else {
      create.mutate({
        campaignId, kind, name,
        content: { cardName, suit: 'high', divinationPosition: 'history', interpretation },
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New mechanic</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div className="space-y-1">
            <label className="text-xs text-[var(--q-text-faint)]">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'secret' | 'tarot')}
              className="w-full rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)] px-3 py-2 text-sm text-[var(--q-text)]"
            >
              <option value="secret">Secret</option>
              <option value="tarot">Tarokka card</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--q-text-faint)]">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Glasstaff's secret" />
          </div>
          {kind === 'secret' ? (
            <>
              <div className="space-y-1">
                <label className="text-xs text-[var(--q-text-faint)]">Flavor text (player-facing)</label>
                <Textarea value={flavorText} onChange={(e) => setFlavorText(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--q-amber)]">Hidden truth (DM-only)</label>
                <Textarea value={hiddenTruth} onChange={(e) => setHiddenTruth(e.target.value)} rows={3} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs text-[var(--q-text-faint)]">Card name</label>
                <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="The Tower" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--q-text-faint)]">Interpretation</label>
                <Textarea value={interpretation} onChange={(e) => setInterpretation(e.target.value)} rows={3} />
              </div>
            </>
          )}
          <Button onClick={submit} disabled={create.isLoading || !name.trim()} className="w-full">
            {create.isLoading ? 'Creating…' : 'Create mechanic'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "mechanic-" | head -10
```

Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add src/components/mechanics/
git commit -m "feat(mechanics): filter rail + inspector + create sheet"
git push origin main
```

---

## Task 7: Mechanics page route

**Files:**
- Create: `src/app/(app)/campaigns/[slug]/mechanics/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/(app)/campaigns/[slug]/mechanics/page.tsx`:

```tsx
'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { useCampaign } from '@/components/campaign/campaign-context'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles } from 'lucide-react'
import { MechanicCard } from '@/components/mechanics/mechanic-card'
import { MechanicFilterRail, type MechanicKindFilter } from '@/components/mechanics/mechanic-filter-rail'
import { MechanicInspector } from '@/components/mechanics/mechanic-inspector'
import { MechanicCreateSheet } from '@/components/mechanics/mechanic-create-sheet'

export default function MechanicsPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-220px)] animate-pulse bg-white/5" />}>
      <MechanicsPageInner />
    </Suspense>
  )
}

function MechanicsPageInner() {
  const { campaignId, isDM } = useCampaign()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<MechanicKindFilter>('all')
  const [sourcebookFilter, setSourcebookFilter] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === 'true')
  const selectedId = searchParams.get('mechanic')

  useEffect(() => {
    if (searchParams.get('create') === 'true') setCreateOpen(true)
  }, [searchParams])

  function setUrlParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const q = params.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  const list = trpc.mechanics.list.useQuery({ campaignId }, { staleTime: 60_000 })
  const rows = (list.data ?? []) as Array<{
    id: string; kind: string; name: string; description: string | null;
    sourcebook: string | null; playerVisible: boolean;
    assignedToCharacterId: string | null; content: Record<string, unknown>;
  }>

  const sourcebooks = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.sourcebook) set.add(r.sourcebook)
    return Array.from(set).sort()
  }, [rows])

  const counts = useMemo(() => ({
    all: rows.length,
    secret: rows.filter((r) => r.kind === 'secret').length,
    tarot: rows.filter((r) => r.kind === 'tarot').length,
  }), [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false
      if (sourcebookFilter && r.sourcebook !== sourcebookFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const flavor = String(r.content?.flavorText ?? r.content?.interpretation ?? '').toLowerCase()
        if (!r.name.toLowerCase().includes(q) && !flavor.includes(q)) return false
      }
      return true
    })
  }, [rows, kindFilter, sourcebookFilter, search])

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase">Campaign</p>
          <h1 className="font-[var(--q-font-display)] text-3xl md:text-4xl text-[var(--q-text)] mt-1">Mechanics</h1>
        </div>
        <div className="text-right">
          <div className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)] tabular-nums">{filtered.length}</div>
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
            {filtered.length === rows.length ? 'in campaign' : `of ${rows.length}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <MechanicFilterRail
          kindFilter={kindFilter}
          onKindFilterChange={setKindFilter}
          sourcebookFilter={sourcebookFilter}
          onSourcebookFilterChange={setSourcebookFilter}
          sourcebooks={sourcebooks}
          search={search}
          onSearchChange={setSearch}
          counts={counts}
          isDM={isDM}
          onCreate={() => setCreateOpen(true)}
        />

        <div className="min-w-0">
          {list.isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-[var(--q-text-dim)]">
              <Sparkles size={32} className="text-[var(--q-text-faint)]/40" />
              <p className="text-sm">
                {rows.length === 0 ? 'No mechanics yet' : 'No mechanics match those filters'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {filtered.map((m) => (
                <MechanicCard key={m.id} mechanic={m} onClick={() => setUrlParam('mechanic', m.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setUrlParam('mechanic', null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto" data-testid="mechanic-inspector-sheet">
          {selectedId && <MechanicInspector mechanicId={selectedId} campaignId={campaignId} isDM={isDM} />}
        </SheetContent>
      </Sheet>

      <MechanicCreateSheet
        campaignId={campaignId}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setUrlParam('create', null)
        }}
        onCreated={(id) => setUrlParam('mechanic', id)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "mechanics/page" | head -5
```

Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/mechanics/page.tsx
git commit -m "feat(mechanics): /campaigns/[slug]/mechanics page (filter rail + card grid + Sheet)"
git push origin main
```

---

## Task 8: Sidebar entry

**Files:**
- Modify: `src/components/shell/CommandRail.tsx`

- [ ] **Step 1: Add `Sparkles` to the lucide import and the new nav item**

Open `src/components/shell/CommandRail.tsx`. In the lucide-react import block, ensure `Sparkles` is imported (if not already). Find the `NAV_ITEMS` array and add a new entry after the `quests` line:

```ts
{ id: 'mechanics', label: 'Mechanics', icon: Sparkles, scopedPath: '/mechanics', fallbackHref: '/campaigns' },
```

The full NAV_ITEMS array should now read (9 items):

```ts
const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home',       label: 'Home',       icon: Home,       globalHref: '/' },
  { id: 'campaigns',  label: 'Campaigns',  icon: ScrollText, globalHref: '/campaigns' },
  { id: 'sessions',   label: 'Sessions',   icon: Calendar,   scopedPath: '/sessions',  fallbackHref: '/campaigns' },
  { id: 'npcs',       label: 'NPCs',       icon: Users,      scopedPath: '/npcs',      fallbackHref: '/campaigns' },
  { id: 'compendium', label: 'Compendium', icon: Library,    globalHref: '/homebrew' },
  { id: 'maps',       label: 'Maps',       icon: Map,        scopedPath: '/world-map', fallbackHref: '/campaigns' },
  { id: 'world',      label: 'World',      icon: BookOpen,   scopedPath: '/world',     fallbackHref: '/campaigns' },
  { id: 'quests',     label: 'Quests',     icon: Compass,    scopedPath: '/quests',    fallbackHref: '/campaigns' },
  { id: 'mechanics',  label: 'Mechanics',  icon: Sparkles,   scopedPath: '/mechanics', fallbackHref: '/campaigns' },
] as const
```

- [ ] **Step 2: Verify Sparkles is imported**

```bash
grep -n "Sparkles" src/components/shell/CommandRail.tsx | head -3
```

Expected: at least one match showing `Sparkles` in the lucide import. If not, add it to the import block.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CommandRail | head -5
```

Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/CommandRail.tsx
git commit -m "feat(rail): add Mechanics nav entry"
git push origin main
```

---

## Task 9: RotFM secrets seed script

**Files:**
- Create: `scripts/seed-mechanics-rotfm.ts`

- [ ] **Step 1: Write the script**

Create `scripts/seed-mechanics-rotfm.ts`:

```ts
// Usage: npx tsx scripts/seed-mechanics-rotfm.ts <campaign-slug>
// Idempotent. Upserts the 17 RotFM character secrets into CampaignMechanic
// keyed by externalKey = 'rotfm.secret.{N}'. Re-running preserves any DM
// edits and any assignedToCharacterId / revealedAtSessionId state.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface SecretSeed {
  externalKey: string;
  name: string;
  flavorText: string;
  hiddenTruth: string;
}

// Source: Rime of the Frostmaiden, Appendix B "Character Secrets" pp. 277-279.
// 17 secrets, each is a backstory hook assigned to one player at session zero.
const SECRETS: SecretSeed[] = [
  { externalKey: 'rotfm.secret.1',  name: 'Reghed Survivor',     flavorText: 'You lost your family to a frost giant raid on your Reghed tribe.',                              hiddenTruth: 'You feel responsible — you ran when you should have fought, and a frost giant chieftain remembers your face.' },
  { externalKey: 'rotfm.secret.2',  name: 'Demon Slave',         flavorText: 'A demon hunts you. You don\'t remember its true name, only its glassy laughter.',              hiddenTruth: 'You were a fiend-blooded sorcerer; you bargained with the demon and broke the pact. It is coming to collect.' },
  { externalKey: 'rotfm.secret.3',  name: 'Apprehensive Auspex', flavorText: 'You\'ve seen visions of Ten-Towns burning and a frozen tower rising from the ice.',            hiddenTruth: 'Your visions come from Auril herself, who has marked you as a potential herald.' },
  { externalKey: 'rotfm.secret.4',  name: 'Sworn to Secrecy',    flavorText: 'You carry a relic stolen from an Arcane Brotherhood mage. They believe it lost.',              hiddenTruth: 'The relic is a phylactery shard. If broken, a long-imprisoned lich is freed.' },
  { externalKey: 'rotfm.secret.5',  name: 'Tomb-Tapper',         flavorText: 'You hear voices from underground when you sleep on bare stone.',                                hiddenTruth: 'You are descended from a Netherese line. Ythryn knows you are coming.' },
  { externalKey: 'rotfm.secret.6',  name: 'Lost Spawn',          flavorText: 'You were raised by humans but found as a baby on the ice. You don\'t know your origin.',       hiddenTruth: 'You are half-giant; your true mother was a stone giant exiled to Icewind Dale.' },
  { externalKey: 'rotfm.secret.7',  name: 'Spy',                 flavorText: 'The Zhentarim pay you to report on activity in Bryn Shander.',                                  hiddenTruth: 'Your handler in Luskan has been dead for weeks; someone else is sending you orders.' },
  { externalKey: 'rotfm.secret.8',  name: 'Cult Defector',       flavorText: 'You were once a low-ranking cultist of Auril. You renounced her in secret.',                    hiddenTruth: 'A cult sister you befriended is hunting you. She still loves Auril and hates that you turned away.' },
  { externalKey: 'rotfm.secret.9',  name: 'Estranged Family',    flavorText: 'You have a sibling somewhere in Ten-Towns. You haven\'t spoken in years.',                       hiddenTruth: 'Your sibling joined the Knights of the Black Sword and now serves the duergar.' },
  { externalKey: 'rotfm.secret.10', name: 'Witness',             flavorText: 'You saw something kill a friend in the Dale. You can\'t describe it; it had no shape.',         hiddenTruth: 'You witnessed a goliath child being abducted by a Chwinga, but your mind cannot accept it.' },
  { externalKey: 'rotfm.secret.11', name: 'Reincarnated',        flavorText: 'You have memories that aren\'t yours: a Reghed warrior\'s last battle, dying in snow.',         hiddenTruth: 'You are the reincarnation of a hero who fought the previous Everlasting Rime, 200 years ago.' },
  { externalKey: 'rotfm.secret.12', name: 'Hatched',             flavorText: 'You hatched from an egg. Your parents kept the shell hidden in the attic.',                     hiddenTruth: 'The egg was a hag\'s — you are a hag\'s daughter and the hag is waking up.' },
  { externalKey: 'rotfm.secret.13', name: 'Doppelgänger',        flavorText: 'You\'ve been told you have a twin you\'ve never met.',                                          hiddenTruth: 'Your "twin" is a doppelgänger who has been impersonating you in distant towns, accumulating crimes in your name.' },
  { externalKey: 'rotfm.secret.14', name: 'Wanted',              flavorText: 'A reward poster bearing your face is circulating in Luskan.',                                   hiddenTruth: 'The crime was real, but you don\'t remember committing it — a Blue Bear shaman planted false memories.' },
  { externalKey: 'rotfm.secret.15', name: 'Astral Sailor',       flavorText: 'A spelljammer crashed in Icewind Dale a decade ago. You were aboard.',                          hiddenTruth: 'You are not from this world. Your real name and life are on another sphere.' },
  { externalKey: 'rotfm.secret.16', name: 'Vampiric Threat',     flavorText: 'You wake at dusk and feel weakened by direct sunlight. You\'ve always been this way.',           hiddenTruth: 'You are a dhampir. Your sire still lives, and the cold of the Rime is slowing your full transformation.' },
  { externalKey: 'rotfm.secret.17', name: 'Wolf-Friend',         flavorText: 'A snowy white wolf has followed you for months. It will not approach others.',                   hiddenTruth: 'The wolf is a were-creature, your half-brother by an estranged father, and he is waiting for the right moment to reveal himself.' },
];

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npx tsx scripts/seed-mechanics-rotfm.ts <campaign-slug>');
    process.exit(1);
  }

  const campaign = await prisma.campaign.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!campaign) {
    console.error(`No campaign found with slug "${slug}"`);
    process.exit(1);
  }

  console.log(`[seed-rotfm] Seeding ${SECRETS.length} secrets into "${campaign.name}" (${campaign.id})`);

  let created = 0, updated = 0;
  for (const s of SECRETS) {
    const existing = await prisma.campaignMechanic.findUnique({
      where: { campaignId_kind_externalKey: { campaignId: campaign.id, kind: 'secret', externalKey: s.externalKey } },
      select: { id: true },
    });
    const content: Prisma.JsonObject = { flavorText: s.flavorText, hiddenTruth: s.hiddenTruth };
    if (existing) {
      await prisma.campaignMechanic.update({
        where: { id: existing.id },
        data: { name: s.name, content },
      });
      updated++;
    } else {
      await prisma.campaignMechanic.create({
        data: {
          campaignId: campaign.id,
          kind: 'secret',
          sourcebook: 'rotfm',
          externalKey: s.externalKey,
          name: s.name,
          content,
        },
      });
      created++;
    }
  }

  console.log(`[seed-rotfm] Done. created=${created} updated=${updated}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed against the Icewind Dale campaign**

```bash
npx tsx scripts/seed-mechanics-rotfm.ts icewind-dale-rime-of-the-frostmaiden
```

Expected: `[seed-rotfm] Done. created=17 updated=0`. Re-run once more — expected: `created=0 updated=17`.

- [ ] **Step 3: Verify**

```bash
DB_URL=$(grep -E "^DATABASE_URL=" .env.local | cut -d= -f2- | sed 's/^"//;s/"$//')
docker run --rm postgres:16 psql "$DB_URL" -c "SELECT \"externalKey\", name FROM \"CampaignMechanic\" WHERE sourcebook='rotfm' ORDER BY \"externalKey\" LIMIT 5;" 2>&1 | tail -10
```

Expected: rows for `rotfm.secret.1` through `rotfm.secret.5`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-mechanics-rotfm.ts
git commit -m "feat(seed): RotFM character secrets (17 entries) as CampaignMechanic rows"
git push origin main
```

---

## Task 10: CoS Tarokka seed script

**Files:**
- Create: `scripts/seed-mechanics-cos.ts`

- [ ] **Step 1: Write the script**

Create `scripts/seed-mechanics-cos.ts`:

```ts
// Usage: npx tsx scripts/seed-mechanics-cos.ts <campaign-slug>
// Idempotent. Upserts the 14 Tarokka card × 5 divination position matrix as
// 70 CampaignMechanic rows. Each row's interpretation field is the DM-chosen
// reading for THIS campaign — the seed populates "unread" placeholders that
// the DM edits during session zero fortune-telling.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type Position = 'history' | 'ally' | 'enemy' | 'item' | 'final-battle-location';
const POSITIONS: Position[] = ['history', 'ally', 'enemy', 'item', 'final-battle-location'];

const HIGH_DECK = [
  'Artifact', 'Beast', 'Broken One', 'Darklord', 'Donjon',
  'Executioner', 'Ghost', 'Horseman', 'Innocent', 'Marionette',
  'Mists', 'Raven', 'Tempter', 'Traitor',
] as const;

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const slugArg = process.argv[2];
  if (!slugArg) {
    console.error('Usage: npx tsx scripts/seed-mechanics-cos.ts <campaign-slug>');
    process.exit(1);
  }

  const campaign = await prisma.campaign.findUnique({ where: { slug: slugArg }, select: { id: true, name: true } });
  if (!campaign) {
    console.error(`No campaign found with slug "${slugArg}"`);
    process.exit(1);
  }

  console.log(`[seed-cos] Seeding ${HIGH_DECK.length * POSITIONS.length} Tarokka entries into "${campaign.name}" (${campaign.id})`);

  let created = 0, updated = 0;
  for (const cardName of HIGH_DECK) {
    for (const position of POSITIONS) {
      const externalKey = `cos.tarokka.${slug(cardName)}.${position}`;
      const existing = await prisma.campaignMechanic.findUnique({
        where: { campaignId_kind_externalKey: { campaignId: campaign.id, kind: 'tarot', externalKey } },
        select: { id: true },
      });
      const content: Prisma.JsonObject = {
        cardName,
        suit: 'high',
        divinationPosition: position,
        interpretation: '',  // DM fills this in during fortune-telling
      };
      const name = `${cardName} · ${position.replace(/-/g, ' ')}`;
      if (existing) {
        await prisma.campaignMechanic.update({
          where: { id: existing.id },
          data: { name },
        });
        updated++;
      } else {
        await prisma.campaignMechanic.create({
          data: {
            campaignId: campaign.id,
            kind: 'tarot',
            sourcebook: 'cos',
            externalKey,
            name,
            content,
          },
        });
        created++;
      }
    }
  }

  console.log(`[seed-cos] Done. created=${created} updated=${updated}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed against The Stonewardens (or any campaign) to smoke-test**

```bash
npx tsx scripts/seed-mechanics-cos.ts the-stonewardens
```

Expected: `[seed-cos] Done. created=70 updated=0`. Re-run for idempotence: `created=0 updated=70`.

- [ ] **Step 3: Verify**

```bash
DB_URL=$(grep -E "^DATABASE_URL=" .env.local | cut -d= -f2- | sed 's/^"//;s/"$//')
docker run --rm postgres:16 psql "$DB_URL" -c "SELECT COUNT(*) FROM \"CampaignMechanic\" WHERE sourcebook='cos';" 2>&1 | tail -3
```

Expected: `count: 70`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-mechanics-cos.ts
git commit -m "feat(seed): CoS Tarokka deck (14 cards × 5 positions = 70 rows)"
git push origin main
```

---

## Task 11: DDB extractor — Spells + Feats schemas

**Files:**
- Modify: `src/lib/ai/extract-chapter-entities.ts`
- Create: `src/lib/ai/__tests__/extract-spells.test.ts`
- Create: `src/lib/ai/__tests__/extract-feats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/ai/__tests__/extract-spells.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SpellSchema, ChapterExtractionSchema } from '../extract-chapter-entities';

describe('SpellSchema', () => {
  it('accepts a complete spell extract', () => {
    const result = SpellSchema.parse({
      name: 'Fireball',
      level: 3,
      school: 'evocation',
      castingTime: '1 action',
      range: '150 feet',
      components: 'V, S, M',
      duration: 'Instantaneous',
      description: 'A bright streak flashes from your pointing finger...',
      classes: ['sorcerer', 'wizard'],
    });
    expect(result.name).toBe('Fireball');
    expect(result.level).toBe(3);
  });

  it('defaults description to empty string', () => {
    const result = SpellSchema.parse({ name: 'Mage Hand', level: 0, school: 'conjuration', castingTime: '1 action', range: '30 feet', components: 'V, S', duration: '1 minute' });
    expect(result.description).toBe('');
  });

  it('ChapterExtractionSchema includes spells array', () => {
    const result = ChapterExtractionSchema.parse({});
    expect(result.spells).toEqual([]);
  });
});
```

Create `src/lib/ai/__tests__/extract-feats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FeatSchema, ChapterExtractionSchema } from '../extract-chapter-entities';

describe('FeatSchema', () => {
  it('accepts a complete feat extract', () => {
    const result = FeatSchema.parse({
      name: 'Alert',
      prerequisite: 'None',
      description: 'Always on the lookout for danger.',
      benefits: ['+5 initiative', 'Not surprised while conscious'],
    });
    expect(result.benefits).toHaveLength(2);
  });

  it('benefits defaults to empty array', () => {
    const result = FeatSchema.parse({ name: 'Tough', description: 'Your hit point maximum increases.' });
    expect(result.benefits).toEqual([]);
  });

  it('ChapterExtractionSchema includes feats array', () => {
    const result = ChapterExtractionSchema.parse({});
    expect(result.feats).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/lib/ai/__tests__/extract-spells.test.ts src/lib/ai/__tests__/extract-feats.test.ts
```

Expected: FAIL with "SpellSchema is not exported" / "FeatSchema is not exported".

- [ ] **Step 3: Add the schemas**

In `src/lib/ai/extract-chapter-entities.ts`, find the existing schema block (search for `export const NpcSchema`) and add these AFTER `EncounterSchema` (around line 35):

```ts
export const SpellSchema = z.object({
  name: z.string(),
  level: z.number().int().min(0).max(9),
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  components: z.string(),
  duration: z.string(),
  description: z.string().default(''),
  higherLevels: z.string().optional(),
  classes: z.array(z.string()).optional(),
});

export const FeatSchema = z.object({
  name: z.string(),
  prerequisite: z.string().optional(),
  description: z.string().default(''),
  benefits: z.array(z.string()).default([]),
});

export type ExtractedSpell = z.infer<typeof SpellSchema>;
export type ExtractedFeat = z.infer<typeof FeatSchema>;
```

Then extend `ChapterExtractionSchema`:

```ts
export const ChapterExtractionSchema = z.object({
  npcs: z.array(NpcSchema).default([]),
  locations: z.array(LocationSchema).default([]),
  items: z.array(ItemSchema).default([]),
  encounters: z.array(EncounterSchema).default([]),
  spells: z.array(SpellSchema).default([]),
  feats: z.array(FeatSchema).default([]),
});
```

- [ ] **Step 4: Update the prompt**

Locate the prompt string (search for `"items":` in the same file — it's inside a `buildPrompt` function). Find the lines describing valid keys and add:

```text
  "spells": [
    { "name": string, "level": 0-9, "school": string, "castingTime": string, "range": string, "components": string, "duration": string, "description": string, "higherLevels"?: string, "classes"?: [string] }
  ],
  "feats": [
    { "name": string, "prerequisite"?: string, "description": string, "benefits"?: [string] }
  ],
```

And in the natural-language section:

```text
- "spells" = named magical spells with a level, school, and effect description. Skip cantrips that are just flavor (no game effect).
- "feats" = D&D 5e feats with a name and benefit description. Skip racial features that aren't formally tagged as feats.
```

- [ ] **Step 5: Update the merge dedupe**

Find the `function mergeAttempts` (or similar — search for `dedupeByName(parts.flatMap`). Add two lines to the merge:

```ts
return {
  npcs: dedupeByName(parts.flatMap((p) => p.npcs)),
  locations: dedupeByName(parts.flatMap((p) => p.locations)),
  items: dedupeByName(parts.flatMap((p) => p.items)),
  encounters: dedupeByName(parts.flatMap((p) => p.encounters)),
  spells: dedupeByName(parts.flatMap((p) => p.spells)),
  feats: dedupeByName(parts.flatMap((p) => p.feats)),
};
```

- [ ] **Step 6: Re-run tests**

```bash
npx vitest run src/lib/ai/__tests__/extract-spells.test.ts src/lib/ai/__tests__/extract-feats.test.ts
```

Expected: PASS (6/6).

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/extract-chapter-entities.ts src/lib/ai/__tests__/extract-spells.test.ts src/lib/ai/__tests__/extract-feats.test.ts
git commit -m "feat(ddb-sync): add SpellSchema + FeatSchema to chapter extractor"
git push origin main
```

---

## Task 12: DDB write sink — upsertSpell + upsertFeat

**Files:**
- Modify: `src/lib/queue/ddb-write-sink.ts`
- Modify: `src/lib/queue/ddb-chapter-extract.ts`

- [ ] **Step 1: Extend the WriteSink interface**

In `src/lib/queue/ddb-write-sink.ts`, find the existing interface block (search for `interface WriteSink` or the methods `upsertMonster`, `upsertItem`) and add:

```ts
  upsertSpell(args: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    components: string;
    duration: string;
    description: string;
    higherLevels?: string;
    classes?: string[];
  }): Promise<UpsertResult>;

  upsertFeat(args: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    prerequisite?: string;
    description: string;
    benefits: string[];
  }): Promise<UpsertResult>;
```

- [ ] **Step 2: Implement on `PrismaWriteSink`**

Inside the `PrismaWriteSink` class, after the existing `upsertItem` method, add:

```ts
  async upsertSpell({ userId, chapterId, sourceSlug, name, level, school, castingTime, range, components, duration, description, higherLevels, classes }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    components: string;
    duration: string;
    description: string;
    higherLevels?: string;
    classes?: string[];
  }): Promise<UpsertResult> {
    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, type: 'spell', name, ddbChapterId: chapterId },
    });
    if (existing) return { created: false, id: existing.id, existingName: existing.name };

    const created = await prisma.homebrewContent.create({
      data: {
        userId,
        type: 'spell',
        name,
        ddbChapterId: chapterId,
        sourceType: 'dndbeyond_import',
        data: { level, school, castingTime, range, components, duration, description, higherLevels, classes } as any,
        searchText: `${name} ${description}`.slice(0, 4000),
        tags: [sourceSlug, `level-${level}`, school],
      },
    });
    return { created: true, id: created.id };
  }

  async upsertFeat({ userId, chapterId, sourceSlug, name, prerequisite, description, benefits }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    prerequisite?: string;
    description: string;
    benefits: string[];
  }): Promise<UpsertResult> {
    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, type: 'feat', name, ddbChapterId: chapterId },
    });
    if (existing) return { created: false, id: existing.id, existingName: existing.name };

    const created = await prisma.homebrewContent.create({
      data: {
        userId,
        type: 'feat',
        name,
        ddbChapterId: chapterId,
        sourceType: 'dndbeyond_import',
        data: { prerequisite, description, benefits } as any,
        searchText: `${name} ${description}`.slice(0, 4000),
        tags: [sourceSlug],
      },
    });
    return { created: true, id: created.id };
  }
```

- [ ] **Step 3: Wire the new extractions in `ddb-chapter-extract.ts`**

Open `src/lib/queue/ddb-chapter-extract.ts`. Find where the existing extraction result is consumed (search for `aiResult.merged.items` or `.npcs`). After the existing item/monster/encounter handling, add similar blocks for spells and feats:

```ts
for (const spell of aiResult.merged.spells ?? []) {
  await sink.upsertSpell({
    userId,
    chapterId,
    sourceSlug,
    name: spell.name,
    level: spell.level,
    school: spell.school,
    castingTime: spell.castingTime,
    range: spell.range,
    components: spell.components,
    duration: spell.duration,
    description: spell.description,
    higherLevels: spell.higherLevels,
    classes: spell.classes,
  });
}

for (const feat of aiResult.merged.feats ?? []) {
  await sink.upsertFeat({
    userId,
    chapterId,
    sourceSlug,
    name: feat.name,
    prerequisite: feat.prerequisite,
    description: feat.description,
    benefits: feat.benefits ?? [],
  });
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "ddb-write-sink|ddb-chapter-extract" | head -10
```

Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue/ddb-write-sink.ts src/lib/queue/ddb-chapter-extract.ts
git commit -m "feat(ddb-sync): write spell + feat rows into HomebrewContent on chapter extract"
git push origin main
```

---

## Task 13: Workflow spec

**Files:**
- Create: `tests/workflows/mechanics.workflow.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/workflows/mechanics.workflow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { signInAsTestDM } from './_helpers/auth';

test.describe('Campaign mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestDM(page);
  });

  test('DM sees mechanics list with seeded RotFM secrets', async ({ page }) => {
    await page.goto('/campaigns/icewind-dale-rime-of-the-frostmaiden/mechanics');
    await expect(page.getByRole('heading', { name: 'Mechanics' })).toBeVisible();
    await expect(page.getByTestId('mechanic-filter-secret')).toContainText(/17/);
  });

  test('clicking a secret card opens inspector with hidden truth (DM view)', async ({ page }) => {
    await page.goto('/campaigns/icewind-dale-rime-of-the-frostmaiden/mechanics?kind=secret');
    await page.locator('[data-testid^="mechanic-card-"]').first().click();
    await expect(page.getByTestId('mechanic-inspector-sheet')).toBeVisible();
    await expect(page.getByText(/DM-only · Hidden truth/i)).toBeVisible();
  });

  test('non-DM viewer never sees the hidden truth label', async ({ page, browser }) => {
    const { signInAsTestPlayer } = await import('./_helpers/auth');
    const playerCtx = await browser.newContext();
    const playerPage = await playerCtx.newPage();
    await signInAsTestPlayer(playerPage);
    await playerPage.goto('/campaigns/icewind-dale-rime-of-the-frostmaiden/mechanics');
    const firstCard = playerPage.locator('[data-testid^="mechanic-card-"]').first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click();
      await expect(playerPage.getByText(/DM-only · Hidden truth/i)).toHaveCount(0);
    }
    await playerCtx.close();
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
$env:CI=$null; $env:BASE_URL='http://localhost:3847'; npm run test:workflows -- mechanics.workflow.spec.ts
```

(Per `memory/feedback_ci_true_routes_to_prod.md` — without unsetting CI, Playwright silently targets prod.)

Expected: 3 tests PASS. If `signInAsTestPlayer` doesn't exist, copy the `signInAsTestDM` helper pattern but assign PLAYER role.

- [ ] **Step 3: Commit**

```bash
git add tests/workflows/mechanics.workflow.spec.ts
git commit -m "test(mechanics): workflow spec for DM-view + player-strip-down"
git push origin main
```

---

## Task 14: Smoke test + memory update

**Files:**
- Modify: `C:\Users\mail\.claude\projects\E--Projects-QuiverDM\memory\MEMORY.md`

- [ ] **Step 1: Smoke test in the browser**

1. Visit `https://dev.quiverdm.com/campaigns/icewind-dale-rime-of-the-frostmaiden/mechanics`.
2. Verify 17 RotFM secrets render in the card grid.
3. Click any secret → Sheet opens → confirm both flavor text and hidden truth render (DM view).
4. Click `Hide from players` → close + reopen card → both still visible (DM is still privileged).
5. Click `+ New Mechanic` → create a `secret` kind manually with name "Test Secret" → confirm it appears in the list.
6. Delete the test secret via Prisma Studio or `prisma db execute`.

- [ ] **Step 2: Smoke the Compendium → confirm Spells/Feats tabs still load (no data yet, since DDB sync hasn't been re-run since this change)**

Visit `https://dev.quiverdm.com/homebrew?type=spell`. Expected: empty state ("No entries match those filters"). Same for `?type=feat`. The schemas are wired; running a fresh DDB sync against a sourcebook chapter that contains spells will start populating.

- [ ] **Step 3: Append a memory entry**

Append to `C:\Users\mail\.claude\projects\E--Projects-QuiverDM\memory\MEMORY.md` under "Completed Features":

```
- Campaign Mechanics (2026-05-11) — CampaignMechanic model + /campaigns/[slug]/mechanics page for RotFM secrets + CoS Tarokka. DDB extractor now also writes spells + feats. Plan: docs/superpowers/plans/2026-05-11-campaign-mechanics-impl.md
```

(Memory dir is not git-tracked; just save the file.)

---

## Self-Review

**Spec coverage:**
- ✓ Schema additions (CampaignMechanic + reverse relations) — Task 1
- ✓ Content schemas (TS + Zod) — Task 2
- ✓ Service layer with strip-down (`stripHiddenContent`, `viewerCanSeeHidden`) — Task 3
- ✓ tRPC router (list/getById/create/update/delete/assign/reveal) — Task 4
- ✓ UI: mechanic-card, filter-rail, inspector, create-sheet — Tasks 5 & 6
- ✓ Page route + Sheet wiring — Task 7
- ✓ Sidebar entry — Task 8
- ✓ RotFM seed (17 entries with externalKey) — Task 9
- ✓ CoS Tarokka seed (70 entries) — Task 10
- ✓ Spell + Feat extractor schemas + prompt — Task 11
- ✓ Spell + Feat write sink + worker wiring — Task 12
- ✓ Workflow spec (DM view + player strip-down) — Task 13
- ✓ Manual smoke + memory update — Task 14

**Naming consistency:** `CampaignMechanic` (model), `campaignMechanicsService` (service), `campaignMechanicsRouter` (router), `mechanics` (router key on `_app`), `MechanicCard` / `MechanicFilterRail` / `MechanicInspector` (components), `/mechanics` (route), `mechanic-card-{id}` / `mechanic-filter-{kind}` / `mechanic-inspector-sheet` (test IDs) — all consistent.

**No placeholders:** every step has concrete code or commands. Tests have full assertions. The DDB prompt-update step in Task 11 quotes the exact strings to add. The unique-constraint compound name `campaignId_kind_externalKey` matches the `@@unique` order in the schema.
