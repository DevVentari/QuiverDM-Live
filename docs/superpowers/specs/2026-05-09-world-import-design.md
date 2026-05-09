# World Content Import — Design Spec

**Date:** 2026-05-09
**Scope:** Extend the existing `ImportSheet` to support JSON, markdown, and PDF uploads that fully populate the campaign compendium, DM Brain, and world lore page.

---

## Problem

The 30 Hameria Ire JSON files (produced by `conversion_script.py` from Obsidian markdown) need to reach the DB to enable two test scenarios:

1. **Seeding from creation** — a new campaign selects "Tales from the Bonfire Keep" as a world sourcebook; `seedFromWorldSourcebook` clones all content from the source campaign. The source campaign must first be populated.
2. **Import through UI** — a DM uploads campaign content files directly into any campaign via the World Lore page.

---

## Existing Infrastructure

| Piece | Location | Status |
|---|---|---|
| `ImportSheet` | `src/components/world/import-sheet.tsx` | Exists — markdown only, single file, 55KB limit |
| `campaigns.importFromMarkdown` | `src/server/routers/campaigns.ts` | Exists — AI entity extraction |
| `campaigns.confirmImport` | `src/server/routers/campaigns.ts` | Exists — saves extracted entities |
| `campaigns.seedFromWorldSourcebook` | `src/server/routers/campaigns.ts` | Exists — clones docs+NPCs+homebrew between campaigns |
| `CampaignDocument` model | `prisma/schema.prisma` | Exists |
| `WorldEntity` / brain repository | `prisma/schema.prisma`, `src/server/repositories/brain.repository.ts` | Exists |
| `addBrainIngestionJob` | `src/lib/queue/brain-ingestion-queue.ts` | Exists |
| Docling PDF pipeline | `src/server/workers/homebrew-pdf-worker.ts` | Exists |
| World Lore page | `src/app/(app)/campaigns/[slug]/world/page.tsx` | Exists — shows docs + homebrew + brain entities |

---

## Solution: Extend `ImportSheet` with Format Detection

### Entry Point

The existing "Import" button on the World Lore page (`/campaigns/[slug]/world`) opens the `ImportSheet`. No new entry point needed.

### File Acceptance

| Format | Selection | Size limit | AI needed |
|---|---|---|---|
| `.json` | Multi-file (up to 30) | 200KB per file | No — direct schema parse |
| `.md` | Single file | 55KB | Yes — existing extraction |
| `.pdf` | Single file | Existing limit | Yes — Docling → extraction |

File picker changes: `accept=".json,.md,.pdf"`, drop zone label updated to "JSON, Markdown, or PDF".

### UI Flow (three format paths, same 3-state shell)

```
upload → loading → review → confirm
```

- **upload**: file picker + drag-drop + format hint selector (markdown/PDF only)
- **loading**: spinner, format-specific message ("Parsing JSON files…" / "Extracting entities…" / "Converting PDF…")
- **review**: grouped entity list with checkboxes — same as today, plus a "Documents" group showing CampaignDocument records that will be created
- **confirm**: calls format-specific confirm mutation

---

## Processing Pipeline

### JSON Path (new)

1. Client reads selected files as text, sends `Array<{ filename: string; content: string }>` to `campaigns.importFromJson`
2. Server parses each file, validates envelope (`metadata`, `type`, `data[]`), skips malformed
3. Server builds two output lists per file:
   - **Document**: one `CampaignDocument` per file
   - **Entities**: NPC / homebrew / WorldEntity records from `data[]`
4. Returns full preview payload grouped by type
5. Client shows review screen — user can deselect any item
6. `campaigns.confirmJsonImport` creates all selected records (upsert by slug)

### Markdown Path (unchanged)

Single `.md` → `campaigns.importFromMarkdown` → AI extraction → entity review → `campaigns.confirmImport`

### PDF Path (new)

1. Client uploads file to `/api/upload/campaign-import-pdf`
2. Server: Docling converts PDF → markdown text (reuses homebrew PDF worker logic)
3. Server: AI extraction via `extractEntitiesFromMarkdown`
4. Returns entity preview — same review flow as markdown

---

## Data Mapping — JSON → DB Records

All JSON files produced by `conversion_script.py` share this envelope:

```json
{
  "metadata": { "title": "...", "date": "...", "tags": [...] },
  "source": "OriginalFile.md",
  "type": "actor|faction|location|adventure|item|race|lore",
  "data": [...]
}
```

### CampaignDocument (every file)

| JSON field | CampaignDocument field |
|---|---|
| `metadata.title` | `title` |
| slugify(`source` filename) | `slug` (upsert key — re-import safe) |
| `type` (`actor` → `npc-collection`) | `type` |
| `data[]` sections rendered as markdown | `content` |
| Full `data[]` array | `data` (Json field) |
| `metadata.tags` | `tags` |
| `source` | `sourceFile` |
| `"none"` | `brainIngestStatus` (updated to `"pending"` after job queued) |

### Entity Records (per `data[]` entry)

| JSON `type` | CampaignDocument | NPC | Homebrew | WorldEntity | Brain job |
|---|---|---|---|---|---|
| `actor` + `"npc"` in tags | ✓ | ✓ per entry | — | ✓ `NPC` per entry | ✓ |
| `actor` + `"monsters"` in tags | ✓ | — | ✓ creature per entry | ✓ `MONSTER` per entry | ✓ |
| `faction` | ✓ | — | — | ✓ `FACTION` per named section | ✓ |
| `location` | ✓ | — | — | ✓ `LOCATION` per named section | ✓ |
| `item` | ✓ | — | ✓ item per entry | ✓ `ITEM` per entry | ✓ |
| `race` | ✓ | — | ✓ race per entry | — | ✓ |
| `adventure`, `lore` | ✓ | — | — | — | ✓ |
| Player Characters (lore + `"pc"` in tags) | ✓ | — | — | ✓ `PC` per file | ✓ |

**Header entry filtering:** entries where `name` matches known category headers ("Bestiary of the Grand Harvest", "Master Item List", "Introduction", "Overview") or where `mechanics` is empty `{}` and `description` contains only markdown headings → skipped for entity creation.

**NPC field mapping:**
- `name` → `npc.name`
- `description` (first 500 chars) → `npc.description`
- `type_alignment` → `npc.role`
- Full entry as JSON → `npc.stats`

---

## New tRPC Procedures

### `campaigns.importFromJson`
- **Input:** `{ campaignId: string; files: Array<{ filename: string; content: string }> }`
- **Auth:** `campaignDMProcedure`
- **Returns:** `{ documents: PreviewDoc[]; entities: ExtractedEntity[] }` — preview only, nothing written

### `campaigns.confirmJsonImport`
- **Input:** `{ campaignId: string; files: Array<{ filename: string; content: string }>; selectedSlugs: string[]; selectedEntityIndices: number[] }`
- **Auth:** `campaignDMProcedure`
- **Returns:** `{ docsCreated: number; entitiesCreated: number; jobsQueued: number }`
- **Side effects:** upserts CampaignDocument records, NPC records, homebrew records, WorldEntity records via `brainRepository.upsertEntity`, queues brain ingestion jobs

### `/api/upload/campaign-import-pdf` (new API route)
- Accepts multipart form with PDF file
- Calls Docling, returns extracted markdown text
- Text then passed to existing `campaigns.importFromMarkdown`

---

## R2 CORS Fix

The R2 bucket CORS allowlist must include `https://dev.quiverdm.com` (staging domain). Currently only production origin is allowed. **Manual change in Cloudflare R2 dashboard** — not a code change.

## PrepImportZone Bug Fix

`src/components/session\prep\prep-import-zone.tsx` drag-drop handler accepted any file type despite picker having `accept=".pdf,image/*"`. Fixed: validate `file.type` on drop, reject non-PDF/image with error message. **Already applied.**

---

## Test Scenarios

### Test 1 — Seeding from creation
1. Import all 30 Hameria Ire JSONs into the `tales-from-the-bonfire-keep` source campaign via the World Lore import UI
2. Create a new campaign → Step 2 → select "Tales from the Bonfire Keep"
3. `seedFromWorldSourcebook` clones CampaignDocuments + NPCs + homebrew to the new campaign
4. Verify: world page shows documents grouped by type; brain entities appear under World Entities

### Test 2 — Import through UI
1. Open World Lore page on any campaign → "Import"
2. Select all 30 JSON files
3. Review screen: expect ~30 documents, ~25+ NPCs, ~10 faction entities, ~10 location entities, ~5 items, 3 PCs
4. Confirm → verify world page and brain entities populated

### Workflow spec
`tests/workflows/world-import.workflow.spec.ts`

---

## Out of Scope
- Obsidian folder/ZIP sync
- Markdown import creating CampaignDocument records (entities only, existing behaviour)
- Editing or deleting imported documents via UI
