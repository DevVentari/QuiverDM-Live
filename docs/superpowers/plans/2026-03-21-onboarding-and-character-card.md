# Onboarding Rework + Player Character Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework onboarding as a DM-first wizard and replace the 7-tab character sheet with a compact stat-block card backed by the DM Brain.

**Architecture:** Schema migration adds `dmExperience` to `UserSettings`. Backend extends the onboarding service/router and adds a DDB campaign-import path. UI replaces the onboarding page wholesale and wraps the character detail page around a new `PlayerCharacterCard` component.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma, shadcn/ui, Tailwind, Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-onboarding-and-character-card-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `dmExperience String?` to `UserSettings` |
| `src/server/services/onboarding.service.ts` | Modify | Write `dmExperience` to `UserSettings` in `completeProfile()` |
| `src/server/routers/onboarding.ts` | Modify | Add `dmExperience` to `completeProfile` input schema |
| `src/lib/dndbeyond-api.ts` | Modify | Add `fetchDDBCampaignCharacters()` export |
| `src/server/routers/characters-dndbeyond.ts` | Modify | Add `importFromCampaign` tRPC procedure |
| `src/components/character/PlayerCharacterCard.tsx` | Create | Stat-block-style PC reference card with DM Brain panel |
| `src/app/(app)/onboarding/page.tsx` | Rewrite | DM-first 4-step wizard |
| `src/app/(app)/characters/[characterId]/page.tsx` | Modify | Replace tabs with `PlayerCharacterCard` + accordion |
| `tests/services/onboarding-profile.test.ts` | Create | Unit tests for `completeProfile` with `dmExperience` |

---

## Task 1: Schema — add `dmExperience` to UserSettings

**Files:**
- Modify: `prisma/schema.prisma` (line ~117, inside `model UserSettings`)

- [ ] **Step 1: Add field to schema**

In `prisma/schema.prisma`, inside `model UserSettings`, add after the `videoBackground` line:

```prisma
  // DM experience level (set during onboarding)
  dmExperience  String? // new | junior | experienced | veteran
```

- [ ] **Step 2: Push schema to local DB**

```bash
npm run db:push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add dmExperience to UserSettings"
```

---

## Task 2: Backend — extend `completeProfile` with `dmExperience`

**Files:**
- Create: `tests/services/onboarding-profile.test.ts`
- Modify: `src/server/services/onboarding.service.ts`
- Modify: `src/server/routers/onboarding.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/services/onboarding-profile.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    userSettings: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

import { onboardingService } from '@/server/services/onboarding.service';

describe('onboardingService.completeProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.user.update.mockResolvedValue({ id: 'user-1', onboardingStep: 'first_campaign', onboardingCompleted: false });
    mocks.prisma.userSettings.upsert.mockResolvedValue({});
  });

  it('writes dmExperience to UserSettings when provided', async () => {
    await onboardingService.completeProfile('user-1', {
      displayName: 'Vic',
      dmExperience: 'veteran',
    });

    expect(mocks.prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        update: { dmExperience: 'veteran' },
        create: expect.objectContaining({ dmExperience: 'veteran', userId: 'user-1' }),
      })
    );
  });

  it('does not call userSettings.upsert when dmExperience is absent', async () => {
    await onboardingService.completeProfile('user-1', { displayName: 'Vic' });
    expect(mocks.prisma.userSettings.upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/services/onboarding-profile.test.ts
```

Expected: FAIL — `prisma.userSettings.upsert is not a function` or similar.

- [ ] **Step 3: Update `onboarding.service.ts` — `completeProfile`**

In `src/server/services/onboarding.service.ts`, replace the `completeProfile` method:

```ts
async completeProfile(
  userId: string,
  data: {
    displayName?: string;
    bio?: string;
    dmExperience?: string;
  }
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: data.displayName,
      bio: data.bio,
    },
  });

  if (data.dmExperience) {
    await prisma.userSettings.upsert({
      where: { userId },
      update: { dmExperience: data.dmExperience },
      create: { userId, dmExperience: data.dmExperience },
    });
  }

  return this.updateStep(userId, 'first_campaign');
},
```

- [ ] **Step 4: Update `onboarding.ts` router — extend input schema**

In `src/server/routers/onboarding.ts`, update the `completeProfile` input:

```ts
completeProfile: protectedProcedure
  .input(
    z.object({
      displayName: z.string().min(1).max(50).optional(),
      bio: z.string().max(500).optional(),
      dmExperience: z.enum(['new', 'junior', 'experienced', 'veteran']).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    return onboardingService.completeProfile(ctx.session.user.id, input);
  }),
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npx vitest run tests/services/onboarding-profile.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add tests/services/onboarding-profile.test.ts src/server/services/onboarding.service.ts src/server/routers/onboarding.ts
git commit -m "feat(onboarding): add dmExperience to completeProfile"
```

---

## Task 3: Backend — `fetchDDBCampaignCharacters` in dndbeyond-api.ts

**Files:**
- Modify: `src/lib/dndbeyond-api.ts`

This function makes real HTTP calls so we skip an isolated unit test (the API is only called via the tRPC procedure which is tested via E2E). Implementation only.

- [ ] **Step 1: Add the export to `dndbeyond-api.ts`**

Append to `src/lib/dndbeyond-api.ts` after the `fetchCharacterFromDDB` function:

```ts
export interface DDBCampaignCharacterRef {
  characterId: string;
  isPublic: boolean;
}

/**
 * Fetch character list from a DnD Beyond campaign URL.
 * Requires a valid CobaltSession cookie.
 * Returns array of character refs — caller imports each via fetchCharacterFromDDB.
 */
export async function fetchDDBCampaignCharacters(
  campaignUrl: string,
  cobaltToken: string
): Promise<{ success: boolean; characters?: DDBCampaignCharacterRef[]; message?: string }> {
  try {
    // Extract campaign ID from URL, e.g. /campaigns/12345678/...
    const match = campaignUrl.match(/\/campaigns\/(\d+)/);
    if (!match) {
      return { success: false, message: 'Could not parse campaign ID from URL.' };
    }
    const campaignId = match[1];

    const response = await fetch(
      `https://www.dndbeyond.com/api/campaign/${campaignId}/characters`,
      {
        headers: {
          Cookie: `CobaltSession=${cobaltToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid or expired Cobalt token.' };
      }
      return { success: false, message: `DDB returned ${response.status}` };
    }

    const json = await response.json();
    // DDB campaign API returns { data: { characters: [{ id, shareable, ... }] } }
    const rawChars: any[] = json?.data?.characters ?? json?.data ?? [];
    const characters: DDBCampaignCharacterRef[] = rawChars.map((c: any) => ({
      characterId: String(c.id ?? c.characterId),
      isPublic: !!c.shareable,
    }));

    return { success: true, characters };
  } catch (error) {
    return {
      success: false,
      message: `Error fetching campaign characters: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dndbeyond-api.ts
git commit -m "feat(ddb): add fetchDDBCampaignCharacters"
```

---

## Task 4: Backend — `importFromCampaign` tRPC procedure

**Files:**
- Modify: `src/server/routers/characters-dndbeyond.ts`

- [ ] **Step 1: Read the existing router to understand imports and patterns**

Read `src/server/routers/characters-dndbeyond.ts` lines 1-40 to see existing imports.

- [ ] **Step 2: Add the procedure**

In `src/server/routers/characters-dndbeyond.ts`, add the following procedure inside the router object (alongside `importCharacter`):

```ts
importFromCampaign: protectedProcedure
  .input(
    z.object({
      campaignUrl: z.string().url(),
      campaignId: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;

    // Reuse the service's internal Cobalt token lookup
    // charactersDndbeyondService.importCharacter(userId, { characterId, campaignId })
    // fetches the DDB data and maps it internally — we don't need to do it ourselves

    // First get the list of character refs from the campaign URL
    const { prisma } = await import('@/lib/prisma');
    const { decrypt } = await import('@/lib/encryption');
    const { fetchDDBCampaignCharacters } = await import('@/lib/dndbeyond-api');

    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings?.dndBeyondCobaltCookie) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No DnD Beyond Cobalt token found. Add it in Settings → API Keys.',
      });
    }

    const cobaltToken = decrypt(settings.dndBeyondCobaltCookie);
    const result = await fetchDDBCampaignCharacters(input.campaignUrl, cobaltToken);

    if (!result.success || !result.characters) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: result.message ?? 'Failed to fetch campaign characters from DnD Beyond.',
      });
    }

    const imported: string[] = [];
    const failed: string[] = [];

    for (const ref of result.characters) {
      try {
        // charactersDndbeyondService.importCharacter handles DDB fetch + mapping internally
        await charactersDndbeyondService.importCharacter(userId, {
          characterId: ref.characterId,
          campaignId: input.campaignId,
        });
        imported.push(ref.characterId);
      } catch {
        failed.push(ref.characterId);
      }
    }

    return { imported: imported.length, failed: failed.length };
  }),
```

**Note:** Check `src/server/services/characters-dndbeyond.service.ts` — the `importCharacter` method accepts `(userId, input)` where `input` has `characterId` and optionally `campaignId`. Verify the exact `ImportInput` shape at the top of that file and adjust if needed (it may use `url` instead of `characterId` — pass `characterId` as a URL if so: `characterId: \`https://www.dndbeyond.com/characters/${ref.characterId}\``).

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any import name mismatches.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/characters-dndbeyond.ts
git commit -m "feat(ddb): add importFromCampaign tRPC procedure"
```

---

## Task 5: PlayerCharacterCard component

**Files:**
- Create: `src/components/character/PlayerCharacterCard.tsx`

**Reference for styling:** `src/components/encounter/stat-block-card.tsx` (amber borders, section dividers, ability grid pattern)

- [ ] **Step 1: Read StatBlockCard to understand the exact styling tokens**

Read `src/components/encounter/stat-block-card.tsx` — note the outer wrapper class, section divider class, and ability score grid layout.

- [ ] **Step 2: Create the component**

Create `src/components/character/PlayerCharacterCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Users, ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import type { Character, WorldEntity, WorldRelationship } from '@prisma/client';

type CharacterWithBrainEntity = Character & {
  brainEntity?: WorldEntity & { relationships: WorldRelationship[] };
};

interface PlayerCharacterCardProps {
  character: CharacterWithBrainEntity;
  compact?: boolean;
  campaignId?: string;
  className?: string;
}

function abilityMod(score: number) {
  return Math.floor((score - 10) / 2);
}

function fmtMod(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

export function PlayerCharacterCard({
  character,
  compact = false,
  campaignId,
  className,
}: PlayerCharacterCardProps) {
  const [expanded, setExpanded] = useState(!compact);

  const data = character as any;
  const abilityScores = (data.abilityScores ?? {}) as Record<string, number>;
  const classes = data.classes as any[] | null;

  const classStr = classes && classes.length > 0
    ? classes.map((c: any) => `${c.name} ${c.level ?? ''}`).join(' / ').trim()
    : data.class
    ? `${data.class} ${data.level ?? ''}`
    : `Level ${data.level ?? '?'}`;

  const subtitle = [data.race, classStr].filter(Boolean).join(' · ');

  // Brain panel fetch — only when campaignId is set and card is expanded
  // Uses brain.entities.list with search param (no getByName procedure exists)
  const brainQuery = trpc.brain.entities.list.useQuery(
    { campaignId: campaignId!, search: character.name },
    { enabled: !!campaignId && expanded, staleTime: 60_000 }
  );
  const brainEntity = brainQuery.data?.[0];

  return (
    <div
      className={cn(
        'border border-amber-800/30 rounded bg-amber-950/10 text-sm',
        className
      )}
    >
      {/* Header — always visible */}
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2',
          compact && 'cursor-pointer select-none'
        )}
        onClick={compact ? () => setExpanded((v) => !v) : undefined}
      >
        {/* Portrait */}
        <div className="relative h-10 w-10 shrink-0 rounded overflow-hidden border border-amber-800/30">
          {data.portraitUrl ? (
            <Image src={data.portraitUrl} alt={data.name} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-purple-950 to-blue-950 flex items-center justify-center">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Name + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold leading-tight truncate">{character.name}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          {data.background && (
            <p className="text-xs text-amber-700/70 truncate">{data.background}</p>
          )}
        </div>

        {/* Compact: inline HP/AC + chevron */}
        {compact && (
          <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
            {data.hitPoints != null && (
              <span>HP {data.hitPoints.current ?? data.hitPoints}/{data.hitPoints.max ?? data.hitPoints}</span>
            )}
            {data.armorClass != null && <span>AC {data.armorClass}</span>}
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        )}
      </div>

      {/* Expanded sections */}
      {expanded && (
        <>
          {/* Stats strip */}
          <div className="border-t border-amber-800/30 grid grid-cols-6 text-center px-3 py-2 gap-1">
            {[
              { label: 'AC', value: data.armorClass ?? '—' },
              { label: 'HP', value: data.hitPoints != null ? `${data.hitPoints.current ?? data.hitPoints}/${data.hitPoints.max ?? data.hitPoints}` : '—' },
              { label: 'Spd', value: data.speed ? `${data.speed}ft` : '—' },
              { label: 'Init', value: fmtMod(abilityMod(abilityScores.dex ?? 10)) },
              { label: 'PP', value: data.passivePerception ?? '—' },
              { label: 'Prof', value: data.proficiencyBonus ? `+${data.proficiencyBonus}` : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="font-mono font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {/* Ability scores */}
          <div className="border-t border-amber-800/30 grid grid-cols-6 text-center px-3 py-2 gap-1">
            {ABILITY_KEYS.map((key) => {
              const score = abilityScores[key] ?? 10;
              return (
                <div key={key}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{ABILITY_LABELS[key]}</p>
                  <p className="font-mono font-semibold">{score}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtMod(abilityMod(score))}</p>
                </div>
              );
            })}
          </div>

          {/* DM Brain panel */}
          <div className="border-t border-amber-800/30 px-3 py-2 space-y-1">
            <p className="font-bold text-sm uppercase tracking-wide text-amber-700 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              DM Brain
            </p>

            {!campaignId ? (
              <p className="text-xs text-muted-foreground italic">No campaign context.</p>
            ) : brainQuery.isLoading ? (
              <p className="text-xs text-muted-foreground italic">Loading…</p>
            ) : !brainEntity ? (
              <p className="text-xs text-muted-foreground italic">
                Not yet tracked by DM Brain. Seed the Brain to see history here.
              </p>
            ) : (
              <div className="space-y-1 text-xs">
                {brainEntity.lastSeenSessionId && (
                  <p className="text-muted-foreground">Last seen: {brainEntity.lastSeenSessionId}</p>
                )}
                {brainEntity.description && (
                  <p className="text-muted-foreground line-clamp-2">{brainEntity.description}</p>
                )}
                <a
                  href={`/campaigns/${campaignId}/brain?entity=${brainEntity.id}`}
                  className="text-amber-600 hover:underline text-xs"
                >
                  View in Brain →
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

**Note:** After creating this, run `npx tsc --noEmit` and fix any type errors — some fields on `Character` may be typed differently than `any`. Adjust field access (e.g. `hitPoints` may be a number not an object) to match the actual Prisma model shape.

The Brain panel uses only `trpc.brain.entities.list` with a `search` param (confirmed: `src/server/routers/brain.ts:22-34`). There is no `getChanges` procedure — the panel intentionally shows only `lastSeenSessionId` and `description` from the entity. No changes needed here.

- [ ] **Step 3: Verify `brain.entities.list` return shape**

```bash
grep -n "entities.list\|return.*entity\|findEntities" src/server/routers/brain.ts | head -10
```

Confirm the query returns an array (not `{ entities: [] }`) so `brainQuery.data?.[0]` is correct. Adjust the array access if the router wraps the result differently.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Fix any errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/components/character/PlayerCharacterCard.tsx
git commit -m "feat(characters): add PlayerCharacterCard stat-block component"
```

---

## Task 6: Rewrite onboarding page

**Files:**
- Modify: `src/app/(app)/onboarding/page.tsx` (full rewrite)

The current file is ~634 lines. The rewrite replaces all step components while keeping the `StepIndicator`, `OnboardingPage` shell, and navigation patterns (`window.location.href` for hard nav after skip/complete).

- [ ] **Step 1: Rewrite `WelcomeStep`**

Replace the `WelcomeStep` function (lines 66-130) with:

```tsx
function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { toast } = useToast();
  const completeWelcome = trpc.onboarding.completeWelcome.useMutation({
    onSuccess: onNext,
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Built for Dungeon Masters</CardTitle>
        <CardDescription className="text-base mt-2">
          Your campaign is alive. Every session feeds the Brain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Brain className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">DM Brain</p>
              <p className="text-sm text-muted-foreground">
                Living world intelligence that tracks every entity, faction, and hook across your campaign.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Mic className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Session Recording</p>
              <p className="text-sm text-muted-foreground">
                Automatic transcription and AI summaries after every session.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Scroll className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Prep Workspace</p>
              <p className="text-sm text-muted-foreground">
                AI-assisted session prep with brain context baked in.
              </p>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={() => completeWelcome.mutate()}
          disabled={completeWelcome.isPending}
        >
          {completeWelcome.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="mr-2 h-4 w-4" />
          )}
          Get Started
        </Button>
      </CardContent>
    </Card>
  );
}
```

Add `Brain` to the Lucide import list.

- [ ] **Step 2: Rewrite `ProfileStep`**

Replace the `ProfileStep` function with:

```tsx
const DM_EXPERIENCE_OPTIONS = [
  { value: 'new', label: 'First campaign' },
  { value: 'junior', label: '1–3 years' },
  { value: 'experienced', label: '3–10 years' },
  { value: 'veteran', label: '10+ years' },
] as const;

function ProfileStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [dmExperience, setDmExperience] = useState<string>('');

  const completeProfile = trpc.onboarding.completeProfile.useMutation({
    onSuccess: onNext,
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const skipOnboarding = trpc.onboarding.skip.useMutation({
    onSuccess: onSkip,
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    completeProfile.mutate({
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
      dmExperience: (dmExperience as any) || undefined,
    });
  }

  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Your DM Profile</CardTitle>
        <CardDescription className="text-base mt-2">
          Quick details. You can change these any time in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="How you appear to players"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">
              Bio <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="bio"
              placeholder="A few words about your DMing style..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dmExperience">How long have you been DMing?</Label>
            <select
              id="dmExperience"
              value={dmExperience}
              onChange={(e) => setDmExperience(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>Select your experience</option>
              {DM_EXPERIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {completeProfile.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {completeProfile.error.message}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={completeProfile.isPending || !dmExperience}>
            {completeProfile.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Continue
          </Button>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => skipOnboarding.mutate()}
              disabled={skipOnboarding.isPending}
            >
              Skip for now
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Rewrite `FirstCampaignStep`**

Replace the entire `FirstCampaignStep` function with a new DM-only version. This step is the longest — it has multiple sub-sections rendered sequentially. The state tracks: campaign identity + DDB import + world setup + story + docs. All are submitted together when the DM clicks "Create Campaign & Continue".

```tsx
function FirstCampaignStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [ddbCampaignUrl, setDdbCampaignUrl] = useState('');
  const [startingLocation, setStartingLocation] = useState('');
  const [antagonistName, setAntagonistName] = useState('');
  const [openingHook, setOpeningHook] = useState('');
  const [storySoFar, setStorySoFar] = useState('');
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const userSettings = trpc.userSettings.getSettings.useQuery(undefined, { staleTime: 300_000 });
  const hasCobalt = !!userSettings.data?.hasDndBeyondCobaltCookie;

  const createCampaign = trpc.campaigns.create.useMutation();
  const completeFirstCampaign = trpc.onboarding.completeFirstCampaign.useMutation({
    onSuccess: () => {
      utils.onboarding.needsOnboarding.invalidate();
      onNext();
    },
  });
  const seedBrain = trpc.brain.seedFromCreation.useMutation();
  const importFromCampaign = trpc.charactersDndBeyond.importFromCampaign.useMutation();

  const skipOnboarding = trpc.onboarding.skip.useMutation({
    onSuccess: onSkip,
  });

  const isPending = createCampaign.isPending || completeFirstCampaign.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignName.trim()) return;

    try {
      const campaign = await createCampaign.mutateAsync({ name: campaignName.trim(), description: description.trim() || undefined });
      setCreatedCampaignId(campaign.id);
      setCreatedSlug(campaign.slug);

      // Seed DM Brain with world setup (fire-and-forget)
      void seedBrain.mutateAsync({
        campaignId: campaign.id,
        worldSetup: {
          startingLocation: startingLocation.trim() || undefined,
          antagonistName: antagonistName.trim() || undefined,
          openingHook: openingHook.trim() || undefined,
        },
        storyText: storySoFar.trim() || undefined,
      }).catch(() => {});

      // Import DDB characters if URL provided
      if (ddbCampaignUrl.trim() && hasCobalt) {
        void importFromCampaign.mutateAsync({
          campaignUrl: ddbCampaignUrl.trim(),
          campaignId: campaign.id,
        }).catch(() => {});
      }

      await completeFirstCampaign.mutateAsync();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  }

  return (
    <Card className="max-w-2xl w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Your First Campaign</CardTitle>
        <CardDescription className="text-base mt-2">
          Set up your world. You can fill in details any time after creation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Campaign Identity */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Campaign</p>
            <div className="space-y-2">
              <Label htmlFor="campaignName">Name *</Label>
              <Input
                id="campaignName"
                placeholder="e.g., Curse of Strahd, The Lost Mines"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="A brief summary of your campaign..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* DnD Beyond Campaign Import */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Party Import</p>
            {hasCobalt ? (
              <div className="space-y-2">
                <Label htmlFor="ddbCampaignUrl">DnD Beyond Campaign URL</Label>
                <Input
                  id="ddbCampaignUrl"
                  placeholder="https://www.dndbeyond.com/campaigns/12345678"
                  value={ddbCampaignUrl}
                  onChange={(e) => setDdbCampaignUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste your campaign URL to import linked character sheets.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-800/30 bg-amber-950/10 p-4 space-y-2">
                <p className="text-sm font-medium text-amber-700">Import your DnD Beyond party</p>
                <p className="text-xs text-muted-foreground">
                  Install the QuiverDM extension and set your Cobalt cookie to import character sheets directly.
                </p>
                <div className="flex gap-3 text-xs">
                  <a href="https://quiverdm.com/extension" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
                    Install Extension
                  </a>
                  <a href="/settings/api-keys" className="text-amber-600 hover:underline">
                    Set Cookie in Settings
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/50" />

          {/* World Setup */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">World Setup</p>
            <div className="space-y-2">
              <Label htmlFor="startingLocation">Starting Location</Label>
              <Input
                id="startingLocation"
                placeholder="e.g., The village of Barovia"
                value={startingLocation}
                onChange={(e) => setStartingLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="antagonistName">Main Antagonist</Label>
              <Input
                id="antagonistName"
                placeholder="e.g., Strahd von Zarovich"
                value={antagonistName}
                onChange={(e) => setAntagonistName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingHook">Opening Hook</Label>
              <Input
                id="openingHook"
                placeholder="e.g., A mysterious letter leads the party into the mist..."
                value={openingHook}
                onChange={(e) => setOpeningHook(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Story So Far */}
          <div className="space-y-2">
            <Label htmlFor="storySoFar">
              Story So Far <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="storySoFar"
              placeholder="Migrating from another tool? Paste your campaign history here and the DM Brain will extract it."
              value={storySoFar}
              onChange={(e) => setStorySoFar(e.target.value)}
              rows={4}
              maxLength={20000}
            />
          </div>

          {(createCampaign.error || completeFirstCampaign.error) && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {createCampaign.error?.message ?? completeFirstCampaign.error?.message}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isPending || !campaignName.trim()}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Create Campaign & Continue
          </Button>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => skipOnboarding.mutate()}
              disabled={skipOnboarding.isPending}
            >
              Skip for now
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Note:** Check the actual shape of `trpc.campaigns.create` return — it likely returns a `Campaign` object. Adjust `campaign.id` and `campaign.slug` field names if different. The user settings procedure is `trpc.userSettings.getSettings` (confirmed in `src/server/routers/user-settings.ts:74`) and returns `hasDndBeyondCobaltCookie` as a boolean.

- [ ] **Step 4: Thread `createdSlug` through `OnboardingPage`**

The CompleteStep needs the campaign slug to navigate to the Brain. Lift this state into `OnboardingPage` and pass it via props.

In `OnboardingPage`, add state and update `FirstCampaignStep` call:

```tsx
// In OnboardingPage — add alongside localStep state:
const [createdSlug, setCreatedSlug] = useState<string | null>(null);

// In the JSX, pass the setter:
{currentStep === 'first_campaign' && (
  <FirstCampaignStep
    onNext={(slug) => { setCreatedSlug(slug); advanceTo('complete'); }}
    onSkip={handleSkipComplete}
  />
)}

{currentStep === 'complete' && <CompleteStep campaignSlug={createdSlug} />}
```

Update `FirstCampaignStep` signature and `onNext` call:

```tsx
function FirstCampaignStep({ onNext, onSkip }: { onNext: (slug: string) => void; onSkip: () => void }) {
  // ... existing state ...
  // In handleSubmit, after campaign creation:
  await completeFirstCampaign.mutateAsync();
  onNext(campaign.slug);  // pass slug up
}
```

Then the `CompleteStep`:

```tsx
function CompleteStep({ campaignSlug }: { campaignSlug: string | null }) {
  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="relative h-14 w-14 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-pulse" />
            <Brain className="h-8 w-8 text-amber-500 relative z-10" />
          </div>
        </div>
        <CardTitle className="text-2xl">DM Brain is waking up</CardTitle>
        <CardDescription className="text-base mt-2">
          Your campaign is being processed. Entities, factions, and hooks will appear in the Brain as ingestion completes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {campaignSlug && (
          <Button
            className="w-full"
            size="lg"
            onClick={() => { window.location.href = `/campaigns/${campaignSlug}/brain`; }}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Review Brain
          </Button>
        )}
        <Button
          variant={campaignSlug ? 'outline' : 'default'}
          className="w-full"
          size="lg"
          onClick={() => { window.location.href = '/dashboard'; }}
        >
          Go to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Remove unused imports**

Remove `Users`, `Plus`, `BookOpen`, `CheckCircle2` from the Lucide import if they are no longer used. Add `Brain` to the import.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Fix any errors — especially around `campaign` return shape from `trpc.campaigns.create`. The settings procedure (`trpc.userSettings.getSettings`) and cobalt flag (`hasDndBeyondCobaltCookie`) are already correct.

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/onboarding/page.tsx
git commit -m "feat(onboarding): DM-first wizard with Brain completion"
```

---

## Task 7: Update character detail page

**Files:**
- Modify: `src/app/(app)/characters/[characterId]/page.tsx`

The spec says: replace the 7-tab layout with `PlayerCharacterCard` (expanded, full width) + a collapsible "Full Sheet" accordion below. The existing tab components are NOT deleted — they move inside the accordion.

- [ ] **Step 1: Add PlayerCharacterCard import and accordion state**

At the top of `src/app/(app)/characters/[characterId]/page.tsx`, add:

```tsx
import { PlayerCharacterCard } from '@/components/character/PlayerCharacterCard';
import { ChevronDown, ChevronRight } from 'lucide-react'; // already partially imported, check for duplicates
```

Add state inside `CharacterDetailPage`:

```tsx
const [fullSheetOpen, setFullSheetOpen] = useState(false);
```

- [ ] **Step 2: Replace the Tabs section**

Replace the entire `{/* Tabbed Content */}` block (from `<Tabs defaultValue="overview"` through `</Tabs>`) with:

```tsx
{/* Player Character Card */}
<PlayerCharacterCard
  character={data}
  campaignId={(data.campaignCharacters?.[0]?.campaignId) ?? undefined}
/>

{/* Full Sheet — archived, collapsed by default */}
<div className="rounded-lg border border-border/50">
  <button
    type="button"
    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
    onClick={() => setFullSheetOpen((v) => !v)}
  >
    <span>Full Character Sheet</span>
    {fullSheetOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
  </button>

  {fullSheetOpen && (
    <div className="border-t border-border/50 p-4">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="spells" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Spells</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5">
            <Backpack className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Inventory</span>
          </TabsTrigger>
          <TabsTrigger value="homebrew" className="gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Homebrew</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Features</span>
          </TabsTrigger>
          <TabsTrigger value="proficiencies" className="gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Skills</span>
          </TabsTrigger>
          <TabsTrigger value="background" className="gap-1.5">
            <ScrollText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Background</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <CharacterOverview data={data} onRoll={roll} isUpdating={updateChar.isPending} onUpdate={async (patch) => { await updateChar.mutateAsync({ id: characterId, ...patch }); }} />
        </TabsContent>
        <TabsContent value="spells" className="mt-4">
          <CharacterSpells data={data} onRoll={roll} isUpdating={updateChar.isPending} onUpdate={async (patch) => { await updateChar.mutateAsync({ id: characterId, ...patch }); }} />
        </TabsContent>
        <TabsContent value="inventory" className="mt-4">
          <CharacterInventory data={data} isUpdating={updateChar.isPending} onUpdate={async (patch) => { await updateChar.mutateAsync({ id: characterId, ...patch }); }} />
        </TabsContent>
        <TabsContent value="homebrew" className="mt-4">
          <div className="space-y-6">
            <CharacterActiveEffects characterId={characterId} abilityScores={data.abilityScores ?? null} armorClass={data.armorClass ?? null} />
            <section>
              <h3 className="text-lg font-semibold mb-2">Homebrew Items</h3>
              <CharacterHomebrewItems characterId={characterId} />
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2">Homebrew Spells</h3>
              <CharacterHomebrewSpells characterId={characterId} />
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2">Homebrew Feats</h3>
              <CharacterHomebrewFeats characterId={characterId} />
            </section>
          </div>
        </TabsContent>
        <TabsContent value="features" className="mt-4">
          <CharacterFeatures data={data} />
        </TabsContent>
        <TabsContent value="proficiencies" className="mt-4">
          <CharacterProficiencies data={data} onRoll={roll} />
        </TabsContent>
        <TabsContent value="background" className="mt-4">
          <CharacterBackground data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )}
</div>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Fix any type errors — `data` is typed as `any` so `PlayerCharacterCard` should accept it. If `character` prop type is strict, cast `data as CharacterWithBrainEntity`.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/characters/[characterId]/page.tsx
git commit -m "feat(characters): replace tab layout with PlayerCharacterCard + accordion"
```

---

## Task 8: Push and verify

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit
```

All errors must be resolved.

- [ ] **Step 2: Run all Vitest tests**

```bash
npx vitest run tests/services/
```

Expected: all tests pass (includes the new `onboarding-profile.test.ts` and existing `brain-ingestion.test.ts`).

- [ ] **Step 3: Push to production**

```bash
git push origin main
```

- [ ] **Step 4: Smoke test in browser**
  1. Sign up with a fresh invite code → onboarding should show new DM-first steps
  2. Complete Welcome → Profile (check dmExperience select works)
  3. Complete First Campaign → Complete (Brain waking up screen)
  4. Navigate to any character detail → see `PlayerCharacterCard` at top, "Full Character Sheet" accordion below

---

## Out of Scope (do not implement)

- **Sourcebook Seed section** — checkbox list to seed DDB sourcebooks; requires DDB entitlement sync worker, defer to post-creation campaign page
- **PDF document upload section** — drag-and-drop in onboarding, requires BullMQ PDF pipeline wiring; defer to post-creation campaign page
- **Compact `PlayerCharacterCard`** in session cockpit and prep workspace — follow-on once card is stable
- `CharacterHomebrewItems/Spells/Feats` changes — existing components are wrapped unchanged inside the accordion
