# DDB Campaign Link + Status-Grouped Characters

**Date:** 2026-05-04
**Scope:** Players page — two additions: DDB campaign linking/sync, and full character status visibility.

---

## 1. Status-Grouped Characters

### Problem
`findByCampaignId` defaults to `[ACTIVE, PENDING]`. RETIRED and DECEASED characters are never fetched, so DMs can't see them for revival, reference, or history.

### Change: Repository
`src/server/repositories/character.repository.ts` — `findByCampaignId` default statuses change from:
```ts
statuses: CharacterStatus[] = [CharacterStatus.ACTIVE, CharacterStatus.PENDING]
```
to:
```ts
statuses: CharacterStatus[] = [CharacterStatus.ACTIVE, CharacterStatus.PENDING, CharacterStatus.RETIRED, CharacterStatus.DECEASED]
```
REMOVED stays excluded — those were explicitly dismissed.

### Change: Frontend
`src/app/(app)/campaigns/[slug]/players/page.tsx` — replace the current two-bucket split (`pending` / `active`) with four buckets:

| Bucket | Statuses | Section heading | Visual treatment |
|--------|----------|-----------------|------------------|
| `pending` | PENDING | "Pending Approval" | Dashed amber border, Approve/Reject actions |
| `active` | ACTIVE | "Party" | Full opacity, status dropdown |
| `retired` | RETIRED | "Retired" | 65% opacity, dimmed card background |
| `deceased` | DECEASED | "Deceased" | 65% opacity, dark-red tinted card background |

Sections with zero entries are omitted. `useCampaignPageSlot` stat count uses `active.length` only (PENDING badge stays).

---

## 2. DDB Campaign Link + Sync

### Schema
Add one nullable field to `Campaign`:
```prisma
dndBeyondCampaignUrl  String?   // e.g. https://www.dndbeyond.com/campaigns/7547491
```
Migration via `npm run db:push`.

### Backend — two new endpoints in `campaigns` router

**`campaigns.getDdbCampaignUrl`** (`campaignMemberProcedure` query)
- Input: `{ campaignId: string }`
- Returns: `{ url: string | null }`
- Reads `campaign.dndBeyondCampaignUrl` from DB.

**`campaigns.setDdbCampaignUrl`** (`campaignDMProcedure` mutation)
- Input: `{ campaignId: string, url: string | null }`
- Validates URL: must match `/dndbeyond\.com\/campaigns\/\d+/` or be null (unlink).
- Writes to `campaign.dndBeyondCampaignUrl`.
- Returns updated `{ url: string | null }`.

The existing `charactersDndBeyond.importFromCampaign` mutation handles the actual scrape — no changes needed there.

### Frontend — players page additions

**State:** `trpc.campaigns.getDdbCampaignUrl.useQuery({ campaignId })` — fetched alongside characters query.

**When `url` is null (unlinked):**
- Actions row (DM only): `[Link D&D Beyond]  [Add Character]`
- "Link D&D Beyond" is a secondary button (outline style).
- Click opens a shadcn `Dialog`:
  - Title: "Link D&D Beyond Campaign"
  - Single `Input` — placeholder `https://www.dndbeyond.com/campaigns/…`
  - "Link" button calls `setDdbCampaignUrl`, closes dialog on success, invalidates `getDdbCampaignUrl`.

**When `url` is set (linked):**
- Actions row: `[⟳ Sync DDB]  [×]  [Add Character]`
- "Sync DDB" is amber-tinted outline button. Click calls `charactersDndBeyond.importFromCampaign({ campaignUrl: url, campaignId })`.
  - Loading spinner while pending.
  - Success toast: "Synced — X imported, Y already up to date" (use `imported` + `failed` from response).
  - Error toast on failure.
- "×" (unlink) is a small ghost icon button; calls `setDdbCampaignUrl` with `url: null`, no confirmation needed.

**CobaltSession requirement:** `importFromCampaign` throws `BAD_REQUEST` if no Cobalt token in UserSettings. Surface this as: toast "D&D Beyond session not configured — add your CobaltSession in Settings → API Keys."

---

## 3. Out of Scope

- Automatic / scheduled sync (manual refresh only for now).
- Syncing existing characters (importFromCampaign already handles duplicates via dndBeyondId).
- Showing REMOVED characters.
- Any changes to the CharacterAddSheet or character detail flow.
