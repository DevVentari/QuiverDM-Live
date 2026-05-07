# World Ecosystem — Design Spec
**Date:** 2026-05-07  
**Status:** Approved

## Problem

QuiverDM has rich world content for Hameria Ire (Tales from the Bonfire Keep) stored as markdown files in Google Drive, but no structured import pipeline to bring it into the app. The current `/world` page is a flat document library — no dedicated entity pages, no cross-linking, no type-specific display. Locations, monsters, and items can't be browsed or rendered with appropriate structure.

## Goals

1. Import all world content from `G:\My Drive\Notebooks\Dungeons and Dragons\Campaigns\Tales from The Bonfire Keep - AI Edits\` into the app
2. Build a `/world` section with a proper entity browser and dedicated detail pages per type
3. Establish a canonical world layer (hand-authored) that the DM Brain (AI inference) references

## Out of Scope

- Interactive world map
- Entity relationship graph UI
- Public-facing world wiki
- Multi-campaign world sharing

---

## Architecture Decision

**Canonical layer + AI inference layer separation.**

- `WorldEntry` (new model) = canonical, hand-authored world data — imported from MD files, editable by DM
- `WorldEntity` (existing Brain model) = AI-inferred data — extracted from session transcripts, links back to WorldEntry via FK

Neither replaces the other. The Brain watches sessions and adds observations about canonical entities. The World section displays both layers together on entity detail pages.

Existing `CampaignDocument` and `HomebrewContent` tables are unchanged — they continue serving the existing world page accordion. The new system runs alongside them.

---

## Data Model

### New: `WorldEntry`

```prisma
model WorldEntry {
  id             String          @id @default(cuid())
  campaignId     String
  campaign       Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  type           WorldEntryType
  name           String
  slug           String

  content        String          // Full raw markdown (the H2 section from the source file)
  summary        String?         // Short 1-2 sentence description (can be AI-generated)

  structuredData Json?           // Type-specific parsed fields (see below)
  tags           String[]

  worldEntityId  String?         // FK → WorldEntity (brain's inferred version of this entity)
  worldEntity    WorldEntity?    @relation(fields: [worldEntityId], references: [id])

  sourceFile     String?         // e.g. "Locations.md#Bonfire Keep"
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@unique([campaignId, slug])
  @@index([campaignId, type])
}

enum WorldEntryType {
  LOCATION
  NPC
  PC
  MONSTER
  ITEM
  FACTION
  RACE
  LORE
  TIMELINE
  SPELL
}
```

### Modified: `WorldEntity` (Brain)

Add one field:

```prisma
worldEntryId  String?    // FK → WorldEntry (canonical authored version)
worldEntry    WorldEntry? @relation(...)
```

### `structuredData` schema by type

**MONSTER**
```json
{
  "size": "Large",
  "type": "Plant/Construct",
  "alignment": "Unaligned",
  "ac": 18, "acNote": "Natural/Glass Armor",
  "hp": 114, "hpNote": "12d10 + 48",
  "speed": "20 ft.",
  "abilityScores": { "str": 19, "dex": 6, "con": 18, "int": 4, "wis": 10, "cha": 5 },
  "resistances": ["Piercing", "Slashing from non-magical attacks"],
  "immunities": ["Poison", "Psychic"],
  "conditionImmunities": ["Charmed", "Frightened", "Poisoned"],
  "senses": "Blindsight 60 ft.",
  "languages": "Understands Druidic but cannot speak",
  "cr": "6", "xp": 2300,
  "traits": [{ "name": "Glass-Brittle Skin", "description": "..." }],
  "actions": [{ "name": "Multiattack", "description": "..." }, { "name": "Slam", "description": "..." }],
  "reactions": [],
  "legendaryActions": []
}
```

**LOCATION**
```json
{
  "population": "Variable (20-50 visitors)",
  "government": "Divine Anchor stewardship",
  "defenses": "Cosmic protection wards, sanctuary zones",
  "commerce": "Wisdom exchange, cosmic knowledge",
  "notableLocations": [{ "name": "The Three Anchors' Tavern", "type": "...", "description": "..." }],
  "notableNPCs": [{ "name": "Temmel of the Endless Vigil", "role": "Divine Anchor of Redemption" }],
  "factions": [{ "name": "The Three Anchors", "influence": "Maximum", "activities": "..." }],
  "adventureHooks": ["Seek wisdom from the Three Anchors...", "Defend the Keep..."]
}
```

**ITEM**
```json
{
  "itemType": "Weapon (longsword)",
  "rarity": "rare",
  "requiresAttunement": true,
  "damage": "1d8 slashing + 1d4 necrotic",
  "tier": "standard",
  "properties": ["Magic Weapon: +1", "Withering Strike: DC 13 Con or Withered"],
  "curse": "After each combat, DC 12 Wis save or suffer dreams. Three failures → Withered stage."
}
```

**FACTION**
```json
{
  "headquarters": "Imperial Capital, Aurelion",
  "alignment": "Lawful Neutral",
  "goals": ["Maintain public belief...", "Suppress knowledge of stasis..."],
  "methods": "Propaganda, memory alteration, ritual performance",
  "keyMembers": [{ "name": "Emperor Aurelias", "role": "Public figurehead" }],
  "influenceScore": 7.5,
  "relations": [{ "faction": "Verdant Burden", "status": "Hostile" }]
}
```

**NPC / PC** — no structuredData required; all content in `content` (markdown). Role and faction surfaced from tags.

**RACE, LORE, TIMELINE, SPELL** — content in markdown; structuredData optional for timeline (array of dated events).

---

## Import Pipeline

### Script: `scripts/import-world-from-gdrive.ts`

**Source directory:** `G:\My Drive\Notebooks\Dungeons and Dragons\Campaigns\Tales from The Bonfire Keep - AI Edits\`

**File → WorldEntryType mapping:**

| File | Type | Split strategy |
|------|------|---------------|
| `Tales From The Bonfire Keep/Locations.md` | LOCATION | Split by H2 |
| `Tales From The Bonfire Keep/NPCs.md` | NPC | Split by H2 |
| `Tales From The Bonfire Keep/Monsters.md` | MONSTER | Split by H2 |
| `Tales From The Bonfire Keep/Items.md` | ITEM | Split by H2 |
| `Tales From The Bonfire Keep/Factions.md` | FACTION | Split by H2 |
| `Tales From The Bonfire Keep/Races.md` | RACE | Split by H2 |
| `Tales From The Bonfire Keep/Pregenitor Artifacts.md` | ITEM | Split by H2 (tier: 'artifact') |
| `Tales From The Bonfire Keep/The Twelve Witnesses.md` | FACTION | Single entry |
| `Tales From The Bonfire Keep/Systems.md` | LORE | Single entry |
| `The Solar Lie.md` | FACTION | Single entry |
| `The Tidal Adaptation.md` | FACTION | Single entry |
| `The Verdant Burden.md` | FACTION | Single entry |
| `Anchors and Heartflame.md` | LORE | Single entry |
| `Campaign Timeline.md` | TIMELINE | Single entry |
| `World Timeline.md` | TIMELINE | Single entry |
| `Player Characters/Norm Alfella.md` | PC | Single entry per file |
| `Player Characters/Oriyen Vale.md` | PC | Single entry per file |
| `Player Characters/Skreek Swicschnout.md` | PC | Single entry per file |
| `Adventures/*.md` | — | **Skip** (already in GameSession.prepData) |
| `Mid-Game Encounters.md` | — | **Skip** (session prep content) |
| `Mid-Game Hook.md` | — | **Skip** (session prep content) |

**Parser logic:**
1. Read file, extract YAML frontmatter → tags
2. Split by `## ` H2 headings → individual entities (or treat whole file as single entry)
3. Entity name = H2 heading text; slug = kebab-case name
4. Parse type-specific structuredData:
   - MONSTER: regex extract stat block tables (AC/HP/speed, ability score table, traits/actions sections)
   - LOCATION: extract Notable Locations, Notable NPCs, Factions, Adventure Opportunities tables
   - ITEM: extract Properties list, Curse section, item type/rarity from italic subtitle
   - FACTION: extract Goals, Key Members tables, influence level
5. Upsert WorldEntry (idempotent — safe to re-run)
6. After upsert, match by name against existing WorldEntity records → set `worldEntityId` FK

**Run:** `npx tsx scripts/import-world-from-gdrive.ts`

---

## Routes

```
/campaigns/[slug]/world                     — Entity browser (existing page, extended)
/campaigns/[slug]/world/[entrySlug]         — Entity detail page (new)
```

The existing `/world` page gains a **"World Entities" section at the top** — its own filter row (by type) and card grid that links through to detail pages. Below it, the existing CampaignDocument/HomebrewContent accordion remains as a "Source Documents" section. Clicking a WorldEntry card navigates to the detail page; it does not expand in-place. The detail page URL uses the entity slug (e.g., `/world/bonfire-keep`), not the cuid.

---

## Entity Detail Page Layout

**All types:** Two-column layout. Main content left, metadata sidebar right.

### Common shell (all types)
- Back link: `← World Lore`
- Type badge (color-coded per type)
- Entity name (Cinzel, large, amber)
- Tags row
- Two-column body (sidebar collapses to below on mobile)
- "Brain Insights" panel at bottom of sidebar (if `worldEntityId` set): session appearances, relationship summary, confidence score

### Type-specific main column

**LOCATION:** Description prose → Notable Sub-Locations table → Notable NPCs table → Factions Present table → Adventure Hooks list  
**Sidebar:** Key Info (population / government / defenses / commerce)

**MONSTER:** Ability score grid (6-box) → Stat row (AC / HP / Speed) → Traits list → Actions list → Reactions/Legendary (if any)  
**Sidebar:** Full stats panel (size/type/alignment/resistances/immunities/senses/CR/XP)

**NPC:** Role + faction badges → Description prose → Personality/Bond/Flaw table → DM Secrets (blurred, click to reveal)  
**Sidebar:** Quick Info (role / location / attitude)

**PC:** Similar to NPC without DM secrets; add class/race/level badges

**ITEM:** Rarity badge (colored: common/uncommon/rare/very rare/legendary/artifact) → Description prose → Properties list → Curse section (red left border)  
**Sidebar:** Item Info (type / damage / rarity / attunement)

**FACTION:** Description prose → Goals list → Key Members table  
**Sidebar:** Influence bar (0–10 score) + headquarters + alignment + Faction Relations (vs other factions: Hostile/Tense/Neutral/Allied)

**RACE / LORE / TIMELINE / SPELL:** Single-column markdown render (sidebar hidden or minimal). Timeline renders as a dated event list.

---

## tRPC Router

New router: `src/server/routers/world.ts`, registered in `src/server/routers/index.ts`.

```typescript
// Procedures
world.getEntries({ campaignId, type?, search?, limit?, cursor? })
world.getEntryBySlug({ campaignId, slug })
```

---

## What Stays Unchanged

- `CampaignDocument` table and `getWorldDocuments` query — existing world page accordion still works
- `HomebrewContent` and `getWorldHomebrew` — existing homebrew display unchanged
- `WorldEntity` (Brain) — AI inference pipeline unchanged; gains `worldEntryId` FK
- `ImportSheet` component — MD drag-drop import continues to write to CampaignDocument/HomebrewContent as before

WorldEntry is an additional layer, not a replacement.

---

## Implementation Order

1. Schema: add `WorldEntry` model + `WorldEntryType` enum + `worldEntityId` FK on `WorldEntity`
2. Run `prisma migrate dev`
3. Script: `scripts/import-world-from-gdrive.ts` — import all GDrive content
4. Router: `world.getEntries` + `world.getEntry` procedures
5. Detail page: `src/app/(app)/campaigns/[slug]/world/[entryId]/page.tsx` + type-specific layout components
6. Browser page: extend existing `/world` page to include WorldEntry records in the entity list
