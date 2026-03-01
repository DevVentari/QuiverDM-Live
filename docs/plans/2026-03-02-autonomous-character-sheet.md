# Autonomous Character Sheet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a two-phase system where homebrew items/spells/feats carry structured executable mechanics, and session transcripts autonomously drive character sheet updates in real-time with post-session review.

**Architecture:** Phase 1 expands the effect schema and AI extraction pipeline so homebrew actually modifies character stats via an effect resolver service. Phase 2 adds a BullMQ worker that processes transcript chunks, emits `SessionMechanicalEvent` records, and keeps a live `CharacterSessionState` per character per session — cockpit consumes live state, post-session review commits events permanently to character sheets.

**Tech Stack:** Zod (schema), Prisma (models), BullMQ (workers), tRPC (API), React (UI), Ollama/Gemini (AI), Vitest (unit tests)

---

## Phase 1: Effect Schema + AI Extraction + Live Effects

---

### Task 1: Expand effect schema in dnd-schemas.ts

**Files:**
- Modify: `src/lib/dnd-schemas.ts:116-132` (ItemEffectMechanicSchema, ItemEffectSchema)
- Modify: `src/lib/dnd-schemas.ts:43-72` (SpellSchema — add effects field)
- Modify: `src/lib/dnd-schemas.ts:231-243` (FeatSchema — add effects field)

**Step 1: Replace ItemEffectMechanicSchema**

Find lines 116-124 and replace with:

```typescript
export const EffectActivationSchema = z.enum([
  'passive', 'concentration', 'action', 'bonus_action', 'reaction',
]);

export const ItemEffectMechanicSchema = z.object({
  type: z.enum([
    'advantage', 'disadvantage', 'damage_bypass',
    'ac_bonus', 'attack_bonus', 'damage_bonus',
    'ability_bonus', 'saving_throw_bonus', 'skill_bonus',
    'resistance', 'immunity', 'vulnerability',
    'spell_attack_bonus', 'save_dc_bonus',
    'initiative_bonus', 'speed_bonus', 'max_hp_bonus',
    'concentration_advantage', 'death_save_advantage',
    'custom',
  ]),
  target: z.string().optional(),       // "dexterity", "constitution saving throw", "stealth", "fire"
  value: z.union([z.number(), z.string()]).optional(), // number or dice "1d4"
  condition: z.string().optional(),    // "while attuned", "when below half HP"
  activation: EffectActivationSchema.optional(),
  duration: z.string().optional(),     // "1 minute", "until long rest", "permanent"
  uses: z.object({
    max: z.number().int().positive(),
    per: z.enum(['long_rest', 'short_rest', 'day']),
  }).optional(),
});
```

**Step 2: Add effects to SpellSchema**

After the `classes` field (line ~69), add:
```typescript
  effects: z.array(ItemEffectSchema).optional(),
```

**Step 3: Add effects to FeatSchema**

After the `abilityScoreIncrease` field (line ~239), add:
```typescript
  effects: z.array(ItemEffectSchema).optional(),
```

**Step 4: Add effects to MagicItemSchema**

After the `source` field (line ~107), add:
```typescript
  effects: z.array(ItemEffectSchema).optional(),
```

**Step 5: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 6: Commit**

```bash
git add src/lib/dnd-schemas.ts
git commit -m "feat(schema): expand effect mechanic types, add effects to spell/feat/item schemas"
```

---

### Task 2: Update extraction prompt to request effects

**Files:**
- Modify: `src/lib/ai/extraction.ts:34-95` (EXTRACTION_PROMPT constant)

**Step 1: Add effects instructions to EXTRACTION_PROMPT**

In the EXTRACTION_PROMPT string, after the imagePromptHint instructions (line ~59), add a new section before the "Return a JSON array" line:

```
For magic_items, spells, and feats, also extract an "effects" array if the content grants mechanical bonuses. Each effect:
{
  "name": "short effect name",
  "description": "plain English description of what it does",
  "mechanic": {
    "type": "ac_bonus" | "attack_bonus" | "damage_bonus" | "ability_bonus" | "saving_throw_bonus" | "skill_bonus" | "resistance" | "immunity" | "advantage" | "disadvantage" | "spell_attack_bonus" | "save_dc_bonus" | "initiative_bonus" | "speed_bonus" | "max_hp_bonus" | "concentration_advantage" | "death_save_advantage" | "damage_bypass" | "vulnerability" | "custom",
    "target": "what it applies to (e.g. dexterity, fire, stealth, constitution saving throw)",
    "value": numeric bonus or dice string like "1d4",
    "condition": "when it applies (e.g. while equipped, while attuned)",
    "activation": "passive" | "concentration" | "action" | "bonus_action" | "reaction",
    "duration": "how long (e.g. 1 minute, until long rest, permanent)"
  }
}

Examples:
- "Ring of Protection: +1 to AC and saving throws" → effects: [{ name: "AC Bonus", mechanic: { type: "ac_bonus", value: 1, activation: "passive" } }, { name: "Saving Throw Bonus", mechanic: { type: "saving_throw_bonus", value: 1, activation: "passive" } }]
- "Bless: targets add 1d4 to attack rolls and saving throws" → effects: [{ name: "Attack Bonus", mechanic: { type: "attack_bonus", value: "1d4", activation: "concentration", duration: "1 minute" } }, { name: "Save Bonus", mechanic: { type: "saving_throw_bonus", value: "1d4", activation: "concentration", duration: "1 minute" } }]
- "Alert feat: +5 to initiative" → effects: [{ name: "Initiative Bonus", mechanic: { type: "initiative_bonus", value: 5, activation: "passive" } }]

Only include effects that have clear mechanical numbers or dice. Skip flavor-only descriptions.
```

**Step 2: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/lib/ai/extraction.ts
git commit -m "feat(extraction): request structured effects array from AI for items/spells/feats"
```

---

### Task 3: Effect Resolver Service

**Files:**
- Create: `src/server/services/effect-resolver.ts`
- Create: `src/tests/services/effect-resolver.test.ts`

**Step 1: Write failing test**

```typescript
// src/tests/services/effect-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveEffects } from '@/server/services/effect-resolver';
import type { ResolvedEffects, RawEffectSource } from '@/server/services/effect-resolver';

describe('resolveEffects', () => {
  it('stacks multiple ac_bonus effects', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'item-1', sourceName: 'Ring of Protection', sourceType: 'item',
        active: true,
        effects: [{ name: 'AC', description: '+1 AC', mechanic: { type: 'ac_bonus', value: 1, activation: 'passive' } }],
      },
      {
        sourceId: 'item-2', sourceName: 'Shield +1', sourceType: 'item',
        active: true,
        effects: [{ name: 'AC', description: '+1 AC', mechanic: { type: 'ac_bonus', value: 1, activation: 'passive' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.acBonus).toBe(2);
    expect(result.acBonusBreakdown).toHaveLength(2);
  });

  it('ignores inactive sources', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'spell-1', sourceName: 'Bless', sourceType: 'spell',
        active: false,
        effects: [{ name: 'Attack', description: '+1d4', mechanic: { type: 'attack_bonus', value: '1d4', activation: 'concentration' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.attackBonusBreakdown).toHaveLength(0);
  });

  it('collects resistances from multiple sources', () => {
    const sources: RawEffectSource[] = [
      {
        sourceId: 'item-1', sourceName: 'Cloak of Fire Resistance', sourceType: 'item',
        active: true,
        effects: [{ name: 'Fire Resistance', description: 'Resistant to fire', mechanic: { type: 'resistance', target: 'fire', activation: 'passive' } }],
      },
    ];
    const result = resolveEffects(sources);
    expect(result.resistances).toContain('fire');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/services/effect-resolver.test.ts
```
Expected: FAIL — `resolveEffects` not found.

**Step 3: Implement the service**

```typescript
// src/server/services/effect-resolver.ts
import type { ItemEffect } from '@/lib/dnd-schemas';

export interface RawEffectSource {
  sourceId: string;
  sourceName: string;
  sourceType: 'item' | 'spell' | 'feat';
  active: boolean;
  effects: ItemEffect[];
}

export interface EffectBreakdownEntry {
  source: string;
  sourceId: string;
  value: number | string;
}

export interface ResolvedEffects {
  acBonus: number;
  acBonusBreakdown: EffectBreakdownEntry[];
  attackBonusBreakdown: EffectBreakdownEntry[];
  damageBonusBreakdown: EffectBreakdownEntry[];
  savingThrowBonuses: Record<string, EffectBreakdownEntry[]>;
  skillBonuses: Record<string, EffectBreakdownEntry[]>;
  abilityBonuses: Record<string, EffectBreakdownEntry[]>;
  initiativeBonus: number;
  speedBonus: number;
  maxHpBonus: number;
  spellAttackBonus: number;
  saveDcBonus: number;
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  hasConcentrationAdvantage: boolean;
  hasDeathSaveAdvantage: boolean;
  advantageOn: string[];
  disadvantageOn: string[];
}

export function resolveEffects(sources: RawEffectSource[]): ResolvedEffects {
  const result: ResolvedEffects = {
    acBonus: 0,
    acBonusBreakdown: [],
    attackBonusBreakdown: [],
    damageBonusBreakdown: [],
    savingThrowBonuses: {},
    skillBonuses: {},
    abilityBonuses: {},
    initiativeBonus: 0,
    speedBonus: 0,
    maxHpBonus: 0,
    spellAttackBonus: 0,
    saveDcBonus: 0,
    resistances: [],
    immunities: [],
    vulnerabilities: [],
    hasConcentrationAdvantage: false,
    hasDeathSaveAdvantage: false,
    advantageOn: [],
    disadvantageOn: [],
  };

  for (const source of sources) {
    if (!source.active) continue;
    for (const effect of source.effects) {
      const m = effect.mechanic;
      if (!m) continue;
      const entry: EffectBreakdownEntry = { source: source.sourceName, sourceId: source.sourceId, value: m.value ?? 0 };
      const numVal = typeof m.value === 'number' ? m.value : 0;

      switch (m.type) {
        case 'ac_bonus':
          result.acBonus += numVal;
          result.acBonusBreakdown.push(entry);
          break;
        case 'attack_bonus':
          result.attackBonusBreakdown.push(entry);
          break;
        case 'damage_bonus':
          result.damageBonusBreakdown.push(entry);
          break;
        case 'saving_throw_bonus': {
          const key = (m.target ?? 'all').toLowerCase();
          (result.savingThrowBonuses[key] ??= []).push(entry);
          break;
        }
        case 'skill_bonus': {
          const key = (m.target ?? 'all').toLowerCase();
          (result.skillBonuses[key] ??= []).push(entry);
          break;
        }
        case 'ability_bonus': {
          const key = (m.target ?? 'all').toLowerCase();
          (result.abilityBonuses[key] ??= []).push(entry);
          break;
        }
        case 'initiative_bonus':
          result.initiativeBonus += numVal;
          break;
        case 'speed_bonus':
          result.speedBonus += numVal;
          break;
        case 'max_hp_bonus':
          result.maxHpBonus += numVal;
          break;
        case 'spell_attack_bonus':
          result.spellAttackBonus += numVal;
          break;
        case 'save_dc_bonus':
          result.saveDcBonus += numVal;
          break;
        case 'resistance':
          if (m.target && !result.resistances.includes(m.target)) result.resistances.push(m.target);
          break;
        case 'immunity':
          if (m.target && !result.immunities.includes(m.target)) result.immunities.push(m.target);
          break;
        case 'vulnerability':
          if (m.target && !result.vulnerabilities.includes(m.target)) result.vulnerabilities.push(m.target);
          break;
        case 'concentration_advantage':
          result.hasConcentrationAdvantage = true;
          break;
        case 'death_save_advantage':
          result.hasDeathSaveAdvantage = true;
          break;
        case 'advantage':
          if (m.target) result.advantageOn.push(m.target);
          break;
        case 'disadvantage':
          if (m.target) result.disadvantageOn.push(m.target);
          break;
      }
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/services/effect-resolver.test.ts
```
Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add src/server/services/effect-resolver.ts src/tests/services/effect-resolver.test.ts
git commit -m "feat(resolver): add effect resolver service — stacks homebrew mechanics into resolved stats"
```

---

### Task 4: Add getResolvedStats query to characters router

**Files:**
- Modify: `src/server/services/character.service.ts` — add `getResolvedEffectSources` method
- Modify: `src/server/routers/characters.ts` — add `getResolvedStats` query

**Step 1: Add service method to character.service.ts**

Find the `getEquippedEffects` method (around line 309) and add a new method after it:

```typescript
async getResolvedEffectSources(characterId: string, userId: string): Promise<import('@/server/services/effect-resolver').RawEffectSource[]> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { userId: true },
  });
  if (!character) throw new NotFoundError('character', characterId);
  if (character.userId !== userId) throw ForbiddenError.forPermission('view', 'Character');

  const [items, spells, feats] = await Promise.all([
    prisma.characterItem.findMany({
      where: { characterId, equipped: true },
      include: { homebrew: { select: { id: true, name: true, data: true } } },
    }),
    prisma.characterSpell.findMany({
      where: { characterId },
      include: { homebrew: { select: { id: true, name: true, data: true } } },
    }),
    prisma.characterFeat.findMany({
      where: { characterId },
      include: { homebrew: { select: { id: true, name: true, data: true } } },
    }),
  ]);

  const toSource = (
    type: 'item' | 'spell' | 'feat',
    id: string,
    name: string,
    data: Record<string, unknown>,
    active: boolean
  ): import('@/server/services/effect-resolver').RawEffectSource => ({
    sourceId: id,
    sourceName: name,
    sourceType: type,
    active,
    effects: Array.isArray(data.effects) ? (data.effects as any[]).filter(
      (e): e is { name: string; description: string } =>
        typeof e?.name === 'string' && typeof e?.description === 'string'
    ) : [],
  });

  return [
    ...items.map((ci) => toSource('item', ci.homebrew.id, ci.homebrew.name, ci.homebrew.data as Record<string, unknown>, ci.equipped)),
    ...spells.map((cs) => toSource('spell', cs.homebrew.id, cs.homebrew.name, cs.homebrew.data as Record<string, unknown>, true)),
    ...feats.map((cf) => toSource('feat', cf.homebrew.id, cf.homebrew.name, cf.homebrew.data as Record<string, unknown>, true)),
  ];
}
```

**Step 2: Add getResolvedStats to characters router**

Find the `getEquippedEffects` query in `src/server/routers/characters.ts` (around line 512) and add after it:

```typescript
getResolvedStats: protectedProcedure
  .input(z.object({ characterId: z.string() }))
  .query(async ({ input, ctx }) => {
    const { resolveEffects } = await import('@/server/services/effect-resolver');
    const sources = await characterService.getResolvedEffectSources(input.characterId, ctx.session.user.id);
    return resolveEffects(sources);
  }),
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/server/services/character.service.ts src/server/routers/characters.ts
git commit -m "feat(characters): add getResolvedStats query — resolves all equipped/active homebrew effects into computed stats"
```

---

### Task 5: Effect Confirmation Panel component

**Files:**
- Create: `src/components/homebrew/EffectConfirmationPanel.tsx`

**Step 1: Create the component**

```typescript
// src/components/homebrew/EffectConfirmationPanel.tsx
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { ItemEffect } from '@/lib/dnd-schemas';

interface EffectConfirmationPanelProps {
  effects: ItemEffect[];
  onChange: (effects: ItemEffect[]) => void;
}

export function EffectConfirmationPanel({ effects, onChange }: EffectConfirmationPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (effects.length === 0) return null;

  function removeEffect(idx: number) {
    onChange(effects.filter((_, i) => i !== idx));
  }

  function updateValue(idx: number, value: string) {
    const parsed = Number(value);
    const updated = effects.map((e, i) => {
      if (i !== idx || !e.mechanic) return e;
      return { ...e, mechanic: { ...e.mechanic, value: isNaN(parsed) ? value : parsed } };
    });
    onChange(updated);
  }

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-sm font-medium text-amber-300"
      >
        <Zap className="h-3.5 w-3.5" />
        Detected Mechanics ({effects.length})
        {expanded ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </button>

      {expanded && (
        <div className="space-y-1.5 pt-1">
          {effects.map((effect, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded bg-background/40 px-2 py-1.5 text-xs">
              <span className="flex-1 font-medium truncate">{effect.name}</span>
              {effect.mechanic && (
                <>
                  <Badge variant="secondary" className="text-xs capitalize shrink-0">
                    {effect.mechanic.type.replace(/_/g, ' ')}
                  </Badge>
                  {effect.mechanic.value != null && (
                    <Input
                      className="h-6 w-14 text-xs px-1.5"
                      value={String(effect.mechanic.value)}
                      onChange={(e) => updateValue(idx, e.target.value)}
                    />
                  )}
                  {effect.mechanic.target && (
                    <span className="text-muted-foreground shrink-0">{effect.mechanic.target}</span>
                  )}
                </>
              )}
              <button type="button" onClick={() => removeEffect(idx)} className="text-muted-foreground hover:text-destructive shrink-0">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-0.5">
            Review AI-detected mechanics. Remove any that are wrong.
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/components/homebrew/EffectConfirmationPanel.tsx
git commit -m "feat(homebrew): add EffectConfirmationPanel — shows AI-detected mechanics before save with inline editing"
```

---

### Task 6: Wire EffectConfirmationPanel into homebrew create/edit flow

**Files:**
- Modify: `src/components/homebrew/create-homebrew-dialog.tsx` — add effects state + panel

**Step 1: Read the file first**

```bash
# Read src/components/homebrew/create-homebrew-dialog.tsx to understand structure
```

Use the Read tool on `src/components/homebrew/create-homebrew-dialog.tsx`.

**Step 2: Add effects state and panel**

In the dialog component:
1. Add state: `const [detectedEffects, setDetectedEffects] = useState<ItemEffect[]>([]);`
2. When the form's description field is blurred (or the extraction result comes back from the API), populate `detectedEffects` from the returned extraction data's `effects` array
3. Render `<EffectConfirmationPanel effects={detectedEffects} onChange={setDetectedEffects} />` above the submit button
4. Include `detectedEffects` in the data passed to the create mutation

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/components/homebrew/create-homebrew-dialog.tsx
git commit -m "feat(homebrew): wire EffectConfirmationPanel into create dialog"
```

---

### Task 7: Update CharacterActiveEffects to use resolver

**Files:**
- Modify: `src/components/character/CharacterActiveEffects.tsx`

**Step 1: Update component to use getResolvedStats**

Replace the existing `trpc.characters.getEquippedEffects` query with `trpc.characters.getResolvedStats`. Update rendering to show the full breakdown — AC bonus, attack bonus entries, resistances, etc. from the resolved stats object.

Key changes:
- Query: `trpc.characters.getResolvedStats.useQuery({ characterId })`
- Show `acBonusBreakdown` entries instead of manually computing
- Add sections for resistances/immunities, advantage sources, initiative/speed bonuses
- Each entry shows `+value from sourceName`

**Step 2: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/components/character/CharacterActiveEffects.tsx
git commit -m "feat(character): update CharacterActiveEffects to use resolved stats with full breakdown"
```

---

### Task 8: ResolvedStatsSummary component

**Files:**
- Create: `src/components/character/ResolvedStatsSummary.tsx`
- Modify: `src/app/(app)/characters/[characterId]/page.tsx` — add summary below HeroStatBar

**Step 1: Create the component**

```typescript
// src/components/character/ResolvedStatsSummary.tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface ResolvedStatsSummaryProps {
  characterId: string;
  baseAc: number;
}

export function ResolvedStatsSummary({ characterId, baseAc }: ResolvedStatsSummaryProps) {
  const { data } = trpc.characters.getResolvedStats.useQuery({ characterId }, { staleTime: 60_000 });

  if (!data) return null;

  const hasModifiers =
    data.acBonus !== 0 ||
    data.attackBonusBreakdown.length > 0 ||
    data.resistances.length > 0 ||
    data.immunities.length > 0;

  if (!hasModifiers) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {data.acBonus !== 0 && (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-xs cursor-default">
              AC {baseAc + data.acBonus} (+{data.acBonus})
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {data.acBonusBreakdown.map((e, i) => (
              <div key={i} className="text-xs">+{e.value} from {e.source}</div>
            ))}
          </TooltipContent>
        </Tooltip>
      )}

      {data.attackBonusBreakdown.length > 0 && (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-xs cursor-default text-amber-400 border-amber-500/40">
              Attack +{data.attackBonusBreakdown.map((e) => e.value).join('+')}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {data.attackBonusBreakdown.map((e, i) => (
              <div key={i} className="text-xs">+{e.value} from {e.source}</div>
            ))}
          </TooltipContent>
        </Tooltip>
      )}

      {data.resistances.map((r) => (
        <Badge key={r} variant="secondary" className="text-xs capitalize">
          Resist: {r}
        </Badge>
      ))}

      {data.immunities.map((im) => (
        <Badge key={im} variant="secondary" className="text-xs capitalize">
          Immune: {im}
        </Badge>
      ))}

      {data.initiativeBonus !== 0 && (
        <Badge variant="outline" className="text-xs">Init +{data.initiativeBonus}</Badge>
      )}
    </div>
  );
}
```

**Step 2: Add to character sheet page**

In `src/app/(app)/characters/[characterId]/page.tsx`, import and add `<ResolvedStatsSummary characterId={characterId} baseAc={character.armorClass ?? 10} />` below the HeroStatBar.

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/components/character/ResolvedStatsSummary.tsx src/app/(app)/characters/[characterId]/page.tsx
git commit -m "feat(character): add ResolvedStatsSummary — live computed stats with tooltip breakdowns on character sheet"
```

---

## Phase 2: Session Event Pipeline

---

### Task 9: Add SessionMechanicalEvent and CharacterSessionState to Prisma schema

**Files:**
- Modify: `src/prisma/schema.prisma` — add two new models, add relations to Session and Character

**Step 1: Add models to schema.prisma**

Append to the end of `src/prisma/schema.prisma`:

```prisma
model SessionMechanicalEvent {
  id                  String    @id @default(cuid())
  session             GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sessionId           String
  character           Character? @relation(fields: [characterId], references: [id])
  characterId         String?
  characterName       String?
  transcriptSegmentId String?
  eventType           String
  eventData           Json      @default("{}")
  confidence          Float     @default(1.0)
  status              String    @default("pending")
  createdAt           DateTime  @default(now())
  appliedAt           DateTime?

  @@index([sessionId, status])
  @@index([characterId])
}

model CharacterSessionState {
  id               String    @id @default(cuid())
  session          GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sessionId        String
  character        Character @relation(fields: [characterId], references: [id])
  characterId      String
  currentHp        Int
  tempHp           Int       @default(0)
  spellSlotsUsed   Json      @default("{}")
  conditionsActive Json      @default("[]")
  activeSpells     Json      @default("[]")
  resourcesUsed    Json      @default("{}")
  updatedAt        DateTime  @updatedAt

  @@unique([sessionId, characterId])
}
```

Also add the reverse relations on `GameSession` and `Character` models:
- On `GameSession`: add `mechanicalEvents SessionMechanicalEvent[]` and `characterSessionStates CharacterSessionState[]`
- On `Character`: add `mechanicalEvents SessionMechanicalEvent[]` and `sessionStates CharacterSessionState[]`

**Step 2: Push schema**

```bash
npm run db:push
```
Expected: "All migrations applied successfully" or "Your database is now in sync with your Prisma schema."

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/prisma/schema.prisma
git commit -m "feat(schema): add SessionMechanicalEvent and CharacterSessionState models"
```

---

### Task 10: Session events queue

**Files:**
- Create: `src/lib/queue/session-events-queue.ts`

**Step 1: Create the queue file (follow combat-copilot-queue.ts pattern)**

```typescript
// src/lib/queue/session-events-queue.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Queue } from 'bullmq';

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

export interface SessionEventsJobData {
  sessionId: string;
  campaignId: string;
  fromSegmentId?: string; // process segments after this one
}

export interface SessionEventsJobResult {
  success: boolean;
  eventsExtracted: number;
  error?: string;
}

export const sessionEventsQueue = new Queue<SessionEventsJobData, SessionEventsJobResult>(
  'session-events',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 15000 },
      removeOnComplete: { age: 24 * 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addSessionEventsJob(data: SessionEventsJobData) {
  return sessionEventsQueue.add('extract-events', data, {
    jobId: `session-events-${data.sessionId}`, // deduplicate per session
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/queue/session-events-queue.ts
git commit -m "feat(queue): add session-events BullMQ queue"
```

---

### Task 11: AI session event extractor

**Files:**
- Create: `src/lib/ai/session-event-extractor.ts`
- Create: `src/tests/lib/session-event-extractor.test.ts`

**Step 1: Write failing test**

```typescript
// src/tests/lib/session-event-extractor.test.ts
import { describe, it, expect } from 'vitest';
import { parseEventExtractionResponse } from '@/lib/ai/session-event-extractor';

describe('parseEventExtractionResponse', () => {
  it('parses a damage event', () => {
    const raw = JSON.stringify([
      { eventType: 'damage', characterName: 'Aeryn', eventData: { amount: 14, damageType: 'slashing' }, confidence: 0.95 }
    ]);
    const events = parseEventExtractionResponse(raw);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('damage');
    expect(events[0].characterName).toBe('Aeryn');
    expect(events[0].confidence).toBe(0.95);
  });

  it('returns empty array on malformed JSON', () => {
    const events = parseEventExtractionResponse('not json');
    expect(events).toEqual([]);
  });

  it('filters out events with unknown eventType', () => {
    const raw = JSON.stringify([
      { eventType: 'made_up_type', characterName: 'Bram', eventData: {}, confidence: 0.9 }
    ]);
    const events = parseEventExtractionResponse(raw);
    expect(events).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/lib/session-event-extractor.test.ts
```
Expected: FAIL.

**Step 3: Implement**

```typescript
// src/lib/ai/session-event-extractor.ts

export const VALID_EVENT_TYPES = [
  'damage', 'healing', 'condition_applied', 'condition_removed',
  'spell_cast', 'spell_applied', 'spell_expired',
  'spell_slot_used', 'resource_used',
  'death_save_success', 'death_save_failed',
  'inspiration_gained', 'short_rest', 'long_rest',
] as const;

export type SessionEventType = (typeof VALID_EVENT_TYPES)[number];

export interface ExtractedSessionEvent {
  eventType: SessionEventType;
  characterName: string | null;
  eventData: Record<string, unknown>;
  confidence: number;
}

export const SESSION_EVENT_EXTRACTION_PROMPT = `You are a D&D 5e mechanical event extractor. Read the transcript excerpt and return ONLY a JSON array of mechanical events that occurred.

Each event must have this shape:
{
  "eventType": one of: damage | healing | condition_applied | condition_removed | spell_cast | spell_applied | spell_expired | spell_slot_used | resource_used | death_save_success | death_save_failed | inspiration_gained | short_rest | long_rest,
  "characterName": "name of the character this happened to, or null if it affects all",
  "eventData": {
    // For damage: { "amount": 14, "damageType": "slashing" }
    // For healing: { "amount": 8 }
    // For condition_applied/removed: { "condition": "Poisoned" }
    // For spell_applied: { "spellName": "Bless", "casterId": null, "casterName": "Bram", "concentration": true, "duration": "1 minute", "targets": ["Aeryn", "Kira"] }
    // For spell_slot_used: { "level": 2 }
    // For death_save_success/failed: {}
    // For short_rest/long_rest: {}
  },
  "confidence": 0.0-1.0 (how confident you are this event actually happened)
}

Rules:
- Only extract clear mechanical events. Skip roleplay/narrative with no game mechanics.
- If a character takes damage from an area spell affecting multiple people, create one event per character.
- "short rest" or "long rest" events should use characterName: null.
- confidence >= 0.9 means very clear ("Aeryn takes 14 slashing damage from the ogre's club")
- confidence 0.6-0.89 means probable but ambiguous ("she seems hurt")
- Do NOT include events with confidence < 0.6.
- Return [] if no mechanical events found.
- Return ONLY the JSON array, no explanation.

Transcript:
`;

export function parseEventExtractionResponse(raw: string): ExtractedSessionEvent[] {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((e): e is ExtractedSessionEvent => {
    return (
      typeof e === 'object' && e !== null &&
      VALID_EVENT_TYPES.includes((e as any).eventType) &&
      typeof (e as any).confidence === 'number'
    );
  });
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/lib/session-event-extractor.test.ts
```
Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add src/lib/ai/session-event-extractor.ts src/tests/lib/session-event-extractor.test.ts
git commit -m "feat(ai): add session event extractor — prompt + parser for mechanical events from transcript"
```

---

### Task 12: Session events worker

**Files:**
- Create: `src/lib/queue/session-events-worker.ts`
- Modify: `package.json` — add `worker:session-events` script

**Step 1: Create the worker**

```typescript
// src/lib/queue/session-events-worker.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { chatWithOllama } from '@/lib/ai/ollama';
import { sessionEventsQueue } from './session-events-queue';
import {
  SESSION_EVENT_EXTRACTION_PROMPT,
  parseEventExtractionResponse,
} from '@/lib/ai/session-event-extractor';
import type { SessionEventsJobData, SessionEventsJobResult } from './session-events-queue';

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

// Levenshtein distance for fuzzy character name matching
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatchCharacter(name: string | null, characters: { id: string; name: string }[]): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  let best: { id: string; dist: number } | null = null;
  for (const c of characters) {
    const dist = levenshtein(lower, c.name.toLowerCase());
    const threshold = Math.max(2, Math.floor(c.name.length * 0.3));
    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { id: c.id, dist };
    }
  }
  return best?.id ?? null;
}

async function applyEventToSessionState(
  sessionId: string,
  characterId: string,
  eventType: string,
  eventData: Record<string, unknown>
) {
  const state = await prisma.characterSessionState.findUnique({
    where: { sessionId_characterId: { sessionId, characterId } },
  });

  if (!state) return; // state must be initialised before we can apply

  const updates: Record<string, unknown> = {};

  if (eventType === 'damage' && typeof eventData.amount === 'number') {
    updates.currentHp = Math.max(0, state.currentHp - eventData.amount);
  } else if (eventType === 'healing' && typeof eventData.amount === 'number') {
    const character = await prisma.character.findUnique({ where: { id: characterId }, select: { hitPoints: true } });
    const maxHp = (character?.hitPoints as any)?.maximum ?? state.currentHp + eventData.amount;
    updates.currentHp = Math.min(maxHp, state.currentHp + eventData.amount);
  } else if (eventType === 'condition_applied' && typeof eventData.condition === 'string') {
    const conditions = state.conditionsActive as string[];
    if (!conditions.includes(eventData.condition as string)) {
      updates.conditionsActive = [...conditions, eventData.condition];
    }
  } else if (eventType === 'condition_removed' && typeof eventData.condition === 'string') {
    const conditions = state.conditionsActive as string[];
    updates.conditionsActive = conditions.filter((c) => c !== eventData.condition);
  } else if (eventType === 'spell_slot_used' && typeof eventData.level === 'number') {
    const slots = state.spellSlotsUsed as Record<string, number>;
    const level = String(eventData.level);
    updates.spellSlotsUsed = { ...slots, [level]: (slots[level] ?? 0) + 1 };
  } else if (eventType === 'spell_applied') {
    const spells = state.activeSpells as any[];
    updates.activeSpells = [...spells, { spellName: eventData.spellName, casterName: eventData.casterName, concentration: eventData.concentration, duration: eventData.duration }];
  }

  if (Object.keys(updates).length > 0) {
    await prisma.characterSessionState.update({
      where: { sessionId_characterId: { sessionId, characterId } },
      data: updates,
    });
  }
}

async function processSessionEventsJob(data: SessionEventsJobData): Promise<SessionEventsJobResult> {
  // Fetch new transcript segments since fromSegmentId
  const segments = await prisma.transcriptSegment.findMany({
    where: {
      sessionId: data.sessionId,
      ...(data.fromSegmentId ? { id: { gt: data.fromSegmentId } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 30,
  });

  if (segments.length === 0) return { success: true, eventsExtracted: 0 };

  // Fetch campaign characters for fuzzy matching
  const session = await prisma.gameSession.findUnique({
    where: { id: data.sessionId },
    select: { campaignId: true },
  });
  if (!session) return { success: false, eventsExtracted: 0, error: 'Session not found' };

  const campaignCharacters = await prisma.character.findMany({
    where: { campaignCharacters: { some: { campaignId: session.campaignId } } },
    select: { id: true, name: true },
  });

  const transcriptText = segments.map((s) => `${(s as any).speaker ?? ''}: ${(s as any).text ?? ''}`).join('\n');
  const content = await chatWithOllama(
    [{ role: 'user', content: SESSION_EVENT_EXTRACTION_PROMPT + transcriptText }],
    { temperature: 0.1 }
  );

  const extracted = parseEventExtractionResponse(content);
  if (extracted.length === 0) return { success: true, eventsExtracted: 0 };

  let eventsExtracted = 0;
  for (const event of extracted) {
    const characterId = fuzzyMatchCharacter(event.characterName, campaignCharacters);
    const status = event.confidence >= 0.90 ? 'auto_applied' : 'pending';

    await prisma.sessionMechanicalEvent.create({
      data: {
        sessionId: data.sessionId,
        characterId,
        characterName: event.characterName,
        transcriptSegmentId: segments[segments.length - 1]?.id,
        eventType: event.eventType,
        eventData: event.eventData as any,
        confidence: event.confidence,
        status,
        ...(status === 'auto_applied' ? { appliedAt: new Date() } : {}),
      },
    });

    if (status === 'auto_applied' && characterId) {
      await applyEventToSessionState(data.sessionId, characterId, event.eventType, event.eventData);
    }

    eventsExtracted++;
  }

  return { success: true, eventsExtracted };
}

const worker = new Worker<SessionEventsJobData, SessionEventsJobResult>(
  sessionEventsQueue.name,
  async (job) => {
    try {
      return await processSessionEventsJob(job.data);
    } catch (error) {
      console.error('[session-events] Job failed:', error);
      throw error;
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 2,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[session-events] Job ${job.id} completed — ${result.eventsExtracted} events extracted`);
});

worker.on('failed', (job, err) => {
  console.error(`[session-events] Job ${job?.id} failed:`, err.message);
});

console.log('[session-events] Worker started');
```

**Step 2: Add npm script to package.json**

Find the `"worker:combat-copilot"` line in package.json and add after it:
```json
"worker:session-events": "tsx src/lib/queue/session-events-worker.ts",
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/lib/queue/session-events-worker.ts package.json
git commit -m "feat(worker): add session-events worker — extracts mechanical events from transcript, applies to CharacterSessionState"
```

---

### Task 13: Session state service + tRPC endpoints

**Files:**
- Create: `src/server/services/session-state.service.ts`
- Modify: `src/server/routers/sessions.ts` — add `getCharacterSessionStates`, `initCharacterSessionStates`, `reviewEvent`, `commitSessionEvents`

**Step 1: Create session state service**

```typescript
// src/server/services/session-state.service.ts
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/server/errors';

export const sessionStateService = {
  async initForSession(sessionId: string) {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { campaignId: true },
    });
    if (!session) throw new NotFoundError('session', sessionId);

    const characters = await prisma.character.findMany({
      where: { campaignCharacters: { some: { campaignId: session.campaignId } } },
      select: { id: true, hitPoints: true },
    });

    for (const char of characters) {
      const maxHp = (char.hitPoints as any)?.maximum ?? 10;
      await prisma.characterSessionState.upsert({
        where: { sessionId_characterId: { sessionId, characterId: char.id } },
        create: { sessionId, characterId: char.id, currentHp: maxHp },
        update: {},
      });
    }
  },

  async getStates(sessionId: string) {
    return prisma.characterSessionState.findMany({
      where: { sessionId },
      include: { character: { select: { id: true, name: true, armorClass: true } } },
    });
  },

  async getPendingEvents(sessionId: string) {
    return prisma.sessionMechanicalEvent.findMany({
      where: { sessionId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getAllEvents(sessionId: string) {
    return prisma.sessionMechanicalEvent.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async reviewEvent(eventId: string, action: 'confirm' | 'reject') {
    if (action === 'reject') {
      return prisma.sessionMechanicalEvent.update({
        where: { id: eventId },
        data: { status: 'rejected' },
      });
    }
    return prisma.sessionMechanicalEvent.update({
      where: { id: eventId },
      data: { status: 'confirmed', appliedAt: new Date() },
    });
  },

  async commitSessionEvents(sessionId: string) {
    const events = await prisma.sessionMechanicalEvent.findMany({
      where: { sessionId, status: { in: ['confirmed', 'auto_applied'] } },
      include: { character: true },
    });

    for (const event of events) {
      if (!event.characterId || !event.character) continue;
      const data = event.eventData as Record<string, unknown>;

      if (event.eventType === 'damage' && typeof data.amount === 'number') {
        const char = await prisma.character.findUnique({ where: { id: event.characterId }, select: { hitPoints: true } });
        const hp = char?.hitPoints as any;
        if (hp) {
          await prisma.character.update({
            where: { id: event.characterId },
            data: { hitPoints: { ...hp, current: Math.max(0, (hp.current ?? hp.maximum) - data.amount) } },
          });
        }
      } else if (event.eventType === 'healing' && typeof data.amount === 'number') {
        const char = await prisma.character.findUnique({ where: { id: event.characterId }, select: { hitPoints: true } });
        const hp = char?.hitPoints as any;
        if (hp) {
          await prisma.character.update({
            where: { id: event.characterId },
            data: { hitPoints: { ...hp, current: Math.min(hp.maximum, (hp.current ?? hp.maximum) + data.amount) } },
          });
        }
      }
      // Additional event types (conditions, spell slots) can be handled here
    }
  },
};
```

**Step 2: Add tRPC endpoints to sessions router**

In `src/server/routers/sessions.ts`, add these procedures (using `campaignDMProcedure` — session management is DM-only):

```typescript
getCharacterSessionStates: campaignDMProcedure
  .input(z.object({ sessionId: z.string() }))
  .query(({ input }) => sessionStateService.getStates(input.sessionId)),

initCharacterSessionStates: campaignDMProcedure
  .input(z.object({ sessionId: z.string() }))
  .mutation(({ input }) => sessionStateService.initForSession(input.sessionId)),

getSessionEvents: campaignDMProcedure
  .input(z.object({ sessionId: z.string() }))
  .query(({ input }) => sessionStateService.getAllEvents(input.sessionId)),

reviewEvent: campaignDMProcedure
  .input(z.object({ eventId: z.string(), action: z.enum(['confirm', 'reject']) }))
  .mutation(({ input }) => sessionStateService.reviewEvent(input.eventId, input.action)),

commitSessionEvents: campaignDMProcedure
  .input(z.object({ sessionId: z.string() }))
  .mutation(({ input }) => sessionStateService.commitSessionEvents(input.sessionId)),
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/server/services/session-state.service.ts src/server/routers/sessions.ts
git commit -m "feat(sessions): add session state service + tRPC endpoints for live state, event review, and commit"
```

---

### Task 14: Trigger session events jobs from transcription pipeline

**Files:**
- Modify: `src/lib/queue/transcription-worker.ts` — enqueue session-events job after transcript segments are saved

**Step 1: Read the transcription worker**

Use Read tool on `src/lib/queue/transcription-worker.ts` to find where segments are saved to the database.

**Step 2: Add job enqueue after segment save**

After the point where transcript segments are saved (look for `prisma.transcriptSegment.createMany` or similar), add:

```typescript
import { addSessionEventsJob } from './session-events-queue';

// After segments are saved:
await addSessionEventsJob({
  sessionId: job.data.sessionId,
  campaignId: job.data.campaignId,
  fromSegmentId: lastSavedSegmentId, // the ID of the last segment before this batch
}).catch(() => undefined); // fire-and-forget
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/lib/queue/transcription-worker.ts
git commit -m "feat(transcription): trigger session-events extraction after each transcript batch"
```

---

### Task 15: Update PartyOverviewPanel to use CharacterSessionState

**Files:**
- Modify: `src/components/cockpit/PartyOverviewPanel.tsx`

**Step 1: Read the file**

Use Read tool on `src/components/cockpit/PartyOverviewPanel.tsx`.

**Step 2: Add session state query**

Add a query for `trpc.sessions.getCharacterSessionStates.useQuery({ sessionId })` alongside the existing party data query.

Merge session state into each character card — if a `CharacterSessionState` exists for a character, use its `currentHp`, `conditionsActive`, and `activeSpells` instead of base character values.

**Step 3: Add a pending events badge**

Add `trpc.sessions.getSessionEvents.useQuery` filtered to `status === 'pending'` and show a count badge in the panel header.

**Step 4: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 5: Commit**

```bash
git add src/components/cockpit/PartyOverviewPanel.tsx
git commit -m "feat(cockpit): PartyOverviewPanel uses live CharacterSessionState for HP/conditions/active spells"
```

---

### Task 16: PendingEventsQueue cockpit component

**Files:**
- Create: `src/components/cockpit/PendingEventsQueue.tsx`
- Modify: `src/components/cockpit/CockpitHeader.tsx` — add events badge that opens the queue

**Step 1: Create PendingEventsQueue component**

```typescript
// src/components/cockpit/PendingEventsQueue.tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Zap } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface PendingEventsQueueProps {
  sessionId: string;
  campaignSlug: string;
}

export function PendingEventsQueue({ sessionId, campaignSlug }: PendingEventsQueueProps) {
  const utils = trpc.useUtils();
  const { data: events = [] } = trpc.sessions.getSessionEvents.useQuery(
    { sessionId },
    { refetchInterval: 10_000 }
  );
  const reviewEvent = trpc.sessions.reviewEvent.useMutation({
    onSuccess: () => utils.sessions.getSessionEvents.invalidate({ sessionId }),
  });

  const pending = events.filter((e) => e.status === 'pending');
  const autoApplied = events.filter((e) => e.status === 'auto_applied').length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Zap className="h-4 w-4" />
          {pending.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center bg-amber-500">
              {pending.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            Session Events
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {autoApplied > 0 && (
            <p className="text-xs text-muted-foreground">{autoApplied} events auto-applied</p>
          )}
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending events</p>
          )}
          {pending.map((event) => (
            <div key={event.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs capitalize">
                  {event.eventType.replace(/_/g, ' ')}
                </Badge>
                {event.characterName && (
                  <span className="text-sm font-medium">{event.characterName}</span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {Math.round(event.confidence * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {JSON.stringify(event.eventData)}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline" className="h-7 text-xs flex-1"
                  onClick={() => reviewEvent.mutate({ eventId: event.id, action: 'confirm' })}
                >
                  <Check className="h-3 w-3 mr-1" /> Apply
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                  onClick={() => reviewEvent.mutate({ eventId: event.id, action: 'reject' })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Add PendingEventsQueue to CockpitHeader**

Read `src/components/cockpit/CockpitHeader.tsx`, then add `<PendingEventsQueue sessionId={sessionId} campaignSlug={campaignSlug} />` to the header action area.

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/components/cockpit/PendingEventsQueue.tsx src/components/cockpit/CockpitHeader.tsx
git commit -m "feat(cockpit): add PendingEventsQueue — inline event review in cockpit header"
```

---

### Task 17: Post-session events review tab

**Files:**
- Create: `src/components/session/SessionEventsReview.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` — add "Events" tab

**Step 1: Create SessionEventsReview component**

```typescript
// src/components/session/SessionEventsReview.tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, GitCommit } from 'lucide-react';

interface SessionEventsReviewProps {
  sessionId: string;
  campaignSlug: string;
}

export function SessionEventsReview({ sessionId, campaignSlug }: SessionEventsReviewProps) {
  const utils = trpc.useUtils();
  const { data: events = [], isLoading } = trpc.sessions.getSessionEvents.useQuery({ sessionId });
  const reviewEvent = trpc.sessions.reviewEvent.useMutation({
    onSuccess: () => utils.sessions.getSessionEvents.invalidate({ sessionId }),
  });
  const commitEvents = trpc.sessions.commitSessionEvents.useMutation({
    onSuccess: () => utils.sessions.getSessionEvents.invalidate({ sessionId }),
  });

  const pending = events.filter((e) => e.status === 'pending');
  const autoApplied = events.filter((e) => e.status === 'auto_applied');
  const committed = events.filter((e) => e.status === 'confirmed');

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading events...</p>;
  if (events.length === 0) return <p className="text-sm text-muted-foreground p-4">No mechanical events recorded for this session.</p>;

  return (
    <div className="space-y-6 p-4">
      {autoApplied.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground label-overline">
            Auto-Applied ({autoApplied.length})
          </h3>
          <div className="space-y-1.5">
            {autoApplied.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm opacity-60">
                <Badge variant="secondary" className="text-xs capitalize shrink-0">
                  {e.eventType.replace(/_/g, ' ')}
                </Badge>
                <span className="text-muted-foreground">{e.characterName ?? 'all'}</span>
                <span className="text-xs">{JSON.stringify(e.eventData)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium label-overline">
            Needs Review ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((e) => (
              <div key={e.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs capitalize">
                    {e.eventType.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-sm font-medium">{e.characterName ?? 'all'}</span>
                  <span className="text-xs text-muted-foreground">{JSON.stringify(e.eventData)}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{Math.round(e.confidence * 100)}% confidence</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => reviewEvent.mutate({ eventId: e.id, action: 'confirm' })}
                  >
                    <Check className="h-3 w-3 mr-1" /> Apply
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                    onClick={() => reviewEvent.mutate({ eventId: e.id, action: 'reject' })}
                  >
                    <X className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t">
        <Button
          onClick={() => commitEvents.mutate({ sessionId })}
          disabled={commitEvents.isPending || (pending.length === 0 && committed.length === 0)}
          className="w-full sm:w-auto"
        >
          <GitCommit className="h-4 w-4 mr-2" />
          Commit to Character Sheets
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Permanently applies confirmed events to character records.
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Add Events tab to session detail page**

Read `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`, then add a new "Events" tab to the existing Tabs component:

```tsx
<TabsTrigger value="events">Events</TabsTrigger>
// ...
<TabsContent value="events">
  <SessionEventsReview sessionId={sessionId} campaignSlug={slug} />
</TabsContent>
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/components/session/SessionEventsReview.tsx src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx
git commit -m "feat(session): add SessionEventsReview tab — post-session event review and commit to character sheets"
```

---

### Task 18: Initialize character session state when session starts

**Files:**
- Modify: `src/components/cockpit/CockpitHeader.tsx` or the cockpit page — call `initCharacterSessionStates` on mount

**Step 1: Call initCharacterSessionStates on cockpit mount**

In the cockpit page (`src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx` or equivalent), add a `useEffect` or `useMutation` on mount that calls `trpc.sessions.initCharacterSessionStates.useMutation()` once when the cockpit loads, to create `CharacterSessionState` rows for all campaign characters if they don't exist yet.

```typescript
const initStates = trpc.sessions.initCharacterSessionStates.useMutation();
useEffect(() => {
  initStates.mutate({ sessionId });
}, [sessionId]);
```

**Step 2: Run type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Final build check**

```bash
npm run build
```
Expected: build succeeds.

**Step 4: Commit**

```bash
git add src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx
git commit -m "feat(cockpit): initialize CharacterSessionState for all characters on session start"
```

---

## Done

Phase 1 shipped: homebrew items, spells, and feats carry structured executable mechanics. AI extracts them on save. Character sheet shows computed effective stats with breakdowns.

Phase 2 shipped: session transcript drives real-time character state. Cockpit shows live HP/conditions/active spells. DM reviews pending events inline. Post-session commit writes everything permanently to character sheets.
