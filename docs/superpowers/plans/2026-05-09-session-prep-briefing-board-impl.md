# Session Prep Briefing Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Lazy DM 7-section checklist with a Brain-driven World Briefing Board — pressure point cards with AI proposals that the DM accepts, edits, or dismisses.

**Architecture:** New `BriefingCard` type added to `prep-types.ts`; new `sessions.generateBriefing` tRPC procedure reads brain world state and calls AI; `BriefingBoard` + `PressureCard` components replace the section grid in `PrepWorkspace`; `PartyStateSection` wraps the existing `StepCharacters` for character notes.

**Tech Stack:** tRPC v11, Zod, React, Tailwind, Lucide, existing `chatWithAI` + `brainRepository` patterns.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/briefing-types.ts` | CREATE | `BriefingCard` Zod schema + type |
| `src/lib/prep-types.ts` | MODIFY | Add `briefingCards` field to `SessionPrepDataSchema` |
| `src/lib/ai/generate-briefing.ts` | CREATE | AI function: world state → `BriefingCard[]` |
| `src/server/routers/sessions.ts` | MODIFY | Add `generateBriefing` procedure |
| `src/components/session/prep/pressure-card.tsx` | CREATE | Single card component with all states |
| `src/components/session/prep/party-state-section.tsx` | CREATE | Character notes wrapper |
| `src/components/session/prep/briefing-board.tsx` | CREATE | Full board: generates cards, renders PressureCards, DM Adds, footer |
| `src/components/session/prep/prep-workspace.tsx` | MODIFY | Swap section grid for BriefingBoard + PartyStateSection |
| `src/components/session/prep/prep-section-card.tsx` | DELETE | Replaced by PressureCard |
| `src/components/session/prep/steps/step-strong-start.tsx` | DELETE | No longer used |
| `src/components/session/prep/steps/step-scenes.tsx` | DELETE | No longer used |
| `src/components/session/prep/steps/step-secrets.tsx` | DELETE | No longer used |
| `src/components/session/prep/steps/step-npcs.tsx` | DELETE | No longer used |
| `src/components/session/prep/steps/step-monsters.tsx` | DELETE | No longer used |
| `src/components/session/prep/steps/step-rewards.tsx` | DELETE | No longer used |
| `src/components/session/prep/steps/step-loose-threads.tsx` | DELETE | No longer used |
| `tests/workflows/session-prep-briefing.workflow.spec.ts` | CREATE | E2E workflow spec |

---

## Task 1: BriefingCard type + extend SessionPrepData

**Files:**
- Create: `src/lib/briefing-types.ts`
- Modify: `src/lib/prep-types.ts`

- [ ] **Step 1: Write the E2E spec first (failing — briefing-board doesn't exist yet)**

Create `tests/workflows/session-prep-briefing.workflow.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const MOCK_CARDS = [
  {
    id: 'card-1',
    type: 'FACTION',
    entityName: 'Shadow Hand',
    urgencyLevel: 5,
    context: 'Three sessions since the party ignored the warning.',
    proposal: 'Open with a hooded figure leaving a marked coin on the table.',
    status: 'proposed',
  },
  {
    id: 'card-2',
    type: 'HOOK',
    entityName: 'The Ember Vault',
    urgencyLevel: 3,
    context: 'Hook first surfaced in Session 8. Decaying fast.',
    proposal: 'Have Valdris mention strange lights below the old quarter.',
    status: 'proposed',
  },
];

test.describe('Session Prep — World Briefing Board', () => {
  test.use({ storageState: 'tests/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/trpc/sessions.generateBriefing**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { cards: MOCK_CARDS } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getPrepContext**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { characters: [], npcs: [], recentSessions: [], homebrew: [] } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getById**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { id: 'test-session', title: 'Test Session', prepStatus: 'draft', prepData: null } } }]),
      });
    });
  });

  test('briefing board renders Brain-generated pressure cards', async ({ page }) => {
    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await expect(page.getByText('World Pressure')).toBeVisible();
    await expect(page.getByText('Shadow Hand')).toBeVisible();
    await expect(page.getByText('The Ember Vault')).toBeVisible();
  });

  test('DM can accept a pressure card', async ({ page }) => {
    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await page.getByRole('button', { name: 'Use this' }).first().click();
    await expect(page.getByText('1 of 2 reviewed')).toBeVisible();
  });

  test('DM can dismiss a pressure card', async ({ page }) => {
    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await page.getByRole('button', { name: 'Dismiss' }).first().click();
    await expect(page.getByText('dismissed')).toBeVisible();
  });

  test('DM can edit a card proposal inline', async ({ page }) => {
    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const textarea = page.locator('textarea').first();
    await textarea.clear();
    await textarea.fill('My custom version of the scene');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('edited')).toBeVisible();
  });

  test('DM can add a card Brain missed', async ({ page }) => {
    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await page.getByRole('button', { name: /Add something Brain missed/ }).click();
    await page.getByPlaceholder(/Describe a scene/).fill('Include the mysterious merchant subplot');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Include the mysterious merchant subplot')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run to verify it fails (no BriefingBoard yet)**

```bash
npx playwright test tests/workflows/session-prep-briefing.workflow.spec.ts --reporter=line
```

Expected: FAIL — `getByText('World Pressure')` not found

- [ ] **Step 3: Create `src/lib/briefing-types.ts`**

```typescript
import { z } from 'zod';

export const BriefingCardTypeSchema = z.enum(['FACTION', 'NPC', 'HOOK', 'REGION', 'CUSTOM']);

export const BriefingCardSchema = z.object({
  id: z.string(),
  type: BriefingCardTypeSchema,
  entityName: z.string(),
  urgencyLevel: z.number().int().min(1).max(5).default(3),
  context: z.string().default(''),
  proposal: z.string().default(''),
  status: z.enum(['proposed', 'accepted', 'edited', 'dismissed', 'dm-added']).default('proposed'),
  dmNote: z.string().optional(),
});

export type BriefingCard = z.infer<typeof BriefingCardSchema>;
export type BriefingCardType = z.infer<typeof BriefingCardTypeSchema>;
```

- [ ] **Step 4: Add `briefingCards` to `src/lib/prep-types.ts`**

Add import at line 1:
```typescript
import { BriefingCardSchema } from './briefing-types';
```

Add field inside `SessionPrepDataSchema` (after `importedNotes` on line ~104):
```typescript
  // Briefing board cards (replaces checklist sections as primary prep surface)
  briefingCards: z.array(BriefingCardSchema).optional().default([]),
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefing-types.ts src/lib/prep-types.ts tests/workflows/session-prep-briefing.workflow.spec.ts
git commit -m "feat(prep): BriefingCard type + extend SessionPrepData schema"
```

---

## Task 2: AI generate-briefing function

**Files:**
- Create: `src/lib/ai/generate-briefing.ts`

- [ ] **Step 1: Create `src/lib/ai/generate-briefing.ts`**

```typescript
import { chatWithAI } from './chat';
import { z } from 'zod';
import type { BriefingCard } from '@/lib/briefing-types';

export interface GenerateBriefingInput {
  worldState: {
    pressurePolitical: number;
    pressureSupernatural: number;
    pressureEconomic: number;
    pressureCosmic: number;
    pressureSocial: number;
    hooks: Array<{ text: string; urgency: string }>;
    threats: Array<{ name?: string; description?: string }>;
  };
  recentChanges: Array<{
    entityName: string;
    entityType: string;
    changeType: string;
  }>;
  entities: Array<{
    name: string;
    type: string;
    description?: string | null;
  }>;
}

const SYSTEM_PROMPT = `You are the DM Brain for a D&D campaign. Generate a session prep briefing.
Identify 3-7 pressure points from the world state that need the DM's attention this session.
For each, write a specific scene or NPC behavior proposal the DM can use directly at the table.
Return ONLY valid JSON — no markdown, no explanation.`;

function buildPrompt(input: GenerateBriefingInput): string {
  const elevated = [
    { name: 'Political', value: input.worldState.pressurePolitical },
    { name: 'Supernatural', value: input.worldState.pressureSupernatural },
    { name: 'Economic', value: input.worldState.pressureEconomic },
    { name: 'Cosmic', value: input.worldState.pressureCosmic },
    { name: 'Social', value: input.worldState.pressureSocial },
  ]
    .filter((p) => p.value > 0.2)
    .sort((a, b) => b.value - a.value);

  return `World state:
Pressure tracks: ${elevated.map((p) => `${p.name}: ${(p.value * 100).toFixed(0)}%`).join(', ') || 'none elevated'}
Open hooks: ${input.worldState.hooks.map((h) => h.text).join(' | ') || 'none'}
Active threats: ${input.worldState.threats.map((t) => t.name ?? t.description ?? '').filter(Boolean).join(' | ') || 'none'}

Recent world changes:
${input.recentChanges.map((c) => `- ${c.entityName} (${c.entityType}): ${c.changeType}`).join('\n') || 'none'}

Notable entities:
${input.entities.slice(0, 15).map((e) => `- ${e.name} (${e.type})${e.description ? `: ${e.description.slice(0, 100)}` : ''}`).join('\n') || 'none'}

Generate 3-7 pressure point cards as JSON:
{
  "cards": [
    {
      "type": "FACTION" | "NPC" | "HOOK" | "REGION",
      "entityName": "name of the entity or hook",
      "urgencyLevel": 1-5,
      "context": "2-3 sentences: what the Brain knows about this entity, why it matters now",
      "proposal": "3-5 sentences: a specific scene, encounter, or NPC behavior the DM can run this session"
    }
  ]
}

Sort cards by urgencyLevel descending. urgencyLevel 5 = must address this session, 1 = background.`;
}

const ResponseSchema = z.object({
  cards: z.array(
    z.object({
      type: z.enum(['FACTION', 'NPC', 'HOOK', 'REGION']),
      entityName: z.string(),
      urgencyLevel: z.number().int().min(1).max(5),
      context: z.string(),
      proposal: z.string(),
    })
  ),
});

export async function generateBriefingCards(input: GenerateBriefingInput): Promise<BriefingCard[]> {
  const raw = await chatWithAI(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(input) },
    ],
    { temperature: 0.7 }
  );

  try {
    const jsonStr = raw.trim().match(/\{[\s\S]*\}/)?.[0] ?? raw.trim();
    const parsed = ResponseSchema.parse(JSON.parse(jsonStr));
    return parsed.cards.map((card) => ({
      ...card,
      id: crypto.randomUUID(),
      status: 'proposed' as const,
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/generate-briefing.ts
git commit -m "feat(prep): AI generate-briefing function"
```

---

## Task 3: sessions.generateBriefing tRPC procedure

**Files:**
- Modify: `src/server/routers/sessions.ts`

- [ ] **Step 1: Add imports to `src/server/routers/sessions.ts`**

After the existing import block (around line 20), add:
```typescript
import { generateBriefingCards } from '@/lib/ai/generate-briefing';
import { brainRepository } from '../repositories/brain.repository';
```

- [ ] **Step 2: Add the procedure**

Inside the `router({...})` call in `src/server/routers/sessions.ts`, add this procedure after `extractPrepFromNotes` (around line 557):

```typescript
  generateBriefing: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const [state, timeline, entities] = await Promise.all([
        brainRepository.getOrCreateState(input.campaignId),
        brainRepository.getTimeline(input.campaignId, 20),
        brainRepository.findEntities(input.campaignId, { status: 'active', limit: 20 }),
      ]);

      const hooks = Array.isArray(state.hooks)
        ? (state.hooks as Array<{ text: string; urgency: string; status?: string }>).filter(
            (h) => h.status === 'open' || !h.status
          )
        : [];

      const threats = Array.isArray(state.threats)
        ? (state.threats as Array<{ name?: string; description?: string }>)
        : [];

      const recentChanges = (() => {
        const seen = new Map<string, { entityName: string; entityType: string; changeType: string }>();
        for (const change of timeline) {
          if (change.entityId && change.entity && !seen.has(change.entityId)) {
            seen.set(change.entityId, {
              entityName: change.entity.name,
              entityType: change.entity.type,
              changeType: change.changeType,
            });
          }
        }
        return [...seen.values()].slice(0, 10);
      })();

      const cards = await generateBriefingCards({
        worldState: {
          pressurePolitical: state.pressurePolitical,
          pressureSupernatural: state.pressureSupernatural,
          pressureEconomic: state.pressureEconomic,
          pressureCosmic: state.pressureCosmic,
          pressureSocial: state.pressureSocial,
          hooks,
          threats,
        },
        recentChanges,
        entities: entities.map((e) => ({
          name: e.name,
          type: e.type,
          description: e.description,
        })),
      });

      return { cards };
    }),
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors related to new procedure. Fix any type errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/sessions.ts
git commit -m "feat(prep): sessions.generateBriefing tRPC procedure"
```

---

## Task 4: PressureCard component

**Files:**
- Create: `src/components/session/prep/pressure-card.tsx`

- [ ] **Step 1: Create `src/components/session/prep/pressure-card.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import type { BriefingCard, BriefingCardType } from '@/lib/briefing-types';

const TYPE_META: Record<BriefingCardType | 'CUSTOM', { label: string; color: string; bg: string; border: string; bar: string }> = {
  FACTION: {
    label: 'Faction',
    color: 'oklch(0.65 0.2 25)',
    bg: 'oklch(0.65 0.2 25 / 0.08)',
    border: 'oklch(0.65 0.2 25 / 0.4)',
    bar: 'oklch(0.65 0.2 25)',
  },
  NPC: {
    label: 'NPC',
    color: 'oklch(0.65 0.12 290)',
    bg: 'oklch(0.65 0.12 290 / 0.08)',
    border: 'oklch(0.65 0.12 290 / 0.4)',
    bar: 'oklch(0.6 0.1 200)',
  },
  HOOK: {
    label: 'Hook',
    color: 'oklch(0.7 0.16 55)',
    bg: 'oklch(0.7 0.16 55 / 0.08)',
    border: 'oklch(0.7 0.16 55 / 0.4)',
    bar: 'oklch(0.7 0.16 55)',
  },
  REGION: {
    label: 'Region',
    color: 'oklch(0.6 0.12 170)',
    bg: 'oklch(0.6 0.12 170 / 0.08)',
    border: 'oklch(0.6 0.12 170 / 0.4)',
    bar: 'oklch(0.6 0.12 170)',
  },
  CUSTOM: {
    label: 'Custom',
    color: 'oklch(0.55 0.01 270)',
    bg: 'oklch(0.55 0.01 270 / 0.08)',
    border: 'oklch(0.55 0.01 270 / 0.4)',
    bar: 'oklch(0.45 0.01 270)',
  },
};

function UrgencyPips({ level }: { level: number }) {
  const pipColor = (filled: boolean, level: number) => {
    if (!filled) return 'oklch(0.25 0.01 270)';
    if (level >= 4) return 'oklch(0.65 0.2 25)';
    if (level >= 3) return 'oklch(0.7 0.16 55)';
    return 'oklch(0.6 0.1 200)';
  };

  return (
    <div className="flex gap-[3px] items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="w-[5px] h-[5px] rounded-full"
          style={{ background: pipColor(i < level, level) }}
        />
      ))}
    </div>
  );
}

interface PressureCardProps {
  card: BriefingCard;
  onChange: (updated: BriefingCard) => void;
}

export function PressureCard({ card, onChange }: PressureCardProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(card.dmNote ?? card.proposal);
  const meta = TYPE_META[card.type] ?? TYPE_META.CUSTOM;

  if (card.status === 'accepted' || card.status === 'edited') {
    return (
      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: 'oklch(0.45 0.12 145 / 0.5)', background: 'oklch(0.13 0.008 160)' }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.bar}, transparent)` }} />
        <div className="px-4 py-2.5 flex items-center gap-3">
          <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'oklch(0.65 0.15 145)' }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-[family-name:var(--q-font-display)] text-xs"
                style={{ color: 'oklch(0.7 0.01 270)' }}
              >
                {card.entityName}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-sm border font-[family-name:var(--q-font-display)] uppercase tracking-wider"
                style={{ color: meta.color, borderColor: meta.border, background: meta.bg }}
              >
                {meta.label}
              </span>
              {card.status === 'edited' && (
                <span className="text-[9px] uppercase tracking-wider" style={{ color: 'oklch(0.5 0.01 270)' }}>
                  edited
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'oklch(0.5 0.01 270)' }}>
              {card.dmNote ?? card.proposal}
            </p>
          </div>
          <button
            onClick={() => onChange({ ...card, status: 'proposed', dmNote: undefined })}
            className="text-[10px] shrink-0"
            style={{ color: 'oklch(0.4 0.01 270)' }}
          >
            Undo
          </button>
        </div>
      </div>
    );
  }

  if (card.status === 'dismissed') {
    return (
      <div
        className="rounded-sm border px-4 py-2 flex items-center gap-3 opacity-40"
        style={{ borderColor: 'oklch(0.2 0.005 270)', background: 'oklch(0.12 0.005 265)' }}
      >
        <X className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.4 0.01 270)' }} />
        <span className="text-xs flex-1 truncate" style={{ color: 'oklch(0.45 0.01 270)' }}>
          {card.entityName} — dismissed
        </span>
        <button
          onClick={() => onChange({ ...card, status: 'proposed' })}
          className="text-[10px] shrink-0"
          style={{ color: 'oklch(0.45 0.01 270)' }}
        >
          Undo
        </button>
      </div>
    );
  }

  // dm-added cards collapse to the same accepted display once they exist (status is already 'dm-added' = in play)
  if (card.status === 'dm-added') {
    return (
      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: meta.border, background: 'oklch(0.14 0.005 265)' }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.bar}, transparent)` }} />
        <div className="px-4 py-2.5 flex items-center gap-3">
          <Plus className="h-3.5 w-3.5 shrink-0" style={{ color: 'oklch(0.55 0.01 270)' }} />
          <p className="text-[12.5px] flex-1" style={{ color: 'oklch(0.72 0.01 270)' }}>{card.proposal}</p>
          <button
            onClick={() => onChange({ ...card, status: 'dismissed' })}
            className="text-[10px] shrink-0"
            style={{ color: 'oklch(0.4 0.01 270)' }}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  // proposed state
  return (
    <div
      className="rounded-sm border overflow-hidden"
      style={{ borderColor: 'oklch(0.25 0.01 270)', background: 'oklch(0.14 0.005 265)' }}
    >
      <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.bar}, transparent)` }} />
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-sm border font-[family-name:var(--q-font-display)] uppercase tracking-wider shrink-0"
            style={{ color: meta.color, borderColor: meta.border, background: meta.bg }}
          >
            {meta.label}
          </span>
          <span
            className="font-[family-name:var(--q-font-display)] text-[13px] font-semibold flex-1 min-w-0 truncate"
            style={{ color: 'oklch(0.88 0.01 270)' }}
          >
            {card.entityName}
          </span>
          <UrgencyPips level={card.urgencyLevel} />
        </div>

        {card.context && (
          <p className="text-[12.5px] mb-3 leading-relaxed" style={{ color: 'oklch(0.65 0.01 270)' }}>
            {card.context}
          </p>
        )}

        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[8.5px] uppercase tracking-[0.2em] font-[family-name:var(--q-font-display)] whitespace-nowrap"
            style={{ color: 'oklch(0.7 0.16 55 / 0.7)' }}
          >
            Brain proposes
          </span>
          <div className="flex-1 h-px" style={{ background: 'oklch(0.7 0.16 55 / 0.2)' }} />
        </div>

        {editing ? (
          <div className="mb-3">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="w-full resize-none text-[13px] rounded-sm px-3 py-2 outline-none focus:ring-1 ring-amber-500/30"
              style={{
                background: 'oklch(0.11 0.005 265)',
                border: '1px solid oklch(0.35 0.08 55 / 0.5)',
                color: 'oklch(0.78 0.01 270)',
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>
        ) : (
          <p
            className="text-[13px] mb-3 leading-relaxed px-3 py-2 rounded-sm border-l-2"
            style={{
              background: 'oklch(0.11 0.005 265)',
              borderColor: 'oklch(0.7 0.16 55 / 0.3)',
              color: 'oklch(0.78 0.01 270)',
            }}
          >
            {card.dmNote ?? card.proposal}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          {editing ? (
            <>
              <button
                onClick={() => {
                  onChange({ ...card, status: 'edited', dmNote: editText });
                  setEditing(false);
                }}
                className="flex items-center gap-1 text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                style={{
                  background: 'oklch(0.45 0.12 145 / 0.15)',
                  borderColor: 'oklch(0.55 0.15 145 / 0.4)',
                  color: 'oklch(0.7 0.15 145)',
                }}
              >
                <Check className="h-3 w-3" /> Save
              </button>
              <button
                onClick={() => {
                  setEditText(card.dmNote ?? card.proposal);
                  setEditing(false);
                }}
                className="text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                style={{ borderColor: 'oklch(0.3 0.01 270)', color: 'oklch(0.55 0.01 270)' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onChange({ ...card, status: 'accepted' })}
                className="flex items-center gap-1 text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                style={{
                  background: 'oklch(0.45 0.12 145 / 0.15)',
                  borderColor: 'oklch(0.55 0.15 145 / 0.4)',
                  color: 'oklch(0.7 0.15 145)',
                }}
              >
                <Check className="h-3 w-3" /> Use this
              </button>
              <button
                onClick={() => {
                  setEditText(card.dmNote ?? card.proposal);
                  setEditing(true);
                }}
                className="flex items-center gap-1 text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                style={{ borderColor: 'oklch(0.3 0.01 270)', color: 'oklch(0.55 0.01 270)' }}
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={() => onChange({ ...card, status: 'dismissed' })}
                className="text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)] ml-auto"
                style={{ borderColor: 'oklch(0.25 0.01 270)', color: 'oklch(0.4 0.01 270)' }}
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: add `Plus` to the lucide import: `import { Check, X, Pencil, Plus } from 'lucide-react';`

- [ ] **Step 2: Commit**

```bash
git add src/components/session/prep/pressure-card.tsx
git commit -m "feat(prep): PressureCard component with all states"
```

---

## Task 5: PartyStateSection component

**Files:**
- Create: `src/components/session/prep/party-state-section.tsx`

- [ ] **Step 1: Create `src/components/session/prep/party-state-section.tsx`**

```typescript
'use client';

import { Users } from 'lucide-react';
import { StepCharacters } from './steps/step-characters';
import type { CharacterNote } from '@/lib/prep-types';

interface PartyStateSectionProps {
  characterNotes: CharacterNote[];
  onChange: (notes: CharacterNote[]) => void;
}

export function PartyStateSection({ characterNotes, onChange }: PartyStateSectionProps) {
  if (characterNotes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-3.5 w-3.5" style={{ color: 'oklch(0.7 0.16 55)' }} />
        <span
          className="font-[family-name:var(--q-font-display)] text-[9px] uppercase tracking-[0.2em]"
          style={{ color: 'oklch(0.7 0.16 55)' }}
        >
          Party State
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: 'linear-gradient(to right, oklch(0.7 0.16 55 / 0.4), transparent)' }}
        />
      </div>
      <StepCharacters characterNotes={characterNotes} onChange={onChange} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session/prep/party-state-section.tsx
git commit -m "feat(prep): PartyStateSection component"
```

---

## Task 6: BriefingBoard component

**Files:**
- Create: `src/components/session/prep/briefing-board.tsx`

- [ ] **Step 1: Create `src/components/session/prep/briefing-board.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PressureCard } from './pressure-card';
import type { BriefingCard } from '@/lib/briefing-types';

interface BriefingBoardProps {
  sessionId: string;
  campaignId: string;
  cards: BriefingCard[];
  onCardsChange: (cards: BriefingCard[]) => void;
}

export function BriefingBoard({ sessionId, campaignId, cards, onCardsChange }: BriefingBoardProps) {
  const [addingCard, setAddingCard] = useState(false);
  const [newCardText, setNewCardText] = useState('');

  const generateMutation = trpc.sessions.generateBriefing.useMutation({
    onSuccess: (data) => onCardsChange(data.cards),
  });

  useEffect(() => {
    if (cards.length === 0 && !generateMutation.isPending) {
      generateMutation.mutate({ sessionId, campaignId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateCard(updated: BriefingCard) {
    onCardsChange(cards.map((c) => (c.id === updated.id ? updated : c)));
  }

  function addDmCard() {
    if (!newCardText.trim()) return;
    const card: BriefingCard = {
      id: crypto.randomUUID(),
      type: 'CUSTOM',
      entityName: 'DM Note',
      urgencyLevel: 3,
      context: '',
      proposal: newCardText.trim(),
      status: 'dm-added',
    };
    onCardsChange([...cards, card]);
    setNewCardText('');
    setAddingCard(false);
  }

  const reviewed = cards.filter((c) => c.status !== 'proposed').length;
  const total = cards.length;

  if (generateMutation.isPending) {
    return (
      <div className="flex items-center justify-center gap-3 py-16">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'oklch(0.7 0.16 55)' }} />
        <span className="text-sm" style={{ color: 'oklch(0.5 0.01 270)' }}>
          Brain is generating your briefing…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className="font-[family-name:var(--q-font-display)] text-[9px] uppercase tracking-[0.2em]"
            style={{ color: 'oklch(0.7 0.16 55)' }}
          >
            World Pressure
          </span>
          <div
            className="h-px w-16"
            style={{ background: 'linear-gradient(to right, oklch(0.7 0.16 55 / 0.4), transparent)' }}
          />
        </div>
        {total > 0 && (
          <button
            onClick={() => generateMutation.mutate({ sessionId, campaignId })}
            disabled={generateMutation.isPending}
            className="flex items-center gap-1 text-[10px]"
            style={{ color: 'oklch(0.4 0.01 270)' }}
          >
            <RefreshCw className="h-3 w-3" /> Regenerate
          </button>
        )}
      </div>

      {generateMutation.isError && total === 0 && (
        <p className="text-xs py-6 text-center" style={{ color: 'oklch(0.45 0.01 270)' }}>
          No world data yet. Run a few sessions and process summaries to build up Brain context —
          or use the import zone below to brief Brain with your notes.
        </p>
      )}

      {cards.map((card) => (
        <PressureCard key={card.id} card={card} onChange={updateCard} />
      ))}

      {addingCard ? (
        <div
          className="rounded-sm border p-3 space-y-2"
          style={{ borderColor: 'oklch(0.25 0.01 270)', background: 'oklch(0.14 0.005 265)' }}
        >
          <textarea
            placeholder="Describe a scene, NPC, or element you want to include this session…"
            value={newCardText}
            onChange={(e) => setNewCardText(e.target.value)}
            rows={3}
            className="w-full resize-none text-sm rounded-sm px-3 py-2 outline-none focus:ring-1 ring-amber-500/30"
            style={{
              background: 'oklch(0.11 0.005 265)',
              border: '1px solid oklch(0.3 0.01 270)',
              color: 'oklch(0.78 0.01 270)',
            }}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={addDmCard}
              className="text-xs px-3 py-1.5 rounded-sm border"
              style={{
                background: 'oklch(0.2 0.04 55 / 0.3)',
                borderColor: 'oklch(0.35 0.1 55)',
                color: 'oklch(0.7 0.16 55)',
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setAddingCard(false); setNewCardText(''); }}
              className="text-xs px-3 py-1.5 rounded-sm border"
              style={{ borderColor: 'oklch(0.25 0.01 270)', color: 'oklch(0.45 0.01 270)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingCard(true)}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-sm border text-xs transition-colors"
          style={{
            borderStyle: 'dashed',
            borderColor: 'oklch(0.28 0.01 270)',
            color: 'oklch(0.4 0.01 270)',
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add something Brain missed
        </button>
      )}

      {total > 0 && (
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: 'oklch(0.2 0.005 270)' }}
        >
          <span className="text-xs" style={{ color: 'oklch(0.45 0.01 270)' }}>
            {reviewed} of {total} reviewed
          </span>
          <span
            className="text-[10px]"
            style={{ color: reviewed === total ? 'oklch(0.65 0.15 145)' : 'oklch(0.4 0.01 270)' }}
          >
            {reviewed === total ? '✓ All cards reviewed' : 'Review all cards to unlock Ready to Run'}
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session/prep/briefing-board.tsx
git commit -m "feat(prep): BriefingBoard component"
```

---

## Task 7: Wire PrepWorkspace — replace section grid

**Files:**
- Modify: `src/components/session/prep/prep-workspace.tsx`

- [ ] **Step 1: Replace imports in `prep-workspace.tsx`**

Remove these imports entirely:
```typescript
import { PrepSectionNav, PREP_SECTIONS, type SectionId } from './prep-section-nav';
import { PrepSectionCard } from './prep-section-card';
import { PrepBrainContextCard } from './prep-brain-context-card';
import { StepCharacters } from './steps/step-characters';
import { StepStrongStart } from './steps/step-strong-start';
import { StepScenes } from './steps/step-scenes';
import { StepSecrets } from './steps/step-secrets';
import { StepNpcs } from './steps/step-npcs';
import { StepMonsters } from './steps/step-monsters';
import { StepRewards } from './steps/step-rewards';
import { StepLooseThreads } from './steps/step-loose-threads';
```

Add these imports:
```typescript
import { BriefingBoard } from './briefing-board';
import { PartyStateSection } from './party-state-section';
import type { BriefingCard } from '@/lib/briefing-types';
```

Remove `type BrainSectionKey`, `BrainSuggestionState`, `BrainSuggestButton`, and `SECTION_DESCRIPTIONS` definitions.

- [ ] **Step 2: Remove unused state and handlers**

In the `PrepWorkspace` function body, remove:
- `const [activeSection, setActiveSection] = useState<SectionId | undefined>(undefined);`
- `const [suggestedCounts, setSuggestedCounts] = useState<Record<string, number>>({});`
- `const [brainDrawerOpen, setBrainDrawerOpen] = useState(false);`
- The `completedSections` useMemo block
- The `scrollToSection` function
- The `handleBrainSuggest` useCallback

Keep: `prepData`, `title`, `setPrepData`, `setTitle`, `updatePrep`, `updateSession`, `completePrep`, `useAutoSave`, `lastImport`.

- [ ] **Step 3: Replace `handleExtracted` with briefing-card-aware version**

Replace the existing `handleExtracted` function with:
```typescript
function handleExtracted(extracted: Partial<SessionPrepData>) {
  const parts: string[] = [];
  if (extracted.strongStart) parts.push(`Strong start: ${extracted.strongStart}`);
  if (extracted.scenes?.length) parts.push(`Scenes: ${extracted.scenes.map((s) => s.title).join(', ')}`);
  if (extracted.npcs?.length) parts.push(`NPCs: ${extracted.npcs.map((n) => n.name).join(', ')}`);
  if (extracted.looseThreads?.length) parts.push(`Threads: ${extracted.looseThreads.map((t) => t.text.slice(0, 60)).join(', ')}`);

  if (parts.length === 0) return;

  const card: BriefingCard = {
    id: crypto.randomUUID(),
    type: 'CUSTOM',
    entityName: 'Imported Notes',
    urgencyLevel: 3,
    context: 'Extracted from your imported notes.',
    proposal: parts.join('\n'),
    status: 'dm-added',
  };
  setPrepData((p) => ({ ...p, briefingCards: [...(p.briefingCards ?? []), card] }));
  const importedAt = new Date().toISOString();
  setPrepData((p) => ({
    ...p,
    importedNotes: [...(p.importedNotes ?? []), { extractedAt: importedAt, sectionCounts: {} }],
  }));
}
```

Note: the `PrepImportZone` `onExtracted` prop signature was `(data: Partial<SessionPrepData>, sectionCounts: Record<string, number>) => void`. Update the call to match the new signature:
```tsx
<PrepImportZone
  sessionId={sessionId}
  campaignId={campaignId}
  onExtracted={(data) => handleExtracted(data)}
  lastImportedAt={lastImport?.extractedAt}
/>
```

- [ ] **Step 4: Replace the main content area**

Find the `<main className="flex-1 min-w-0">` block. Replace everything inside `<div className="px-6 py-6 space-y-4">` with:

```tsx
<div className="px-6 py-6 space-y-6">
  <PrepImportZone
    sessionId={sessionId}
    campaignId={campaignId}
    onExtracted={(data) => handleExtracted(data)}
    lastImportedAt={lastImport?.extractedAt}
  />

  <BriefingBoard
    sessionId={sessionId}
    campaignId={campaignId}
    cards={prepData.briefingCards ?? []}
    onCardsChange={(cards) => setPrepData((p) => ({ ...p, briefingCards: cards }))}
  />

  <PartyStateSection
    characterNotes={prepData.characterNotes}
    onChange={(notes) => setPrepData((p) => ({ ...p, characterNotes: notes }))}
  />
</div>
```

- [ ] **Step 5: Remove the aside (section nav sidebar)**

Remove the entire `{!inline && (<aside ...><PrepSectionNav .../></aside>)}` block.

- [ ] **Step 6: Remove `PrepBrainContextCard` render**

Remove `{!inline && <PrepBrainContextCard campaignId={campaignId} />}`.

- [ ] **Step 7: Update the mobile bottom bar**

Replace the mobile bottom bar's section count with card review count:
```tsx
{!inline && (
  <div
    className="md:hidden border-t border-border/50 px-4 py-3 flex items-center justify-between"
    style={{ background: 'hsl(240 10% 5% / 0.97)', backdropFilter: 'blur(12px)' }}
  >
    <span className="text-xs" style={{ color: 'hsl(35 10% 48%)' }}>
      {(prepData.briefingCards ?? []).filter((c) => c.status !== 'proposed').length} /{' '}
      {(prepData.briefingCards ?? []).length} reviewed
    </span>
    <button
      onClick={() => completePrep.mutate({ id: sessionId })}
      disabled={completePrep.isPending}
      className="text-xs font-semibold px-3 py-1.5 rounded-sm"
      style={{ background: 'hsl(35 70% 18%)', border: '1px solid hsl(35 60% 32%)', color: 'hsl(35 80% 65%)' }}
    >
      {completePrep.isPending ? 'Saving…' : 'Mark Complete'}
    </button>
  </div>
)}
```

- [ ] **Step 8: Type check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors. Common ones: `handleExtracted` signature mismatch, unused imports.

- [ ] **Step 9: Commit**

```bash
git add src/components/session/prep/prep-workspace.tsx
git commit -m "feat(prep): wire PrepWorkspace to BriefingBoard + PartyStateSection"
```

---

## Task 8: Delete orphaned section components

**Files:**
- Delete: 8 step files + `prep-section-card.tsx`

- [ ] **Step 1: Verify no other file imports the files to be deleted**

```bash
npx grep -r "step-strong-start\|step-scenes\|step-secrets\|step-npcs\|step-monsters\|step-rewards\|step-loose-threads\|PrepSectionCard\|prep-section-card" src/ --include="*.tsx" --include="*.ts" -l
```

Expected output: empty (only `prep-workspace.tsx` should have imported them, now cleaned up).

If any other file appears in the output, remove its import first before deleting.

- [ ] **Step 2: Delete files**

```bash
Remove-Item "src/components/session/prep/prep-section-card.tsx"
Remove-Item "src/components/session/prep/steps/step-strong-start.tsx"
Remove-Item "src/components/session/prep/steps/step-scenes.tsx"
Remove-Item "src/components/session/prep/steps/step-secrets.tsx"
Remove-Item "src/components/session/prep/steps/step-npcs.tsx"
Remove-Item "src/components/session/prep/steps/step-monsters.tsx"
Remove-Item "src/components/session/prep/steps/step-rewards.tsx"
Remove-Item "src/components/session/prep/steps/step-loose-threads.tsx"
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(prep): delete orphaned Lazy DM section components"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run E2E workflow spec**

```bash
npx playwright test tests/workflows/session-prep-briefing.workflow.spec.ts --reporter=line
```

Expected: all 5 tests pass. If any fail, fix and re-run.

- [ ] **Step 2: Type check clean**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Verify no old section references remain in prep components**

```bash
npx grep -r "strongStart\|looseThreads\|secretsAndClues\|PrepSectionCard\|PREP_SECTIONS\|SectionId\|completedSections" src/components/session/prep/ --include="*.tsx" --include="*.ts"
```

Expected: any hits should only be in `prep-types.ts` (the schema fields still exist for backward compat) and `prep-import-zone.tsx` (it uses the old extraction schema). Hits inside component files mean cleanup was incomplete.

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage check:**
- ✅ Drop Lazy DM checklist → Tasks 7–8 remove the section grid and delete step components
- ✅ Brain surfaces pressure cards → Task 3 (`generateBriefing` procedure) + Task 6 (`BriefingBoard` auto-generates on mount)
- ✅ Accept / Edit inline / Dismiss → Task 4 (`PressureCard` all states)
- ✅ DM Adds → Task 6 (`addDmCard` in `BriefingBoard`)
- ✅ Party State section → Task 5 (`PartyStateSection` wraps `StepCharacters`)
- ✅ Import zone repurposed → Task 7 (`handleExtracted` converts to briefing cards)
- ✅ Backward compat → `briefingCards` is `optional().default([])` in schema; old sessions unaffected
- ✅ Regenerate button → Task 6 (`BriefingBoard` Regenerate button)
- ✅ `reviewed` gate signal → Task 6 footer count + `✓ All cards reviewed` message

**Type consistency:**
- `BriefingCard` defined in `briefing-types.ts`, imported by `prep-types.ts`, `pressure-card.tsx`, `briefing-board.tsx`, `prep-workspace.tsx` — all use same type
- `generateBriefingCards` (AI function in `generate-briefing.ts`) → `generateBriefing` procedure in `sessions.ts` calls it as `generateBriefingCards(...)` — no name collision
- `onExtracted` signature in `PrepImportZone`: `(data: Partial<SessionPrepData>, sectionCounts: Record<string, number>) => void` — Task 7 Step 3 updates the call to `(data) => handleExtracted(data)` (second arg ignored, TypeScript compatible)

**No placeholders:** all steps contain complete code or exact commands.
