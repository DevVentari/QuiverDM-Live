# Enhanced Campaign Creation — Design Spec

**Date:** 2026-03-17
**Status:** Approved

## Overview

Enrich the campaign creation page (`/campaigns/new`) with sections that give DM Brain a strong starting entity graph and WorldState from day one. Covers player roster setup, world context seeding, migration support (paste history + upload docs), and tone/theme tagging.

## Goals

- DM can walk away from creation with brain entities, factions, a threat, a hook, and player records already populated
- Migrations from Notion/Obsidian/World Anvil/other platforms get their history ingested immediately
- Players are named at creation; D&D Beyond linking happens later via member profile
- All new sections are optional — existing one-field creation still works

## Page Sections (in order)

### 1. Banner + Identity (existing)
No changes. Name, description, banner image upload.

### 2. Tone & Themes (new)
Multi-select chip grid. Stored in `campaign.settings.themes` (JSON array of strings).

Chips: Horror, Political Intrigue, Dungeon Crawl, Maritime, Exploration, Mystery, War, Cosmic

### 3. Players (new)
Dynamic list of rows. Each row: **Player name** (text) + **Character name** (text). "+Add player" button adds a row. Each row has a remove button. No D&D Beyond field here — that's linked later.

On submit: creates `Player` records (name + characterName, campaignId) in the same transaction as campaign creation.

Starts with one empty row pre-populated.

### 4. World Setup (new)
Four optional fields that seed DM Brain entities on creation:

| Field | Input | Brain output |
|-------|-------|--------------|
| Starting location | Text input | LOCATION entity |
| Main antagonist name | Text input | THREAT entity |
| Antagonist motivation | Text input (one line) | THREAT entity description |
| Opening hook | Text input (one sentence) | First open hook in WorldState |

**Key Factions** — up to 3 rows: faction name + stance selector (Ally / Neutral / Hostile). Each seeds a FACTION entity with an initial relationship to the party.

### 5. Story So Far (new)
Textarea. Label: "Migrating from another platform? Paste your campaign history here."

On submit: queued as a brain ingestion job with `source: 'campaign_creation'`. The ingestion pipeline extracts entities, relationships, and hooks from the free text using the existing `processBrainIngestionJob` worker.

### 6. Import Documents (new)
Drag-drop zone accepting PDF, `.md`, `.txt`. Max 10 files, 50MB each.

Label: "Drop session notes, module PDFs, or world documents."

On submit: each file is uploaded to R2 and a `HomebrewPDF` record is created (or equivalent) and queued to the existing PDF processing pipeline, tagged to the new campaign.

### 7. Advanced Settings (existing)
Moved to bottom. No changes to content (game system, player count, starting level, schedule, house rules, Obsidian import link).

## Data Flow on Submit

```
handleSubmit()
  ├── campaigns.create mutation → Campaign + Player records (transaction)
  ├── Upload each doc file → R2 → HomebrewPDF queue (per file)
  └── If (antagonist OR factions OR location OR hook OR storyText):
        brain.seedFromCreation mutation →
          WorldState: hooks += [openingHook]
          WorldEntities: LOCATION, THREAT, FACTION records
          If storyText: queue brain ingestion job
```

## API Changes

### `campaigns.create` input schema additions
```ts
players?: Array<{ name: string; characterName: string }>
themes?: string[]
worldSetup?: {
  startingLocation?: string
  antagonistName?: string
  antagonistMotivation?: string
  openingHook?: string
  factions?: Array<{ name: string; stance: 'ally' | 'neutral' | 'hostile' }>
}
storyText?: string  // "story so far" — triggers brain ingestion job
```

### New tRPC procedure: `brain.seedFromCreation`
`campaignOwnerProcedure` — accepts worldSetup + storyText, creates entities + WorldState + queues ingestion if storyText present.

## Brain Ingestion for Story So Far

Reuses `processBrainIngestionJob` with:
```ts
{
  campaignId,
  sessionId: null,  // No session — campaign creation context
  summary: storyText,
  highlights: [],
  source: 'campaign_creation'
}
```

Requires small extension to allow `sessionId: null` in the worker (currently assumes a session).

## UI Patterns

- All new sections follow existing glass-panel + label-overline + section-rule pattern
- Tone chips use toggle button style (amber outline when selected)
- Player rows use a compact 2-col grid with a trash icon remove button
- Faction rows same pattern with a stance Select
- Import zone matches the banner upload drag-drop style
- World Setup fields grouped in a stone-card with overline "World Setup"
- Story So Far is a standalone textarea section

## What Is Not In Scope

- Published module selector (pre-seeded NPC/faction library) — future phase
- D&D Beyond character import at creation — players link their own characters later
- Invite sending at creation — use existing members/invites flow post-creation

## Testing

- `campaign-create.spec.ts` workflow spec: extend with players section, world setup fields, doc upload
- `veteran-dm.persona.spec.ts`: add checkpoint verifying brain entities exist after creation with world setup data
- Unit test: `brain.seedFromCreation` creates correct entity types for each worldSetup field
