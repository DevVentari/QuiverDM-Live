# Campaign Creation Sheet — Design Spec

## Overview

Replace the 4-step full-page campaign creation wizard (`/campaigns/new`) with a 2-step Sheet component that opens from the campaigns list. Matches the character and NPC creation patterns already established in the app.

## Route Changes

- `/campaigns/new` → redirects to `/campaigns?create=true`
- `/campaigns/new/import-obsidian` → removed entirely
- `/campaigns` → gains `?create=true` query param handling to open/close the sheet

## Sheet Behaviour

Opened by the "New Campaign" button on the campaigns list page. Uses the shadcn `Sheet` component (right-side drawer), identical pattern to `CharacterAddSheet` and `NpcCreateSheet`.

URL state: `router.push('?create=true')` to open, `router.replace('/campaigns')` to close. Closing also fires on overlay click and the X button.

After successful creation: navigate to `/campaigns/[slug]` as before.

---

## Step 1 — Identity

Fields:
- **Campaign name** — text input, required, max 100 characters
- **Description** — textarea, optional, no max enforced in this flow
- **Banner image** — file upload (existing `/api/upload/campaign-banner` endpoint), optional

Footer actions:
- **Cancel** (left) — closes the sheet
- **Skip to Create** (right, secondary) — skips Step 2, calls create with Step 1 data only
- **Continue →** (right, primary) — advances to Step 2

Validation: name must be non-empty before Continue or Skip to Create are enabled.

---

## Step 2 — Extras (Optional)

Shown after clicking "Continue →" from Step 1. Both fields are optional; the user can skip the entire step.

Fields:
- **D&D Beyond Campaign URL** — text input, optional. Stored as `dndBeyondCampaignUrl` on the Campaign. Triggers party sync post-creation (same as the existing DDB import flow).
- **Published adventure template** — grid picker, optional. Selecting a template seeds the campaign with NPCs, locations, and encounters from that adventure via `seedFromCreation`. List of available adventures matches the existing `AdventurePicker` component.

Footer actions:
- **← Back** (left) — returns to Step 1
- **Skip** (centre, ghost) — creates campaign without Step 2 data
- **Create Campaign** (right, primary) — creates campaign with all collected data

---

## Step indicator

Two-step progress indicator in the sheet header area:
- Step 1 active: `1 Identity` highlighted, `2 Extras (optional)` dimmed
- Step 2 active: `1 ✓` (done, amber tint), `2 Extras (optional)` highlighted

---

## Data & Mutations

Reuses existing tRPC procedures — no new API work required:
- `campaigns.create` — same input schema as before (`name`, `description`, `bannerUrl`, `dndBeyondCampaignUrl`, `settings`)
- `campaigns.seedFromCreation` — called post-create if adventure template selected
- `campaigns.importFromCampaign` — called post-create if DDB URL provided

---

## What Is Removed

The following fields from the old wizard are dropped from the creation flow. They remain accessible on the campaign settings/overview page after creation:

- Starting location
- Antagonist name and motivation
- Opening hook
- Factions (add/remove with stance)
- Story So Far

The old Step 4 confirm/review screen is also removed — no summary step before creation.

---

## Files Affected

| Action | File |
|--------|------|
| Delete | `src/app/(app)/campaigns/new/page.tsx` |
| Delete | `src/app/(app)/campaigns/new/import-obsidian/page.tsx` |
| Add redirect | `src/app/(app)/campaigns/new/page.tsx` → `redirect('/campaigns?create=true')` (or delete and handle via middleware) |
| Modify | `src/app/(app)/campaigns/page.tsx` — add `?create=true` sheet handling + New Campaign button |
| Create | `src/components/campaign/campaign-create-sheet.tsx` — new Sheet component |

The `CampaignCreateSheet` component follows the same prop interface as `CharacterAddSheet`:
```ts
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
```
