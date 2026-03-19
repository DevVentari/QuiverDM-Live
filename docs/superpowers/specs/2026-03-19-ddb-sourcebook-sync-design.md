# D&D Beyond Sourcebook Sync — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Overview

DMs can import any D&D Beyond sourcebook (adventure, supplement) they own or have shared access to into QuiverDM. The sync pipeline extracts monsters, encounter plans, NPCs, locations, and lore from each chapter and seeds them across the DM's selected campaigns. Re-syncing detects DDB content changes and flags differences for DM review rather than silently overwriting.

## Discovery Findings

From Playwright network sniffing of the DDB adventure reader:

- **Auth:** `CobaltSession` cookie → `auth-service.dndbeyond.com/v1/cobalt-token` → short-lived JWT (TTL ~1800s)
- **TOC:** `/sources/<slug>` → `.compendium-toc-full-text h3 a` links enumerate chapters
- **Chapter content:** `/sources/<slug>/<chapter-slug>` → `.p-article-content` (server-rendered HTML)
- **Monster links:** inline `<a href="/monsters/<id>-<slug>">` — DDB IDs included
- **Chapter structure:** H2 = major encounter areas, H3 = sub-locations
- **Custom monsters:** Bestiary appendix at `/sources/<slug>/bestiary`
- **Entitlements:** detected via DDB account session (fetched on-demand)

Vecna: Eve of Ruin has 16 chapters (intro + 11 chapters + 3 appendices) and 57 custom monsters.

## Data Model

### New Models

```prisma
model DdbEntitlement {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  slug          String
  title         String
  coverImageUrl String?
  accessType    String        // 'owned' | 'shared' | 'free'
  sourceUrl     String
  detectedAt    DateTime      @default(now())
  sourcebook    DdbSourcebook?

  @@unique([userId, slug])
  @@index([userId])
}

model DdbSourcebook {
  id              String                 @id @default(cuid())
  userId          String
  user            User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  entitlementId   String                 @unique
  entitlement     DdbEntitlement         @relation(fields: [entitlementId], references: [id])
  slug            String
  title           String
  campaignIds     String[]               // DM-selected campaigns to seed into
  syncStatus      String                 @default("idle") // 'idle' | 'running' | 'error'
  lastSyncError   String?                // 'auth' | 'network' | 'parse' — used to suppress scheduler retries
  lastSyncedAt    DateTime?
  contentHash     String?                // hash of TOC HTML for top-level change detection
  chapters        DdbSourcebookChapter[]
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  @@unique([userId, slug])
  @@index([userId])
}

model DdbSourcebookChapter {
  id                String        @id @default(cuid())
  sourcebookId      String
  sourcebook        DdbSourcebook @relation(fields: [sourcebookId], references: [id], onDelete: Cascade)
  slug              String
  title             String
  chapterIndex      Int
  contentHash       String?       // SHA-256 of .p-article-content HTML
  syncStatus        String        @default("idle") // 'idle' | 'running' | 'error'
  hasPendingChanges Boolean       @default(false)
  pendingChanges    Json?         // { entityType, entityId, entityName, field, oldValue, newValue }[]
  lastSyncedAt      DateTime?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@unique([sourcebookId, slug])
  @@index([sourcebookId])
}
```

### Existing Models Extended

- `UserSettings` — add `ddbCobaltSession String?` (AES-256 encrypted, same pattern as `geminiApiKey`)
- `HomebrewContent` — already has `dndBeyondId` + `dndBeyondUrl`; add `ddbChapterId String?` for traceability
- `EncounterPlan` — add `ddbChapterId String?` for traceability
- `WorldEntity` — add `ddbChapterId String?` for traceability

## Sync Pipeline

### Queues

| Queue | Purpose |
|---|---|
| `ddb-sourcebook-sync` | Coordinator jobs — one per sync trigger |
| `ddb-chapter-extract` | Per-chapter extraction — max 3 concurrent per sourcebook |
| `ddb-sync-review` | Post-completion aggregation and notification |

### Flow

```
[Scheduler (weekly) or DM clicks "Sync Now"]
        ↓
DdbSyncCoordinatorJob
  1. Decrypt CobaltSession from UserSettings
  2. POST auth-service.dndbeyond.com/v1/cobalt-token → cobalt JWT
     - On failure: set syncStatus = 'error', lastSyncError = 'auth', notify DM, abort
  3. Fetch /sources/<slug> HTML → parse .compendium-toc-full-text h3 a → chapter list
  4. For each chapter: fetch .p-article-content HTML, SHA-256 hash it
     → compare to DdbSourcebookChapter.contentHash
  5. Enqueue DdbChapterExtractJob for each changed/new chapter
     - Pass cobalt JWT in job payload (NOT raw CobaltSession)
     - JWT is short-lived (~30 min); all chapter jobs start within seconds of coordinator
  6. Set DdbSourcebook.syncStatus = 'running'
  7. Listen for BullMQ 'completed'/'failed' events on ddb-chapter-extract queue
     → when all enqueued chapter jobs finish, enqueue DdbSyncReviewJob
        ↓ (parallel, max 3 concurrent, 500ms delay between DDB requests per job)
DdbChapterExtractJob  [payload: { chapterId, chapterUrl, cobaltJwt, campaignIds }]
  1. Fetch chapter HTML using cobaltJwt as Authorization: Bearer header
  2. Parse .p-article-content:
     - Extract monster links → [{ ddbId, name, url }]
     - Extract H2 headings → encounter area names
     - Extract prose text → lore string
  3. For each unique monster ddbId (deduplicated):
     - Fetch /monsters/<id> page → scrape stat block (existing monster scraper)
     - Add 500ms delay between each monster page fetch
     - Upsert HomebrewContent by dndBeyondId (user-scoped)
  4. For each H2 area → upsert EncounterPlan in each campaign in campaignIds
  5. AI extraction on prose → NPCs, locations, faction references
     → Upsert WorldEntity per extracted entity in each campaign in campaignIds
  6. RAG ingest chapter prose (existing pipeline)
  7. Compare new content hash to prior DdbSourcebookChapter.contentHash
     - If changed: set hasPendingChanges = true
     - Store field-level diffs: { entityType, entityId, entityName, field, oldValue, newValue }[]
     - Update contentHash
        ↓ (coordinator detects all chapter jobs complete via BullMQ events)
DdbSyncReviewJob
  1. Aggregate chapter results
  2. If any chapter hasPendingChanges → create in-app notification for DM
  3. Set DdbSourcebook.syncStatus = 'idle', update lastSyncedAt, clear lastSyncError
```

### Scheduled Update-Check (lightweight, weekly)

Separate job — no AI extraction, no writes:
1. Skip users where `lastSyncError = 'auth'` (session expired — suppress until DM re-enters session)
2. Decrypt CobaltSession, exchange for cobalt JWT — if fails, set `lastSyncError = 'auth'`, notify DM once
3. Re-fetch chapter HTML, SHA-256 hash `.p-article-content`, compare to stored `contentHash`
4. If any hash changed → notify DM "Updates available for [Sourcebook]"
5. DM clicks "Apply updates" → triggers full coordinator job

### CobaltSession Lifecycle

- Stored encrypted in `UserSettings.ddbCobaltSession` (AES-256, same as `geminiApiKey`)
- Exchanged for a cobalt JWT at coordinator start; **JWT is passed to chapter workers — raw CobaltSession never leaves the coordinator or enters Redis**
- JWT is short-lived (~30 min) but sufficient for parallel chapter jobs completing within seconds
- If exchange fails → job aborts with `lastSyncError = 'auth'`, DM notified to re-enter session
- No background refresh — DM pastes a new session value when prompted
- Scheduler skips users with `lastSyncError = 'auth'` to avoid repeated noise

### Rate Limiting

- Chapter jobs: max 3 concurrent (BullMQ `concurrency: 3` on the chapter queue)
- Monster page fetches: 500ms delay between each request within a chapter job
- Chapter HTML fetches: 500ms delay between each in the coordinator

## Campaign Selection

When a DM imports a sourcebook, they select which of their campaigns to seed content into. The selection is stored in `DdbSourcebook.campaignIds` and applied to:
- `EncounterPlan` creation (one plan per H2 area per selected campaign)
- `WorldEntity` creation (one entity per NPC/location per selected campaign)
- RAG ingestion (per campaign embedding)

`HomebrewContent` (monsters) is user-scoped and not campaign-specific — created once regardless of campaign selection.

DMs can update their campaign selection after import; re-sync applies to the current `campaignIds`.

## Entitlement Listing

**On-demand** — fetched when DM opens "Add Sourcebook" screen.

Detection flow:
1. Use CobaltSession to fetch the DM's accessible sourcebooks from DDB
2. Display as a grid in the UI immediately
3. Persist detected entitlements to `DdbEntitlement` (slug, title, cover image URL, access type)
4. Raw purchase/account metadata discarded after extraction

**Privacy disclosure** shown before first detection:
> "We'll read your D&D Beyond library to show which sourcebooks you can import. We store basic metadata (title and cover) to power this view — no purchase details or account information."

## Change Review Flow

When `hasPendingChanges = true` on a chapter:
- Chapter shows diff indicator in the sourcebook detail drawer
- "Review changes" expands to a field-level diff list per affected entity: entity name, field, old value, new value
- DM actions per change: **Accept** (write DDB version) or **Keep mine** (dismiss, no write)
- Bulk **Accept all** / **Keep all** available
- Accepting writes the new value and clears the pending flag for that diff entry
- When all diffs resolved, `hasPendingChanges` set to `false`

## UI Surfaces

### Settings → D&D Beyond Tab

- CobaltSession field (masked input, encrypted on save)
- "Detect My Library" button → on-demand entitlement fetch
- Privacy disclosure banner (shown before first detection, dismissible after)
- Sourcebook grid: cover image + title + access type badge (Owned / Shared / Free) + "Import" or "Synced" CTA

### Import Flow (drawer or modal)

- Triggered from "Import" CTA on sourcebook grid
- Step 1: show sourcebook summary (chapter count, monster count)
- Step 2: campaign selector (checkboxes for DM's campaigns, default all active)
- Confirm → triggers DdbSyncCoordinatorJob

### Sourcebook Detail Drawer

- Chapter list with per-chapter status (synced / pending changes / running / error)
- "Sync Now" button → triggers coordinator job
- "Last synced: X ago" timestamp
- Chapters with pending changes show diff indicator → expand to review UI
- Error chapters show error reason with action (e.g. "Session expired — update in Settings")

### In-App Notification

- "Vecna: Eve of Ruin has updates available" → deep-links to sourcebook detail drawer
- Triggered by DdbSyncReviewJob when any chapter has `hasPendingChanges = true`
- Auth failure notification: "Your D&D Beyond session has expired — update it in Settings to continue syncing"

## Extraction Targets Per Chapter

| Source | Extracts to | Scope |
|---|---|---|
| Monster links (`a[href*="/monsters/"]`) | `HomebrewContent` | User-scoped |
| H2 headings + creature references | `EncounterPlan` + `EncounterPlanCreature` | Selected campaigns |
| AI-extracted NPCs + locations | `WorldEntity` | Selected campaigns |
| Chapter prose | RAG (Embedding) | Selected campaigns |

## Error Handling

- CobaltSession expired → coordinator aborts, `lastSyncError = 'auth'`, DM notified once
- Individual chapter job failure → chapter marked `error`, others continue unaffected
- Monster page scrape failure → logged, chapter continues without that monster
- AI extraction failure → lore skipped for RAG, WorldEntities not created (no partial writes)
- All errors visible in the chapter status list in the sourcebook detail drawer

## Out of Scope

- Non-DDB sources (handled by PDF pipeline and Obsidian import)
- Player-facing entitlement listing (DM only)
- Automatic CobaltSession refresh (requires OAuth flow outside current scope)
- Map/image extraction from sourcebooks
