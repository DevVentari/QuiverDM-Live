# Import Hub — Design Document
**Date:** 2026-03-02
**Status:** Approved

## Overview

A unified Import Hub that lets users bring D&D content into QuiverDM from any platform they use to write/manage their campaigns. Supports 8 sources across two connection modes (live API sync and export file upload).

**Sources:**
- Notion, Obsidian, Google Docs, Word (.docx), Markdown files
- World Anvil, Campfire, Kanka.io

---

## 1. Core Architecture

All sources flow through a single pipeline:

```
Source → Adapter.normalize() → NormalizedDocument[] → ImportProcessingService → HomebrewContent[]
                                                               ↓
                                                         ImportJob (progress tracking)
```

### `ImportAdapter` Interface

Every source implements this interface:

```typescript
interface ImportAdapter {
  source: ImportSource
  normalize(params: AdapterParams): Promise<NormalizedDocument[]>
}
```

### `NormalizedDocument` Type

Bridge between raw source data and AI extraction:

```typescript
interface NormalizedDocument {
  title: string
  markdown?: string           // unstructured → full AI extraction
  type?: HomebrewContentType  // pre-classified → skip AI type detection
  data?: Record<string, unknown> // pre-structured → skip AI extraction entirely
  tags?: string[]
  sourceId?: string           // external ID for deduplication
  sourceUrl?: string
}
```

**Processing rules in `ImportProcessingService`:**
1. `data` present → save directly as `HomebrewContent` (no AI)
2. `markdown` + `type` → AI extraction with type hint (faster, cheaper)
3. `markdown` only → full `extractWithFallback()` chain

Structured sources (Notion, Kanka, World Anvil, Campfire) emit `type` + `data` pre-filled.
Unstructured sources (Obsidian, Markdown, Docx, Google Docs) emit `markdown` only.

---

## 2. Database Changes

### New `ImportJob` model

Replaces/supersedes `ObsidianImportJob` for all new imports. Existing obsidian imports keep working; new obsidian imports use `source: 'obsidian'`.

```prisma
model ImportJob {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaignId String?
  campaign   Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  source     String    // 'notion' | 'obsidian' | 'google_docs' | 'docx' | 'markdown_file' | 'world_anvil' | 'campfire' | 'kanka'
  status     String    // 'pending' | 'processing' | 'complete' | 'failed'
  progress   Int       @default(0)
  total      Int       @default(0)
  error      String?
  metadata   Json?     // source-specific params (page IDs, fileKey, API token ref, etc.)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([userId])
  @@index([status])
}
```

### New `SourceCredential` model

Stores per-user API tokens for connected sources:

```prisma
model SourceCredential {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  source    String   // 'notion' | 'world_anvil' | 'kanka' | 'campfire' | 'google_docs'
  data      Json     // { token, workspaceId, refreshToken, etc. }
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, source])
  @@index([userId])
}
```

### New fields on `HomebrewContent`

```prisma
sourceExternalId String? // Notion page ID, Kanka entity ID, World Anvil article ID, etc.
sourceJobId      String? // ImportJob.id that created this record
```

Add to existing indexes: `@@index([sourceExternalId])`.

---

## 3. tRPC + API Structure

### New `importHub` router (`src/server/routers/import-hub.ts`)

```typescript
importHub.startImport({
  source: ImportSource,
  params: SourceParams,   // source-specific union type
  campaignId?: string
}) → { jobId: string }

importHub.getJobStatus({ jobId }) → { status, progress, total, error, results[] }

importHub.getConnectedSources() → { source: string, connected: boolean, label: string }[]

importHub.connectSource({ source, credentials }) → void   // saves SourceCredential

importHub.disconnectSource({ source }) → void

importHub.previewSource({ source, params }) → NormalizedDocument[]  // dry-run, no save
```

### New API route for file uploads

```
POST /api/imports/upload
```

Accepts multipart form data (obsidian .zip, .docx, .md, world_anvil .xml, kanka/campfire .json).
Stores file to R2, returns `{ fileKey }`.
Client then calls `importHub.startImport({ source, params: { fileKey } })`.

### BullMQ job (`import-job` queue)

Single worker handles all sources via `AdapterFactory`:

```typescript
importJobWorker.process(job) {
  const adapter = AdapterFactory.create(job.data.source)
  const docs = await adapter.normalize(job.data.params)
  await importJob.update({ total: docs.length })
  for (const [i, doc] of docs.entries()) {
    await processingService.processDocument(doc, job.data)
    await job.updateProgress(i + 1)
  }
}
```

---

## 4. UI Structure

### New page: `/homebrew/import`

Grid of source cards showing connection status and CTA.

**Entry points:**
- `Import Content` button in `/homebrew` page header
- Prompt in campaign creation flow (after first campaign created)
- Campaign settings sidebar

### Per-source modal

- **Notion**: page tree browser — checkboxes to select pages/subtrees, optional campaign assignment
- **Obsidian**: drag-and-drop ZIP, toggles for content types (NPCs / sessions / homebrew / characters)
- **Google Docs**: paste shareable URL or OAuth connect button
- **Docx / Markdown**: drag-and-drop file upload (multi-file)
- **World Anvil / Kanka**: radio — API token OR export file upload; Campfire: export only
- **Campfire**: export JSON upload only (no public API)

### Progress view (in-modal after submit)

Polls `importHub.getJobStatus()` every 2s. Shows per-item progress, live item names.
On complete: summary (`23 items saved — 8 creatures, 6 locations, 5 items, 4 characters`) with link to homebrew library filtered to the new import's `sourceJobId`.

---

## 5. Source-Specific Adapters

| Source | Mode | Auth | Pre-classification | Dedup key |
|--------|------|------|-------------------|-----------|
| Notion | API | `NOTION_API_KEY` (user's token in `SourceCredential`) | Parent page name (NPC→creature, Location→location, PC→character) | Notion page ID |
| Obsidian | File upload (.zip) | None | Frontmatter `type` field; reuses `obsidian-extraction.ts` | File path + vault name |
| Google Docs | Shareable URL or OAuth | Google refresh token in `SourceCredential` | None — full AI extraction | Doc ID |
| Word (.docx) | File upload | None | None — full AI extraction via `mammoth` → markdown | Filename + userId |
| Markdown | File upload (.md) | None | None — full AI extraction | Filename + userId |
| World Anvil | API or XML export | Token in `SourceCredential` | Article category field | Article UUID |
| Campfire | JSON export | None | Native type field | Campfire entity ID |
| Kanka | API or JSON export | Token in `SourceCredential` | Entity type (`characters`→character, `locations`→location, `creatures`→creature, `items`→item, `journals`→rule) | Kanka entity ID |

**Notion adapter detail:**
Fetches selected page IDs recursively via blocks API. Converts Notion block types to markdown (headings, paragraphs, callouts, toggles, tables, bulleted/numbered lists). Pages in "NPC" or "Monster" parents → `creature`, "Location"/"Region" → `location`, "Character"/"PC" → `character`, "Item"/"Spell" parents → AI extraction. `sourceExternalId` = Notion page ID.

**World Anvil API endpoints:**
`GET worldanvil.com/api/aragorn/world/{slug}/articles` — paginated article list.
Articles have a `category` field mapping to content type.

**Kanka API endpoints:**
`GET kanka.io/api/1.0/campaigns/{id}/{entity_type}` — per entity type.
Entity types: `characters`, `locations`, `creatures`, `items`, `journals`, `organisations`, `races`.

---

## File Structure (new files)

```
src/
  lib/
    import-adapters/
      index.ts                   # AdapterFactory + ImportSource enum
      types.ts                   # NormalizedDocument, ImportAdapter, AdapterParams
      notion.adapter.ts
      obsidian.adapter.ts        # wraps existing obsidian-extraction.ts
      google-docs.adapter.ts
      docx.adapter.ts
      markdown-file.adapter.ts
      world-anvil.adapter.ts
      campfire.adapter.ts
      kanka.adapter.ts
    import-processing.service.ts # ImportProcessingService
  queue/
    import-job.worker.ts         # BullMQ worker for import-job queue
  server/
    routers/
      import-hub.ts              # tRPC importHub router
    repositories/
      import-job.repository.ts
      source-credential.repository.ts
  app/
    (app)/
      homebrew/
        import/
          page.tsx               # Import Hub page
          _components/
            source-card.tsx
            import-modal.tsx
            notion-page-picker.tsx
            progress-view.tsx
    api/
      imports/
        upload/
          route.ts               # multipart file upload → R2
```
