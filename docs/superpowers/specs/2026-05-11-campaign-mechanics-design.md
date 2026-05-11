# Campaign Mechanics + Compendium Sync Extension Design

**Status:** approved 2026-05-11
**Source:** sidebar audit follow-up. RotFM has 17 character secrets, CoS has the 14-card Tarokka deck; neither has a home in the current schema. Separately, the DDB sync pipeline only writes `item` and `creature` rows into `HomebrewContent` — Spells and Feats are missing.

## Goal

Two outcomes from one plan:

1. **Give sourcebook-specific gameplay aids a proper home.** A new `CampaignMechanic` model stores RotFM secrets, CoS Tarokka cards, and (later) trinket tables, hag boons, encounter tables, hauntings, etc. Each row has a stable `externalKey` so re-syncing a sourcebook upserts cleanly instead of duplicating.
2. **Close the Compendium content gap.** Extend the DDB chapter extraction pipeline to also import Spells and Feats into `HomebrewContent`, so the Compendium's Spells and Feats filter tabs stop returning empty.

These two outcomes share one plan because the architectural split they establish (generic D&D rules content → `HomebrewContent` / Compendium; campaign-unique gameplay aids → `CampaignMechanic` / Mechanics page) is the deciding factor for both.

## Non-goals

- Auto-extracting mechanics (secrets, tarot, trinkets) from arbitrary sourcebook chapters. RotFM secrets and CoS Tarokka are seeded by hand-fed scripts in MVP. Auto-extraction lands in a follow-up plan once the schema is proven.
- Importing Races, Backgrounds, Classes, Subclasses from DDB. Out of scope; the Compendium tabs for those stay empty until a future plan.
- Player-facing mechanic UX (e.g., a player-only "Your Secret" card on a character sheet). MVP exposes mechanics only on the DM-facing Mechanics page; per-character display surfaces are deferred.
- Removing or restructuring `WorldEntity.type='SECRET'` rows. The `SECRET` enum value stays for general-purpose campaign secrets that aren't tied to a sourcebook mechanic.

## Architecture

### Two-table content split

| Concept | Storage | Examples |
|---|---|---|
| Generic D&D rules content (browsable in the Compendium) | `HomebrewContent` (existing) | Items, spells, feats, monsters/creatures, classes |
| Campaign-unique gameplay aids (browsable on the Mechanics page) | `CampaignMechanic` (new) | RotFM character secrets, CoS Tarokka cards, hags' trinkets, encounter tables, hauntings |

The split is mechanical: if it could appear in any campaign's library, it's `HomebrewContent`. If it only makes sense inside a specific sourcebook's framing and is consumed during play (drawn, assigned to a PC, revealed at a moment), it's a `CampaignMechanic`.

### `CampaignMechanic` schema

```prisma
model CampaignMechanic {
  id          String   @id @default(cuid())
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  kind        String   // open string. MVP recognises 'secret' and 'tarot'.
  sourcebook  String?  // 'rotfm' | 'cos' | 'lmop' | 'phb' | null for DM-created
  externalKey String?  // stable id from source ('rotfm.secret.7'); null for DM-created entries

  name        String
  description String?  @db.Text
  content     Json     // shape per kind — see "Content schemas" below

  assignedToCharacterId String?
  assignedToCharacter   CampaignCharacter? @relation(fields: [assignedToCharacterId], references: [id], onDelete: SetNull)
  revealedAtSessionId   String?
  playerVisible         Boolean @default(false)

  ddbChapterId String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([campaignId, kind, externalKey])
  @@index([campaignId, kind])
  @@index([sourcebook, kind])
  @@index([assignedToCharacterId])
}
```

Reverse relations on `Campaign` and `CampaignCharacter` are added (e.g., `mechanics CampaignMechanic[]`, `assignedMechanics CampaignMechanic[] @relation("AssignedMechanics")`).

### Content schemas (per kind)

These are TypeScript types layered over the `Json` field. Validated with Zod in the router.

```ts
// kind: 'secret'
interface SecretContent {
  flavorText: string                  // PC-facing setup ("You were once a Reghed warrior...")
  hiddenTruth: string                 // DM-only reveal ("...and you betrayed your tribe")
  mechanicalEffect?: string           // optional gameplay rule
}

// kind: 'tarot'
type TarokkaSuit = 'high' | 'swords' | 'stars' | 'glyphs' | 'coins'
type TarokkaPosition =
  | 'history'              // sets the campaign's past
  | 'ally'                 // identifies a friendly NPC
  | 'enemy'                // identifies a foe
  | 'item'                 // identifies a key item
  | 'final-battle-location'

interface TarotContent {
  cardName: string                    // 'The Tower'
  suit: TarokkaSuit
  artUrl?: string
  divinationPosition: TarokkaPosition
  interpretation: string              // the campaign-specific meaning chosen by the DM during fortune-telling
}
```

`kind` stays an open string in the database. Adding `'trinket'`, `'haunt'`, `'roll_table'` later is purely additive — define a new `TS` content type, add a new card detail view, no migration needed.

### `externalKey` strategy

The reliable-identification answer.

- For sourcebook-imported mechanics, the seed/sync writes a stable string: `rotfm.secret.7`, `cos.tarokka.tower-divination-final-battle`, `lmop.glasstaff-secret-history`.
- For DM-created mechanics, `externalKey` is `null`.
- The `@@unique([campaignId, kind, externalKey])` constraint means: re-running the seed upserts existing rows by `externalKey` (preserves `assignedToCharacterId`, `revealedAtSessionId`, any DM edits to interpretation text). DM-created mechanics without an `externalKey` are identified by `(campaignId, kind, name)` instead — enforced in application code (Prisma can't express a partial unique constraint cleanly across nullable columns).

### tRPC surface

New router: `src/server/routers/campaignMechanics.ts`, mounted at `mechanics`.

```ts
- list({ campaignId, kind?, sourcebook? }) → CampaignMechanic[]
   // campaignMemberProcedure. Strips content.hiddenTruth for non-DM
   // unless playerVisible AND assignedToCharacterId belongs to the caller.

- getById({ id }) → CampaignMechanic
   // Same authz. Returns 404 if mechanic doesn't exist or caller can't access the campaign.

- create({ campaignId, kind, name, sourcebook?, externalKey?, content, playerVisible? }) → CampaignMechanic
   // campaignDMProcedure. content is Zod-validated against the kind's schema.

- update({ id, name?, content?, playerVisible? })
   // campaignDMProcedure.

- delete({ id })
   // campaignDMProcedure.

- assignToCharacter({ id, characterId | null })
   // campaignDMProcedure. SetNull on character delete via FK already.

- markRevealed({ id, sessionId })
   // campaignDMProcedure. Sets revealedAtSessionId and flips playerVisible=true.
```

The `content.hiddenTruth` strip happens in the service layer before returning to the client — `secretContent.hiddenTruth` becomes `undefined` for non-DM, non-owning-player viewers. Zod schemas for the procedure outputs include `hiddenTruth: z.string().optional()` to reflect this.

### UI — `/campaigns/[slug]/mechanics`

Reuses the layout pattern from NPCs and Compendium (committed in `5decdd4` and refined in `fc666a7`).

- **Page shell:** `mx-auto max-w-[1600px] px-6 py-6`, `grid lg:grid-cols-[240px_minmax(0,1fr)] gap-6`
- **Header:** overline `CAMPAIGN`, title `Mechanics`, count tile (`{filtered} OF {total}`)
- **Filter rail (240px left):**
  - Search input (filters by `name` + `content.flavorText`)
  - Kind chips: `All` / `Secrets` (count) / `Tarokka` (count). Each chip's count shows current campaign's total of that kind.
  - Sourcebook chips: dynamic list of distinct `sourcebook` values present in the campaign.
  - `+ New Mechanic` button (DM only). Opens a Sheet with kind selector and content fields.
- **Card grid (right):** `EntityCard` reused — image fallback per kind (`Eye` icon for secret, `Sparkles` for tarot), name as title, source pill (`ROTFM` / `COS` / `DM`), 3-line description from `description` or `content.flavorText`. Assigned mechanics show a small character avatar/initial in the badge area.
- **Inspector Sheet (right-side, opens on card click):** displays full content per kind. DM sees `hiddenTruth`. `Assign to character` dropdown selects from campaign's PCs. `Reveal in session` button promotes `playerVisible` and stamps `revealedAtSessionId`.

### Sidebar entry

Add to `src/components/shell/CommandRail.tsx`:

```ts
{ id: 'mechanics', label: 'Mechanics', icon: Sparkles, scopedPath: '/mechanics', fallbackHref: '/campaigns' }
```

Placement: after `Quests`. Sidebar grows from 8 → 9 items. Still within the strip target (under 12). If sidebar bloat becomes an issue later, fold Quests + Mechanics into a single `Tools` accordion item — out of scope for this plan.

### DDB sync extension — Spells + Feats

Two extractors land in `src/lib/ai/homebrew-extraction.ts` (or wherever spell-and-feat-shaped prompts naturally live in the existing extraction module — confirm at implementation time):

```ts
extractSpellsFromChapter(chapterMarkdown: string): Promise<SpellExtract[]>
extractFeatsFromChapter(chapterMarkdown: string): Promise<FeatExtract[]>

interface SpellExtract {
  name: string
  level: number          // 0-9
  school: string         // 'evocation' | 'illusion' | ...
  castingTime: string
  range: string
  components: string
  duration: string
  description: string
  higherLevels?: string
  classes?: string[]
}

interface FeatExtract {
  name: string
  prerequisite?: string
  description: string
  benefits: string[]
}
```

The `ddb-chapter-extract-worker` currently calls the item and creature extractors per chapter; it learns to also call the spell and feat extractors. Each returns an array; the worker filters by `name`, deduplicates against existing `HomebrewContent` rows for the same `sourceType`, and upserts.

`HomebrewContent.type` accepts `'spell'` and `'feat'` already (the Compendium filter chips reference them — they just have no data). No schema migration on `HomebrewContent` is needed.

### Mechanics seed scripts (MVP content)

Two idempotent scripts:

- `scripts/seed-mechanics-rotfm.ts` — upserts 17 RotFM secrets keyed `rotfm.secret.{1..17}`. Source: the RotFM book's "Secrets and Hooks" appendix (DM provides content; script holds it as a const array).
- `scripts/seed-mechanics-cos.ts` — upserts 14 Tarokka cards × 5 divination positions = 70 rows keyed `cos.tarokka.{card-slug}.{position}` for the canonical CoS Tarokka deck. Each row carries the card image URL + the divination interpretation text from the book.

Both follow the `dotenv.config({ path: '.env.local', override: true })` pattern. Targeted at a `--campaign-slug=X` CLI arg so they're reusable across campaigns.

## Tech stack

Next.js 15, tRPC v11, Prisma + PostgreSQL, Zod, BullMQ (for the extended DDB extraction worker), Tailwind + shadcn/ui + Lucide icons, the V2 primitives (`EntityCard`, `Sheet`).

## Test plan

- **Workflow spec** `tests/workflows/mechanics.workflow.spec.ts`:
  - DM lists secrets on `/campaigns/[slug]/mechanics?kind=secret`, expects 17 cards for the RotFM-seeded campaign
  - DM clicks a secret card → Sheet opens → `hiddenTruth` visible
  - DM assigns the secret to a PC → refetch shows the badge
  - DM marks revealed in a session → `playerVisible` flips to true → URL navigates to `/sessions/[id]`
  - Player viewer signed in as the PC owner sees `flavorText` and `hiddenTruth` (because `playerVisible: true` AND `assignedToCharacterId` matches)
  - Player viewer not owning the PC sees flavor only, no hidden truth
- **Unit tests:**
  - `src/server/services/campaign-mechanics.service.test.ts` — `getById` strips `hiddenTruth` for non-DM, non-owner; preserves it for DM and assigned-PC owner with `playerVisible: true`
  - `src/lib/ai/__tests__/extract-spells.test.ts` — fixture chapter → expected `SpellExtract[]` (mocked LLM response)
  - `src/lib/ai/__tests__/extract-feats.test.ts` — same pattern for feats
- **Manual:** run both seed scripts against the local dev DB, verify Mechanics page renders, click a tarot card, assign it to a PC, confirm the assignment persists across reload.

## Risks

- **`externalKey` schema drift.** If the seed scripts evolve their key format (`rotfm.secret.7` → `rotfm.character-secret.7`), re-runs will create duplicates instead of upserting. Mitigation: pin the key format in the spec's Appendix and treat it as a versioned contract; if we ever change it, ship a migration that maps old → new keys.
- **DDB extractor cost.** Adding two more LLM extractors per chapter doubles the cost of sourcebook ingestion. Mitigation: run extractors in parallel within the worker so wall-clock time stays flat; budget impact is acceptable given user-initiated sync (not bulk auto-extraction).
- **Content drift between sourcebook print and DDB.** If the official RotFM secret #7 text changes after we seed, our seed will overwrite local DM edits unless we add an `dmEdited` flag. Deferred — not an MVP concern.
- **Tarokka card count explosion.** 14 cards × 5 positions = 70 mechanic rows per CoS campaign. The Mechanics page may need pagination earlier than expected. Mitigation: kind-level pagination is trivial to add to the list procedure if it becomes a problem; defer until measured.
- **Player visibility leakage.** Strip-down logic in the service has to be airtight. Mitigation: unit tests cover the strip layer explicitly; the inspector Sheet renders `content.hiddenTruth ?? ''` so a strip-failure shows blank rather than leaking.
- **Sidebar growth.** 9 items is fine; 10+ would warrant a "Tools" accordion folding Quests + Mechanics. Flagged for follow-up if we add another sidebar entry.

## Future scope

- Auto-extraction of mechanics from sourcebook chapters (DDB pipeline emits CampaignMechanic rows directly)
- Per-character display surface (the player sees "Your Secret" on their character sheet without going to the Mechanics page)
- Additional kinds: `trinket`, `haunt`, `roll_table`, `boon`, `harrowing`
- Roll-and-reveal helpers in the Tools sheet (e.g., "Draw a Tarokka card" → randomly picks an unrevealed card and reveals it)
- Cross-campaign mechanics library (DM templates that can be cloned into new campaigns)
- Extending the DDB sync to also import Races, Backgrounds, Classes, Subclasses into `HomebrewContent`
