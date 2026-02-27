# Homebrew Uniform Formatting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix raw HTML rendering in homebrew detail views and add AI-detected custom sections displayed uniformly after standard sections.

**Architecture:** Apply `htmlToText` from `src/lib/html-utils.ts` to all four detail renderers. Add a shared `CustomSections` component that renders `data.customSections[]` below fixed sections. Create `detectCustomSections()` AI function (Ollama primary, fire-and-forget) and wire it into PDF extraction and DnD Beyond import services.

**Tech Stack:** React (client components), `src/lib/html-utils.ts` (existing), Ollama via existing AI provider pattern in `src/lib/ai/`, Prisma for post-import data update.

---

## Task 1: Fix HTML rendering in ItemDetail and SpellDetail

**Files:**
- Modify: `src/components/homebrew/details/ItemDetail.tsx:52-61`
- Modify: `src/components/homebrew/details/SpellDetail.tsx:57-77`

Both files render `data.description` and `data.text` as raw strings. DnD Beyond descriptions are HTML — tags render as visible text.

**Step 1: Add htmlToText import to ItemDetail**

In `ItemDetail.tsx`, add after existing imports:
```tsx
import { htmlToText } from '@/lib/html-utils';
```

**Step 2: Apply htmlToText to ItemDetail description**

Change line 58:
```tsx
// Before:
<p className="text-sm whitespace-pre-wrap">{data.description || data.text}</p>

// After:
<p className="text-sm whitespace-pre-wrap">{htmlToText(data.description || data.text || '')}</p>
```

**Step 3: Add htmlToText import to SpellDetail**

In `SpellDetail.tsx`, add after existing imports:
```tsx
import { htmlToText } from '@/lib/html-utils';
```

**Step 4: Apply htmlToText to SpellDetail description and higher_levels**

Change lines 63 and 74:
```tsx
// Description (line 63):
<p className="text-sm whitespace-pre-wrap">{htmlToText(data.description || data.text || '')}</p>

// At Higher Levels (line 74):
<p className="text-sm whitespace-pre-wrap">{htmlToText(data.higher_levels || '')}</p>
```

**Step 5: Verify in browser**

Navigate to `http://localhost:3847/homebrew/cmlv33wx100bb3xay4559i1nx` — description should now show formatted plain text, no `<p>` or `<a>` tags visible.

**Step 6: Commit**
```bash
git add src/components/homebrew/details/ItemDetail.tsx src/components/homebrew/details/SpellDetail.tsx
git commit -m "fix: apply htmlToText to item and spell homebrew description rendering"
```

---

## Task 2: Fix HTML rendering in CreatureDetail and GenericDetail

**Files:**
- Modify: `src/components/homebrew/details/CreatureDetail.tsx:89,102`
- Modify: `src/components/homebrew/details/GenericDetail.tsx:29`

**Step 1: Add htmlToText import to CreatureDetail**
```tsx
import { htmlToText } from '@/lib/html-utils';
```

**Step 2: Apply to CreatureDetail action descriptions and main description**

Line 89 (action descriptions):
```tsx
// Before:
<p className="text-sm text-muted-foreground whitespace-pre-wrap">{action.description || action.desc}</p>

// After:
<p className="text-sm text-muted-foreground whitespace-pre-wrap">{htmlToText(action.description || action.desc || '')}</p>
```

Line 102 (main description):
```tsx
<p className="text-sm whitespace-pre-wrap">{htmlToText(data.description || data.text || '')}</p>
```

**Step 3: Add htmlToText import to GenericDetail**
```tsx
import { htmlToText } from '@/lib/html-utils';
```

**Step 4: Apply to GenericDetail description (line 29)**
```tsx
<p className="text-sm whitespace-pre-wrap">{htmlToText(data.description || data.text || '')}</p>
```

**Step 5: Commit**
```bash
git add src/components/homebrew/details/CreatureDetail.tsx src/components/homebrew/details/GenericDetail.tsx
git commit -m "fix: apply htmlToText to creature and generic homebrew description rendering"
```

---

## Task 3: Create CustomSections component

**Files:**
- Create: `src/components/homebrew/details/CustomSections.tsx`

This component reads `data.customSections` and renders each entry as a card below the fixed sections. Renders nothing if the array is absent or empty.

**Step 1: Create the file**

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomSection {
  label: string;
  content: string;
}

interface CustomSectionsProps {
  data: Record<string, unknown>;
}

export function CustomSections({ data }: CustomSectionsProps) {
  const sections = data.customSections as CustomSection[] | undefined;
  if (!sections?.length) return null;

  return (
    <>
      {sections.map((section, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{section.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{section.content}</p>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
```

**Step 2: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 3: Commit**
```bash
git add src/components/homebrew/details/CustomSections.tsx
git commit -m "feat: add CustomSections component for AI-detected homebrew sections"
```

---

## Task 4: Wire CustomSections into all four detail renderers

**Files:**
- Modify: `src/components/homebrew/details/ItemDetail.tsx`
- Modify: `src/components/homebrew/details/SpellDetail.tsx`
- Modify: `src/components/homebrew/details/CreatureDetail.tsx`
- Modify: `src/components/homebrew/details/GenericDetail.tsx`

**Step 1: Add import to all four files**

Add to each file's imports:
```tsx
import { CustomSections } from './CustomSections';
```

**Step 2: Add `<CustomSections data={data} />` as last element in each renderer**

Each renderer returns a `<div className="space-y-4">`. Add as final child before the closing `</div>`:

```tsx
// ItemDetail.tsx — add after the description Card:
      <CustomSections data={data} />
    </div>
  );
}

// SpellDetail.tsx — add after the higher_levels Card:
      <CustomSections data={data} />
    </div>
  );
}

// CreatureDetail.tsx — add after the description Card:
      <CustomSections data={data} />
    </div>
  );
}

// GenericDetail.tsx — add after the Properties Card:
      <CustomSections data={data} />
    </div>
  );
}
```

**Step 3: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 4: Commit**
```bash
git add src/components/homebrew/details/ItemDetail.tsx src/components/homebrew/details/SpellDetail.tsx src/components/homebrew/details/CreatureDetail.tsx src/components/homebrew/details/GenericDetail.tsx
git commit -m "feat: wire CustomSections into all homebrew detail renderers"
```

---

## Task 5: Create detectCustomSections AI function

**Files:**
- Create: `src/lib/ai/detect-custom-sections.ts`

This function takes a homebrew type and data object, strips known standard fields, asks Ollama to identify named sections from whatever remains, and returns `{ label, content }[]`. Never throws — returns `[]` on any error.

**Step 1: Create the file**

```ts
/**
 * AI-powered custom section detection for homebrew content.
 * Identifies DM-specific named sections (e.g. Curse, History, Adventure Hooks)
 * that don't belong to the standard schema for a given homebrew type.
 *
 * Fire-and-forget safe: never throws, returns [] on any error.
 */

export interface CustomSection {
  label: string;
  content: string;
}

// Fields considered "standard" per type — AI skips these
const STANDARD_FIELDS: Record<string, Set<string>> = {
  item: new Set([
    'description', 'text', 'type', 'item_type', 'rarity',
    'requires_attunement', 'attunement', 'weight', 'value', 'cost',
    'damage', 'damage_type', 'properties', 'imagePromptHint', 'customSections',
  ]),
  spell: new Set([
    'description', 'text', 'level', 'spell_level', 'school',
    'casting_time', 'castingTime', 'range', 'components', 'duration',
    'concentration', 'ritual', 'higher_levels', 'classes',
    'imagePromptHint', 'customSections',
  ]),
  creature: new Set([
    'description', 'text', 'challenge_rating', 'cr', 'creature_type', 'type',
    'size', 'alignment', 'armor_class', 'ac', 'hit_points', 'hp', 'speed',
    'ability_scores', 'abilityScores', 'actions', 'legendary_actions',
    'reactions', 'special_abilities', 'traits', 'senses', 'languages', 'skills',
    'imagePromptHint', 'customSections',
  ]),
};

const ALWAYS_SKIP = new Set([
  'id', 'userId', 'createdAt', 'updatedAt', 'searchText',
  'images', 'tags', 'imagePromptHint', 'customSections',
]);

function getNonStandardFields(
  type: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const standardForType = STANDARD_FIELDS[type] ?? new Set<string>();
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (ALWAYS_SKIP.has(key)) continue;
    if (standardForType.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    result[key] = value;
  }

  return result;
}

function buildPrompt(type: string, nonStandardFields: Record<string, unknown>): string {
  return `You are analyzing D&D homebrew content of type "${type}".

The following fields were found that are NOT part of the standard ${type} schema:
${JSON.stringify(nonStandardFields, null, 2)}

Identify named sections a DM might have added (e.g. "Curse", "History", "DM Notes", "Adventure Hooks", "Loot Table", "Variant Rules").
For each section, produce a human-readable label and the content as a clean plain text string.

Return ONLY a JSON array, no explanation, no code fences:
[
  { "label": "Curse", "content": "The wearer cannot remove the mask..." },
  { "label": "History", "content": "Forged in the Abyss by..." }
]

If no named sections can be identified, return an empty array: []`;
}

function parseResponse(text: string): CustomSection[] {
  let cleaned = text.trim();

  // Strip code fences
  const fenceMatch = cleaned.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: any) => typeof s?.label === 'string' && typeof s?.content === 'string'
    );
  } catch {
    return [];
  }
}

export async function detectCustomSections(
  type: string,
  data: Record<string, unknown>
): Promise<CustomSection[]> {
  try {
    const nonStandardFields = getNonStandardFields(type, data);
    if (Object.keys(nonStandardFields).length === 0) return [];

    const prompt = buildPrompt(type, nonStandardFields);

    // Use Ollama — same base URL pattern as existing AI code
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL ?? 'llama3.2';

    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) return [];

    const result = await response.json();
    return parseResponse(result.response ?? '');
  } catch {
    // Fire-and-forget safe: always return [] on any error
    return [];
  }
}
```

**Step 2: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 3: Commit**
```bash
git add src/lib/ai/detect-custom-sections.ts
git commit -m "feat: add detectCustomSections AI function for homebrew"
```

---

## Task 6: Wire detectCustomSections into the PDF extraction service

**Files:**
- Modify: `src/server/services/homebrew-extraction.service.ts:84-109`

After `createManyExtractedContent` saves items, fire-and-forget `detectCustomSections` for each item and update its `data` field if sections are found.

**Step 1: Add imports at top of file**

```ts
import { detectCustomSections } from '@/lib/ai/detect-custom-sections';
import { prisma } from '@/lib/prisma';
```

Note: check that `prisma` is exported from `@/lib/prisma` — if the project uses a different path, find it with `grep -r "export.*prisma" src/lib/`.

**Step 2: Locate the save call (around line 89)**

The existing code:
```ts
const savedItems = await homebrewExtractionRepository.createManyExtractedContent(
  result.items.map((item) => ({
    userId,
    type: item.type,
    name: (item.data as any).name || 'Unnamed',
    data: item.data,
  }))
);
```

**Step 3: Add fire-and-forget detection after the save**

After the `const savedItems = await ...` block and before `return {`, add:

```ts
// Fire-and-forget: detect custom sections for each saved item
Promise.all(
  savedItems.map(async (saved, i) => {
    const itemData = result.items[i]?.data as Record<string, unknown> | undefined;
    if (!itemData) return;
    const customSections = await detectCustomSections(saved.type, itemData);
    if (customSections.length === 0) return;
    await prisma.homebrewContent.update({
      where: { id: saved.id },
      data: { data: { ...itemData, customSections } },
    });
  })
).catch(() => {}); // Never block the response
```

**Step 4: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 5: Commit**
```bash
git add src/server/services/homebrew-extraction.service.ts
git commit -m "feat: detect and store custom sections after PDF homebrew extraction"
```

---

## Task 7: Wire detectCustomSections into the DnD Beyond import service

**Files:**
- Modify: `src/server/services/homebrew-dndbeyond.service.ts:85-115`

After `createFromImport` saves the item, fire-and-forget detect and update.

**Step 1: Add imports at top of file**

```ts
import { detectCustomSections } from '@/lib/ai/detect-custom-sections';
import { prisma } from '@/lib/prisma';
```

**Step 2: Locate the save call (around line 87)**

The existing code:
```ts
const content = await homebrewDndbeyondRepository.createFromImport({
  userId,
  type: input.contentType,
  name: transformedData.name,
  data: transformedData.data,
  ...
});
```

**Step 3: Add fire-and-forget detection after the save, before the `if (input.addToCampaignId)` block**

```ts
// Fire-and-forget: detect custom sections from non-standard DDB fields
const ddbData = transformedData.data as Record<string, unknown>;
detectCustomSections(input.contentType, ddbData).then(async (customSections) => {
  if (customSections.length === 0) return;
  await prisma.homebrewContent.update({
    where: { id: content.id },
    data: { data: { ...ddbData, customSections } },
  });
}).catch(() => {});
```

**Step 4: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 5: Commit**
```bash
git add src/server/services/homebrew-dndbeyond.service.ts
git commit -m "feat: detect and store custom sections after DnD Beyond homebrew import"
```

---

## Task 8: Final verification

**Step 1: Check no remaining raw-HTML rendering in homebrew details**

Visit an item with a DnD Beyond description in the browser. Confirm no `<p>`, `<a>`, `&nbsp;` visible in the description card.

**Step 2: TypeScript clean build**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 3: ESLint**
```bash
npm run lint 2>&1 | tail -10
```
Expected: no errors in modified files.

**Step 4: Commit if any lint fixes needed, otherwise done**
