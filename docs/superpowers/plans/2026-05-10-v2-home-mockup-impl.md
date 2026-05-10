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

Sub-slices:
- D1: World Activity feed (recent WorldEntity/WorldEntry changes by `updatedAt`, with type-aware status: Added / Updated / Revamped)
- D2: Prep Reminders (likely derives from `GameSession.prepData` JSON or new `SessionPrepTodo` model)
- D3: ⌘K global search (Meili-backed, multi-entity)
- D4: Quick Add modal (entity-type picker → Sheet)
- D5: Randomizer (existing AI features, packaged as a modal)
- D6: Calendar (next-session view + scheduling)
- D7: DM Tools (existing tools surfaced — dice, initiative, etc.)

Each sub-slice is its own commit/session.

## Risks

- The hero image needs a sensible fallback when `Campaign.bannerUrl` is null. Slice A uses a gradient placeholder.
- Stub Cards must be visually distinguishable from "loading" states — they should clearly say "Coming soon".
- Slice C's utility buttons shouldn't ship as broken — they open a placeholder dialog explaining the feature is coming, not a `console.log`.
- Slice D's data dependencies may require schema additions (e.g., `SessionPrepTodo`); evaluate before committing to a model vs. a derivation.

## Reference

Mockup file: shared in conversation 2026-05-10 (cached at `~/.claude/image-cache/.../1.png` for this session only — re-share if a future session needs to look at it).
