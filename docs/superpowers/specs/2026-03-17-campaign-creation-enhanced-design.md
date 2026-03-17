# Enhanced Campaign Creation — Design Spec

**Date:** 2026-03-17
**Status:** Draft

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
Multi-select chip grid. Stored as a top-level `themes` field on the campaign settings object. The `CreateCampaignSchema` `settings` Zod object must be extended with `themes: z.array(z.string()).optional()`.

Chips: Horror, Political Intrigue, Dungeon Crawl, Maritime, Exploration, Mystery, War, Cosmic

### 3. Players (new)
Dynamic list of rows. Each row: **Player name** (text, max 100 chars) + **Character name** (text, max 100 chars). "+Add player" button adds a row. Each row has a remove button. No D&D Beyond field here — that's linked later.

On submit: rows where both `name` and `characterName` are blank or whitespace-only are silently skipped (filtered client-side before sending, and validated server-side with a Zod `.refine` that rejects empty strings on both fields simultaneously). Only rows passing validation are persisted as `Player` records (name + characterName, campaignId) in the same transaction as campaign creation.

Starts with one empty row pre-populated.

### 4. World Setup (new)
Four optional fields that seed DM Brain entities on creation. All text fields have a 200-character max.

| Field | Input | Brain output |
|-------|-------|--------------|
| Starting location | Text input (max 200 chars) | LOCATION entity |
| Main antagonist name | Text input (max 200 chars) | THREAT entity |
| Antagonist motivation | Text input, one line (max 200 chars) | THREAT entity description |
| Opening hook | Text input, one sentence (max 200 chars) | First open hook in WorldState |

**Key Factions** — up to 3 rows: faction name (max 100 chars) + stance selector (Ally / Neutral / Hostile). Each seeds a FACTION entity. The stance is stored in the `WorldEntity.properties` JSON field as `{ "stance": "ally" | "neutral" | "hostile" }`.

### 5. Story So Far (new)
Textarea. Label: "Migrating from another platform? Paste your campaign history here." Max 20,000 characters.

On submit: queued as a brain ingestion job with `source: 'campaign_creation'`. The ingestion pipeline extracts entities, relationships, and hooks from the free text using the existing `processBrainIngestionJob` worker. Requires extension to the brain ingestion interface to support `sessionId: null` — see Brain Ingestion section.

### 6. Import Documents (new)
Drag-drop zone accepting **PDF only** (not `.md`/`.txt`). Max 10 files, 50MB each.

Label: "Drop session notes, module PDFs, or world documents."

These are world-building documents processed through the homebrew PDF pipeline. Upload flow per file:
1. Call `homebrewPdf.getUploadUrl` mutation → receive `{ presignedUrl, r2Key, r2Url }`
2. If `presignedUrl` is null (local dev / non-R2 mode), skip the upload silently and skip step 3 for that file — show a dev-mode warning toast
3. `PUT` file bytes directly to `presignedUrl` (R2)
4. Call `homebrewPdf.createPDF` mutation with `{ r2Key, r2Url, filename, fileSize, mimeType: 'application/pdf', campaignId }` → enqueues PDF worker

Brain entities are extracted by the PDF pipeline's existing AI extraction step — no separate brain ingestion job needed for these files.

### 7. Advanced Settings (existing)
Moved to bottom. No changes to content (game system, player count, starting level, schedule, house rules, Obsidian import link).

## Data Flow on Submit

```
handleSubmit()
  ├── 1. campaigns.create mutation → Campaign + Player records (transaction)
  │      Input: name, description, bannerImageUrl, settings (incl. themes), players (blank-filtered)
  │      Returns: { id: campaignId, slug }
  │
  ├── 2. For each import doc file (parallel):
  │      homebrewPdf.getUploadUrl → { presignedUrl, r2Key }
  │      PUT file → R2 via presignedUrl
  │      homebrewPdf.createPDF({ r2Key, r2Url, filename, fileSize, mimeType, campaignId }) → enqueues PDF worker
  │
  └── 3. If (antagonist OR factions OR location OR hook OR storyText):
           brain.seedFromCreation({ campaignId, worldSetup, storyText })
             → Creates WorldEntity records: LOCATION, THREAT, FACTION
             → Writes WorldState: hooks += [openingHook]
             → If storyText: enqueues brain ingestion job (sessionId: null, jobId: `brain-campaign-${campaignId}`)
```

**Error handling:** Steps 2 and 3 are best-effort after campaign creation succeeds. If either fails, the campaign already exists and a toast notifies the DM. Brain page shows an empty state with a "Seed from existing sessions" button for manual recovery. Upload failures are shown inline per-file.

## API Changes

### `campaigns.create` input schema additions
```ts
// In CreateCampaignSchema settings object:
themes?: z.array(z.string()).optional()

// New top-level fields:
players?: z.array(z.object({
  name: z.string().max(100),
  characterName: z.string().max(100),
}).refine(r => r.name.trim() !== '' || r.characterName.trim() !== '')).optional()
```

`worldSetup` and `storyText` are **not** added to `campaigns.create` — they are sent as a separate `brain.seedFromCreation` call after step 1 resolves, to keep the transaction lightweight.

### New tRPC procedure: `brain.seedFromCreation`
Added to the **existing `brainRouter`** (`src/server/routers/brain.ts`). Use `protectedProcedure` with a manual campaign ownership check (matching the existing pattern in that router — `campaignOwnerProcedure` is not currently imported in `brain.ts`). The client passes the `campaignId` returned from step 1.

Input schema:
```ts
z.object({
  campaignId: z.string(),
  worldSetup: z.object({
    startingLocation: z.string().max(200).optional(),
    antagonistName: z.string().max(200).optional(),
    antagonistMotivation: z.string().max(200).optional(),
    openingHook: z.string().max(200).optional(),
    factions: z.array(z.object({
      name: z.string().max(100),
      stance: z.enum(['ally', 'neutral', 'hostile']),
    })).max(3).optional(),
  }).optional(),
  storyText: z.string().max(20000).optional(),
})
```

## Brain Ingestion for Story So Far

Reuses `processBrainIngestionJob` with `sessionId: null`. This requires changes across the brain ingestion queue interface and worker:

**Files to modify:**
1. `src/lib/queue/brain-ingestion-queue.ts` — `BrainIngestionJobData`: change `sessionId: string` → `sessionId: string | null`; add `source?: string` field to the interface
2. `src/lib/queue/brain-ingestion-queue.ts` — `addBrainIngestionJob` job name and jobId: when `sessionId` is null use `brain-ingest-campaign-${data.campaignId}` for both name and `jobId` to prevent `brain-ingest-null` collisions across campaigns
3. `src/lib/queue/brain-ingestion-worker.ts` — session fetch block: guard with `if (data.sessionId)` before fetching session context; when null, proceed with summary text only as input to entity extraction
4. Any other usages of `data.sessionId` within the worker that assume non-null: add null guards

The entity extraction prompt works from summary text alone — no session-specific context is required when `sessionId` is null.

Ingestion job payload:
```ts
{
  campaignId,
  sessionId: null,
  summary: storyText,
  highlights: [],
  source: 'campaign_creation'
}
```

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
- `.md`/`.txt` document upload — PDF only for now; plaintext migration is covered by the Story So Far textarea

## Testing

- `campaign-create.spec.ts` workflow spec: extend with players section (blank-row filtering), world setup fields, PDF upload via `homebrewPdf.getUploadUrl` + `createPDF`, brain seeding after creation
- `veteran-dm.persona.spec.ts`: add checkpoint verifying brain entities exist after creation with world setup data
- Unit test: `brain.seedFromCreation` creates correct WorldEntity types for each worldSetup field
- Unit test: `processBrainIngestionJob` handles `sessionId: null` — skips session fetch, extracts entities from summary text
- Unit test: `addBrainIngestionJob` produces non-colliding jobId when `sessionId` is null
