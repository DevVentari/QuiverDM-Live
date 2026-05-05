# Hameria Ire Seed — Design Spec
*2026-05-05*

## Overview

Seed the QuiverDM database with a fully populated "Tales from the Bonfire Keep" campaign drawn from the Hameria Ire JSON source files in `docs/hameria-ire-jsons/`. Runs alongside the existing Lost Mines of Phandelver and Curse of Strahd demo campaigns. Introduces a new `CampaignDocument` Prisma model as the canonical home for world documentation (lore, factions, locations, timelines).

---

## 1. CampaignDocument Model

New Prisma model added to `prisma/schema.prisma`:

```prisma
model CampaignDocument {
  id         String   @id @default(cuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  title      String
  slug       String
  type       String    // 'lore' | 'faction' | 'location' | 'adventure' | 'timeline'
  content    String    @db.Text   // markdown body
  data       Json?                // structured metadata
  tags       String[]
  sourceFile String?              // origin path from JSON metadata
  order      Int      @default(0)

  // DM Brain ingestion
  brainIngestStatus String    @default("none") // none | pending | processing | done | error
  brainIngestAt     DateTime?

  searchText String   @db.Text

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([campaignId, slug])
  @@index([campaignId])
  @@index([campaignId, type])
}
```

`Campaign` model gets `documents CampaignDocument[]` added to its relations.

`Player` model gets `@@unique([campaignId, characterName])` added for seed idempotency. **Migration risk:** if any existing campaign already has two players with the same `characterName`, this migration will fail. Run `SELECT campaign_id, character_name, COUNT(*) FROM "Player" GROUP BY 1,2 HAVING COUNT(*) > 1;` before migrating on prod.

---

## 2. Seed Infrastructure

Current `prisma/seed.ts` (one monolithic file) is split into a modular structure:

```
prisma/
  seed.ts                    ← orchestrator only (~30 lines)
  seeds/
    users.ts                 ← createDemoUsers(), returns { dm, player }
    lost-mines.ts            ← existing campaign 1
    curse-of-strahd.ts       ← existing campaign 2
    hameria-ire.ts           ← new, reads docs/hameria-ire-jsons/
```

`seed.ts`:
```ts
import { seedUsers } from './seeds/users';
import { seedLostMines } from './seeds/lost-mines';
import { seedCurseOfStrahd } from './seeds/curse-of-strahd';
import { seedHameriaIre } from './seeds/hameria-ire';

async function main() {
  const { dm, player } = await seedUsers(prisma);
  await seedLostMines(prisma, dm.id);
  await seedCurseOfStrahd(prisma, dm.id);
  await seedHameriaIre(prisma, dm.id);
}
```

Each seed file exports a single `(prisma: PrismaClient, userId: string) => Promise<void>`. All operations are idempotent via upsert.

---

## 3. Hameria Ire Campaign Record

```ts
{
  name: 'Tales from the Bonfire Keep',
  slug: 'tales-from-the-bonfire-keep',
  description: 'A cosmic D&D campaign set in Hameria Ire — a world held in stasis by an ancient crime, on the edge of reckoning.',
  status: 'active',
  userId,
}
```

---

## 4. Data Mapping

### 4.1 NPCs → `NPC`

Source: `npcs_npcs.json` (`data` array)

| JSON field | Prisma field |
|-----------|-------------|
| `name` | `name` |
| `type_alignment` | `role` |
| `description` + `personality` | `description` |
| `mechanics` + `traits` + `actions` + `ability_scores` | `stats` (JSON, stored as-is) |
| metadata `tags` | `tags` |

Upsert key: `{ campaignId, name }`. Entries with empty `name` are skipped with `console.warn`.

### 4.2 Adventures → `GameSession`

Source: `adventures_*.json` (9 files)

| JSON field | Prisma field |
|-----------|-------------|
| `metadata.title` | `title` |
| `metadata.weight` | `sessionNumber` |
| `content` (full markdown) | `prepData.rawContent` |
| — | `status: "planning"` |

Upsert key: `{ campaignId, sessionNumber }`. Duplicate weight values have index appended.

### 4.3 Monsters → `HomebrewContent` type=`creature`

Source: `bestiary_monsters.json`

| JSON field | Prisma field |
|-----------|-------------|
| `name` | `name` |
| full entry | `data` |
| stripped markdown | `searchText` |
| — | `type: "creature"`, `sourceType: "manual"` |

### 4.4 Items → `HomebrewContent` type=`item`

Source: `mechanics_items.json` and `mechanics_pregenitor-artifacts.json`

Same mapping pattern as monsters with `type: "item"`.

### 4.5 Races → `HomebrewContent` type=`race`

Source: `mechanics_races.json`

Same mapping pattern with `type: "race"`.

### 4.6 World Documents → `CampaignDocument`

Sources: `world-lore_*.json`, individual `factions_*.json` files (5 files: `factions_factions.json`, `factions_solar-lie.json`, `factions_tidal-adaptation.json`, `factions_twelve-witnesses.json`, `factions_verdant-burden.json`), `Locations.json`

Note: use the individual `factions_*.json` files, not the combined `Factions.json`, to avoid duplicate document slugs.

| JSON field | Prisma field |
|-----------|-------------|
| `metadata.title` | `title` |
| slugified title | `slug` |
| JSON `type` (`lore`/`faction`/`location`) | `type` |
| `content` | `content` (empty string if absent) |
| `data` | `data` |
| `metadata.tags` | `tags` |
| `source` | `sourceFile` |
| stripped content + title + tags | `searchText` |
| — | `brainIngestStatus: "none"` |

Upsert key: `{ campaignId, slug }`.

### 4.7 Player Characters → `Player`

Source: `Player Characters_*.json` (3 files)

| JSON field | Prisma field |
|-----------|-------------|
| `metadata.title` (after `_`) | `characterName` |
| parsed from content | `characterRace`, `characterClass`, `level` |
| `content` | `backstory` |
| `"Demo Player"` | `name` |

Upsert key: `{ campaignId, characterName }`.

---

## 5. Idempotency & Edge Cases

- All records created via `upsert` — safe to re-run without duplicates
- Empty `name` entries → skipped with `console.warn`
- Missing `content` on documents → empty string
- `searchText` generated by stripping markdown syntax from `content`, joined with `title` and `tags`
- No images seeded (`imageUrl` left null)
- No embeddings generated (`brainIngestStatus: "none"`) — brain ingestion worker processes these on its normal cycle

---

## 6. Out of Scope

- UI for `CampaignDocument` (compendium surface — separate feature)
- tRPC router for `CampaignDocument` (separate feature)
- Embedding generation during seed
- Session notes from `Sessions_*.json` (one file only, not enough to warrant a separate mapper)

---

## 7. Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `CampaignDocument` model, `Campaign.documents` relation, `Player @@unique` |
| `prisma/migrations/` | New migration |
| `prisma/seed.ts` | Refactored to orchestrator |
| `prisma/seeds/users.ts` | Extracted from seed.ts |
| `prisma/seeds/lost-mines.ts` | Extracted from seed.ts |
| `prisma/seeds/curse-of-strahd.ts` | Extracted from seed.ts |
| `prisma/seeds/hameria-ire.ts` | New |
