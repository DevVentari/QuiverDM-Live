# V2 Home Mockup Implementation Plan

> Status: in progress (Slice A landing today)
> Source artifact: high-fidelity desktop home mockup ("The Shattered Spire" / Stonewardens campaign), shared 2026-05-10

## Goal

Adopt the desktop home mockup as the visual + layout direction for the entire authenticated app. The mockup shifts the home page from a single-column hero into a 3-column desktop layout with a richly atmospheric hero card, active campaign summary, world activity feed, and prep reminders. Top bar and left rail also gain density and utility.

## Architecture

- 3-column grid on desktop home: `grid-cols-12 gap-6` with main `col-span-8` and side `col-span-4` at `lg`+
- Hero card: text-on-left + atmospheric image-on-right with gradient mask
- Card primitive does not change; image bleed handled by overriding `!p-0` on the hero Card and using a 2-column inner grid
- World Activity and Prep Reminders ship as stub Cards in Slice A; real data wires in Slice D
- CommandRail widens and gains nav items + collapse toggle in Slice B
- CommandBar gains search, four utility buttons, theme toggle, notifications, restyled avatar in Slice C
- ⌘K global search and the four utility-button features are Slice D

No PageLayout on home — the hero card IS the header.

## Tech stack

Next.js 15, React, Tailwind, shadcn/ui, V2 primitives (Surface/Card/Section/Canvas/Pill/Summon), Lucide icons, Next Image for the hero banner.

## Slices

### Slice A — Home layout + Hero image + Active Campaign + Recent restyle (this session)

**Goal:** Visible direction match without depending on new backend data.

**Files**

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/app/(app)/page.tsx` | 3-column grid, compose home subcomponents |
| Create | `src/components/home/HomeHero.tsx` | Banner card with image, eyebrow, title, meta chips, CTAs |
| Create | `src/components/home/ActiveCampaignSummary.tsx` | Shield + ongoing date + level progress + 4 stat tiles + CTA |
| Create | `src/components/home/RecentSessionsList.tsx` | Numbered session list with title/date/hours/summary |
| Create | `src/components/home/WorldActivityStub.tsx` | "Coming soon" stub Card |
| Create | `src/components/home/PrepRemindersStub.tsx` | "Coming soon" stub Card |
| Modify | `tests/workflows/home.workflow.spec.ts` | Cover the new layout slots without breaking existing assertions |
| Modify | `tests/guardrails/v2-visual.test.ts` | Add the new home subcomponent files to the migrated-files set |

**Done when**

- Home renders the 3-column grid on desktop (single-column on mobile)
- Hero displays the campaign banner image (or graceful fallback when bannerUrl is null) with text/CTA on the left
- Active Campaign panel pulls real campaign data (sessionCount, etc.)
- Recent Sessions list is numbered + shows summary line
- World Activity + Prep Reminders render as "Coming soon" Cards in the side column
- Workflow specs + guardrail tests pass

### Slice B — CommandRail expansion + Collapse

**Goal:** Match the wider left rail with full nav surface and a Collapse toggle.

**Files**

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/components/shell/CommandRail.tsx` | Widen, add nav items, sublabel "V2", Collapse toggle |
| Modify | `src/store/header-store.ts` (or new) | Persist rail collapsed state |

**Nav items to add (per mockup):** Locations, Monsters, Items, Maps, Lore, Quests, Assets — most already have routes; verify or stub.

### Slice C — Top bar restructure

**Goal:** Search input + four utility buttons + theme + notifications + avatar.

**Files**

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/components/shell/CommandBar.tsx` | New layout: search · 4 buttons · theme · bell · avatar |
| Create | `src/components/shell/SearchTrigger.tsx` | ⌘K search input (opens placeholder dialog in Slice C; real in Slice D) |
| Create | `src/components/shell/QuickActionButtons.tsx` | Quick Add / Randomizer / Calendar / DM Tools (each wired to placeholder dialog) |
| Modify | `src/components/user-menu.tsx` | Restyle avatar |

### Slice D — Wire the data feeds

**Goal:** Replace stubs with real data; ship the four utility-button features and ⌘K global search.

**Decisions locked from the 2026-05-10 brainstorm:**
- Prep Reminders model = **option B** (derive from `GameSession.prepData` JSON, shape: `{ reminders: [{id, title, description, completed}] }`). Migration to a dedicated `SessionPrepReminder` table is reserved for a future slice once the feature proves out.
- World Activity statuses = **`Added` + `Updated` only** for the MVP. `Revamped` is dropped until there's a real derivation signal (manual flag, AI re-extraction, or content-diff heuristic).
- Sub-slice order = **D1 → D2 → D4 → D6 → D7 → D5 → D3** (activity feed → reminders → quick add → calendar → DM tools → randomizer → global search). Search lands last because it's the biggest plumbing effort.

**Sub-slice progress as of 2026-05-10:**

| ID | Status | Commit | Notes |
|----|--------|--------|-------|
| D1 | ✓ done | `eb7152f` | World Activity feed unions WorldEntity + NPC + WorldEntry; status from createdAt/updatedAt delta |
| D2 | ✓ done | `f19c1ba` | Prep Reminders read/write GameSession.prepData.reminders[] via existing updatePrep |
| D4 | ✓ done | `e0fdc06` | Quick Add Sheet — links to existing /new routes, scoped options gated on active campaign |
| D6 | ✓ done | `a27e114` | Calendar Sheet — derives upcoming sessions from getMyMemberships |
| D7 | ✓ done | `ca75910` | DM Tools Sheet — inline d20 + tool launcher cards |
| D5 | ✓ done | `d94fda9` | Randomizer Sheet — dice/oracle/coin/d100/names + AI NPC/Location/Hook generators |
| D3 | ⚠ TODO | — | ⌘K global search — see expanded plan below |

### Slice D3 — ⌘K global search (next-session pickup)

**Goal:** Replace `SearchTrigger.tsx`'s placeholder Dialog with a real global search modal backed by MeiliSearch federated multi-search.

**Existing assets:**
- `src/lib/search.ts` — Meili client init helper (already configured; we disabled startup init in dev via `ENABLE_SEARCH_STARTUP_INIT` flag — see `src/instrumentation.ts`)
- MeiliSearch service running on homelab LXC 206 at port 7700 (`MEILI_URL`, `MEILI_MASTER_KEY` in `.env.local`)
- `src/components/shell/SearchTrigger.tsx` — currently opens a placeholder Dialog with a "Coming in Slice D" message and ⌘K already wired

**Implementation phases:**

1. **Index design.** Per-type indexes (`campaigns`, `sessions`, `npcs`, `world_entities`, `world_entries`, `homebrew_content`). Each index has searchable fields (name/title/description/content), filterable fields (`campaignId`, `userId`, `type`), sortable `updatedAt`. Use Meili federated multi-search (`/multi-search`) to query all in one round-trip. Document the index settings as code in `src/lib/search.ts` so they're idempotent on init.

2. **Sync layer.** New BullMQ queue + worker for index jobs (`src/lib/queue/meili-sync-queue.ts` + `meili-sync-worker.ts`). Each create/update mutation in repositories enqueues an `{ kind, id }` job. The worker reads the entity from Postgres and upserts the Meili document. Deletions enqueue a delete job. Follow the existing worker pattern (see `quiverdm-worker` skill).

3. **Backfill script.** `scripts/backfill-meili.ts` — idempotent one-off that walks all relevant tables, batches into Meili (use `addDocuments` with primary key `id`). Must load `.env.local` first (per the ts-script env memory). Safe to re-run.

4. **Search API.** New `src/server/routers/search.ts` with a `global` procedure: `{ q: string, types?: string[], limit?: number }` → calls Meili multi-search filtered by user's accessible `campaignId`s. Authz: derive accessible campaigns via `campaignMember` join, pass as filter to Meili. Register in `_app.ts`.

5. **UI.** Replace the placeholder Dialog in `SearchTrigger.tsx` with a cmdk-style modal:
   - Add `cmdk` dep (`npm i cmdk` if not already present — it's the React component lib, separate from any CLI naming).
   - Modal lists results grouped by entity type with type icons (reuse the icons from `WorldActivityFeed`).
   - Recent searches in localStorage (last 5).
   - Click → navigate to entity (build href server-side or in the result transformer).
   - ⌘K already opens the modal; just swap content.

6. **Deploy.** Worker needs to land on homelab LXC 206 + Hetzner per the standard worker deploy. After pushing, SSH to homelab and run `bash /opt/quiverdm/deploy/homelab/deploy.sh`.

**Gotchas:**
- Meili indexes need to be created/configured before first writes — handle in `src/lib/search.ts` via `initSearchIndexes()` (already exists; extend it).
- Authz filter MUST scope to user's campaigns — never return entities from campaigns the user isn't a member of.
- Backfill against prod = expensive; gate with `--dry-run` flag default to dev DB unless explicitly pointed at prod.
- Federation across 6+ indexes can hit Meili rate limits at scale; consider per-type limits (`limit: 5` per index).
- For SearchTrigger UI: don't break the existing `data-testid="search-trigger"` or the ⌘K keyboard handler — both are in place from Slice C.

**Estimated effort:** 4–8 hours of focused work, likely 3 commits (sync infra, search router + backfill, UI).

## Risks

- The hero image needs a sensible fallback when `Campaign.bannerUrl` is null. Slice A uses a gradient placeholder.
- Stub Cards must be visually distinguishable from "loading" states — they should clearly say "Coming soon".
- Slice C's utility buttons shouldn't ship as broken — they open a placeholder dialog explaining the feature is coming, not a `console.log`.
- Slice D's data dependencies may require schema additions (e.g., `SessionPrepTodo`); evaluate before committing to a model vs. a derivation.

## Reference

Mockup file: shared in conversation 2026-05-10 (cached at `~/.claude/image-cache/.../1.png` for this session only — re-share if a future session needs to look at it).
