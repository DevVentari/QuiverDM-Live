# Onboarding Rework + Player Character Card Design

## Overview

Two related changes reflecting QuiverDM's DM-only identity:

1. **Onboarding** — reworked as a DM-first wizard. Removes player-facing paths (join campaign), adds DM experience field, rich first-campaign setup including DnD Beyond campaign import, sourcebook seeding, and world setup. Completion screen orients the DM toward the Brain.

2. **Player Character Card** — replaces the 7-tab DnD Beyond-style character sheet with a compact stat block card (same amber-bordered pattern as `StatBlockCard`). The card is the DM's reference: key stats, ability scores, and a DM Brain panel showing entity history, hooks, and relationships for this character. Used expanded on the character detail page and compact in the session cockpit party panel and prep workspace.

---

## 1. Onboarding

### Steps

#### Step 1 — Welcome
- Heading: "Built for Dungeon Masters"
- Three feature callouts (icon + title + one-line desc):
  - DM Brain — living world intelligence that tracks every entity, faction, and hook across your campaign
  - Session Recording — automatic transcription and AI summaries after every session
  - Prep Workspace — AI-assisted session prep with brain context baked in
- Single CTA: "Get Started"
- No mention of players, joining campaigns, or player-facing features

#### Step 2 — Profile
Fields:
- Display name (text input, max 50 chars)
- Bio (textarea, optional, max 500 chars)
- "How long have you been DMing?" (select, required):
  - `new` — First campaign
  - `junior` — 1–3 years
  - `experienced` — 3–10 years
  - `veteran` — 10+ years

Stored in `UserSettings.dmExperience` (new field, enum). Used downstream to calibrate help text and Brain tip framing.

#### Step 3 — First Campaign
Uses `glass-panel` + `label-overline` + `section-rule` pattern consistent with existing `/campaigns/new` page. Sections:

**Campaign Identity**
- Name (required, max 100 chars)
- Description (textarea, optional)

**DnD Beyond Import**
- Checks for `UserSettings.dndBeyondCobaltCookie` (existing field)
- If token present: text input for DDB campaign URL → on submit, fetch campaign → list linked characters → import each (public: full data via `fetchCharacterFromDDB`; private: best-effort scrape of visible page data — name, class, level, HP, AC, portrait URL)
- If token absent: amber callout card:
  - "Import your DnD Beyond party" heading
  - Brief explanation: install the QuiverDM DDB extension, then set your Cobalt cookie in Settings
  - Two links: "Install Extension" (external) + "Set Cookie in Settings" (→ `/settings/api-keys`)
  - Dismissible — DM can skip this section

**Sourcebook Seed**
- Only shown if `dndBeyondCobaltCookie` present in UserSettings
- Checkbox list of major sourcebooks (PHB, DMG, MM, Tasha's, Xanathar's, Mordenkainen's, etc.)
- "Seed selected sourcebooks" — triggers existing DDB sourcebook sync worker on campaign creation

**World Setup** (condensed — 3 fields only during onboarding, full version accessible post-creation)
- Starting Location → maps to `worldSetup.startingLocation`
- Main Antagonist → maps to `worldSetup.antagonistName`
- Opening Hook → maps to `worldSetup.openingHook`

`antagonistMotivation` and `factions` are not collected during onboarding — both pass as `undefined` to `brain.seedFromCreation`. The full campaign creation page (`/campaigns/new`) collects these post-onboarding.

**Story So Far**
- Textarea, max 20,000 chars
- Placeholder: "Migrating from another tool? Paste your campaign history here and the DM Brain will extract it."

**Documents**
- PDF drag-and-drop upload, max 10 files, max 50MB each
- Same UI pattern as existing `/campaigns/new` import section

#### Step 4 — Complete
- Animated pulsing Brain icon (amber glow)
- Heading: "DM Brain is waking up"
- Sub-copy: "Your campaign is being processed. Entities, factions, and hooks will appear in the Brain as ingestion completes."
- Two actions:
  - Primary: "Review Brain" → `/campaigns/[slug]/brain`
  - Secondary: "Go to Dashboard" → `/dashboard`
- Background: post-creation, fire `brain.seedFromCreation` with world setup + story text; trigger PDF ingestion queue for uploaded documents

### What's Removed
- "Join a Campaign" path (entire branch removed from `FirstCampaignStep`)
- Player-facing copy from Welcome and Complete steps
- "Invite Your Players" callout from Complete step

### Implementation Notes
- `onboarding.ts` router: add `completeProfile` field for `dmExperience`
- Prisma: add `dmExperience String?` to `UserSettings` (or enum — prefer string for flexibility)
- DnD Beyond campaign fetch: new export `fetchDDBCampaignCharacters(campaignUrl, cobaltToken)` added to `src/lib/dndbeyond-api.ts` alongside the existing `fetchCharacterFromDDB` (not a replacement) — parses campaign ID from URL, hits DDB campaign API, returns array of `{ characterId: string; isPublic: boolean }[]`
- New tRPC procedure: `charactersDndBeyond.importFromCampaign` — accepts campaign URL + optional cobalt token, imports all characters via `fetchDDBCampaignCharacters` then calls `fetchCharacterFromDDB` per character, associates all with campaignId
- Onboarding router: existing procedures (`completeWelcome`, `completeProfile`, `completeFirstCampaign`, `skip`) retained; `completeProfile` input extended with `dmExperience`
- `src/server/services/onboarding.service.ts`: `completeProfile()` method must also be updated to write `dmExperience` to `UserSettings` after the Prisma migration adds the column

---

## 2. Player Character Card

### Component: `PlayerCharacterCard`

**File:** `src/components/character/PlayerCharacterCard.tsx`

**Props:**
```ts
// Defined in src/components/character/PlayerCharacterCard.tsx (collocated)
type CharacterWithBrainEntity = Character & {
  brainEntity?: WorldEntity & { relationships: WorldRelationship[] };
};

interface PlayerCharacterCardProps {
  character: CharacterWithBrainEntity;
  compact?: boolean;    // true = collapsed header only (cockpit/prep)
  campaignId?: string;  // enables Brain panel fetch
  className?: string;
}
```
`Character` is the Prisma-generated type from `@prisma/client`. `WorldEntity` and `WorldRelationship` are also from `@prisma/client`.

**Visual structure (expanded):**

```
┌─────────────────────────────────────────────────────┐
│  [Portrait 40x40]  Name          Race · Class Lv.N  │  ← header, always visible
│                    Background                        │
├─────────────────────────────────────────────────────┤
│  AC  HP cur/max  Speed  Initiative  Pass.Perc  Prof  │  ← stats strip
├─────────────────────────────────────────────────────┤
│  STR   DEX   CON   INT   WIS   CHA                  │  ← ability grid (score + mod)
├─────────────────────────────────────────────────────┤
│  Saving Throws: Con +5, Wis +3 (proficient bolded)  │
│  Skills: Perception +5, Stealth +4                  │
├─────────────────────────────────────────────────────┤
│  Key Features                                        │  ← 2-3 notable class features
│  Rage. ...  /  Sneak Attack. ...                    │
├─────────────────────────────────────────────────────┤
│  DM BRAIN  ← amber heading                          │
│  Last seen: Session 7                               │
│  Recent: Discovered Korrath's pact (Session 6)      │
│  Hooks: Owes a debt to the Obsidian Syndicate       │
│  Allies: Tavros the Merchant · Enemies: Strahd      │
├─────────────────────────────────────────────────────┤
│  DM Notes  [private textarea]                       │
│  [Sync from DnD Beyond]  [Edit]                     │
└─────────────────────────────────────────────────────┘
```

**Compact mode** (cockpit/prep party panel): header row only (portrait, name, class/level, HP, AC). Click to expand inline.

**Styling:** matches `StatBlockCard` exactly — `border border-amber-800/30 rounded bg-amber-950/10 text-sm`. Section dividers: `border-t border-amber-800/30`. DM Brain heading: `font-bold text-sm uppercase tracking-wide text-amber-700` (same as Actions heading in StatBlockCard).

### DM Brain Panel
- Fetches `brain.entities.list` with a name search filter (no `getByName` procedure exists — use the existing `list` endpoint with `search` param filtered to the character's name)
- Shows: `lastSeenSessionId`, recent `WorldStateChange` entries (last 3), active hooks where character name appears in `linkedEntityNames`, top 3 relationships by strength
- If no brain entity found: "Not yet tracked by DM Brain. Seed the Brain to see history here."
- Brain data is read-only in this card — link to full entity page for editing

### Character Detail Page
**File:** `src/app/(app)/characters/[characterId]/page.tsx`

Replace existing 7-tab layout with:
- `PlayerCharacterCard` (expanded, full width)
- Below card: collapsible "Full Sheet" section (accordion) containing the archived tab content for DMs who want the detail — hidden by default, not in navigation

The 7 tab components (`CharacterOverview`, `CharacterSpells`, etc.) are not deleted — wrapped in the accordion. The accordion wrapper must forward the same props the tabs currently receive: `data` (character object), `onUpdate` (mutation handler), `isUpdating` (boolean), `onRoll` (dice handler). Navigation link to `/characters/[id]` remains unchanged.

### Usage in Other Surfaces
- **Session Cockpit party panel** (`src/components/cockpit/`): replace existing HP/AC display with `PlayerCharacterCard compact={true}`
- **Prep Workspace** (`src/components/session/prep/`): party section shows compact cards for each campaign character

### Data: `dmExperience` on Character
No schema changes needed for the card itself. The Brain panel reads from existing `WorldEntity` and `WorldRelationship` models via the brain router.

---

## Files Changed

### Modified
- `src/app/(app)/onboarding/page.tsx` — full rewrite per new steps
- `src/app/(app)/characters/[characterId]/page.tsx` — replace tab layout with PlayerCharacterCard + archived accordion
- `src/server/routers/onboarding.ts` — extend `completeProfile` input with `dmExperience`
- `src/lib/dndbeyond-api.ts` — add `fetchDDBCampaignCharacters()`
- `src/server/routers/characters-dndbeyond.ts` — add `importFromCampaign` procedure

### Created
- `src/components/character/PlayerCharacterCard.tsx` — new stat-block-style PC card
- `src/server/services/characters-dndbeyond.service.ts` (extend) — `importFromCampaign()` method

### Schema
- `UserSettings`: add `dmExperience String?` field

---

## Out of Scope
- Removing character routes entirely (archived, not deleted)
- Full DnD Beyond campaign sync (ongoing — this is import only, one-time at creation)
- Player-facing character view (removed per product direction, not replaced)
- Cockpit and prep workspace integration shipped as follow-on once card is stable
