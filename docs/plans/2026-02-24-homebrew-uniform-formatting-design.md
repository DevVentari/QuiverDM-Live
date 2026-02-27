# Homebrew Uniform Formatting — Design

**Date:** 2026-02-24
**Status:** Approved

## Problem

Homebrew content arrives from three sources (DnD Beyond, PDF extraction, manual creation) and currently renders inconsistently:
- DnD Beyond descriptions contain raw HTML that renders as visible tags
- No uniform section layout across types
- DM-added custom fields (curse details, lore, adventure hooks, etc.) have no display path

## Approach: Option A — Fixed sections + AI-detected `customSections`

Display layer only. Data storage shape is extended (one new field), but existing content is unaffected.

---

## Architecture

### 1. Rendering Fix

Apply `htmlToText` (from `src/lib/html-utils.ts`) to description fields in all four detail renderers:
- `ItemDetail.tsx`
- `SpellDetail.tsx`
- `CreatureDetail.tsx`
- `GenericDetail.tsx`

### 2. Fixed Section Layout (per type)

Each renderer keeps its standard fields, now with consistent section card styling:

| Type | Fixed sections |
|---|---|
| item | Properties card (rarity, type, attunement, weight, cost, damage, properties) → Description card |
| spell | Spell Stats card (level, school, casting time, range, components, duration, concentration, ritual) → Description card → At Higher Levels card |
| creature | Stats card (CR, type, size, alignment, AC, HP, speed) → Ability Scores card → Actions card → Description card |
| others | Description card (GenericDetail) |

### 3. Custom Sections Component

**New file:** `src/components/homebrew/details/CustomSections.tsx`

- Props: `data: Record<string, unknown>`
- Reads `data.customSections as { label: string; content: string }[]`
- Renders each entry as a card with heading + `whitespace-pre-wrap` body
- Renders nothing if array is absent or empty (fully non-breaking)
- Imported and rendered as last element in all four detail renderers

### 4. AI Detection Function

**New file:** `src/lib/ai/detect-custom-sections.ts`

```ts
detectCustomSections(type: string, data: Record<string, unknown>): Promise<{ label: string; content: string }[]>
```

- Uses existing multi-provider AI setup (Ollama default → Gemini → OpenAI)
- Receives: homebrew type + the full data object
- Strips known standard fields for that type before sending to AI
- AI identifies named sections from remaining content (e.g. "Curse", "History", "DM Notes")
- Returns `[]` on any error — never throws

**Standard fields skipped per type:**

| Type | Skipped fields |
|---|---|
| item | description, text, type, item_type, rarity, requires_attunement, attunement, weight, value, cost, damage, damage_type, properties |
| spell | description, text, level, school, casting_time, castingTime, range, components, duration, concentration, ritual, higher_levels, classes |
| creature | description, text, challenge_rating, cr, creature_type, type, size, alignment, armor_class, armor_type, hit_points, hit_dice, speed, ability_scores, actions, legendary_actions, reactions, special_abilities |
| others | description, text |

### 5. Ingest Integration

`detectCustomSections` is called **fire-and-forget** (non-blocking) at import time:

- **PDF extraction** — `src/server/services/homebrew-extraction.service.ts`: after AI extraction, before DB write
- **DnD Beyond import** — `src/server/services/homebrew-dndbeyond.service.ts`: after mapping, before DB write
- **Manual creation** — skipped (user controls their own text)

If AI is unavailable or returns an error, `customSections` is simply not set. Display degrades gracefully to standard sections only.

---

## Data Shape

```json
{
  "description": "...",
  "rarity": "Artifact",
  "customSections": [
    { "label": "Curse", "content": "The wearer cannot remove the mask willingly..." },
    { "label": "Legend", "content": "Forged in the Abyss by Xyra'kath..." }
  ]
}
```

---

## Non-Goals

- No data migration for existing content
- No display-time AI calls
- No changes to data storage schema (Prisma model unchanged)
- Manual creation flow unchanged

---

## Files Changed

| Action | File |
|---|---|
| modify | `src/components/homebrew/details/ItemDetail.tsx` |
| modify | `src/components/homebrew/details/SpellDetail.tsx` |
| modify | `src/components/homebrew/details/CreatureDetail.tsx` |
| modify | `src/components/homebrew/details/GenericDetail.tsx` |
| create | `src/components/homebrew/details/CustomSections.tsx` |
| create | `src/lib/ai/detect-custom-sections.ts` |
| modify | `src/server/services/homebrew-extraction.service.ts` |
| modify | `src/server/services/homebrew-dndbeyond.service.ts` |
