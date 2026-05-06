# Desktop Layout Redesign

**Date:** 2026-05-07
**Scope:** All list-heavy pages — Sessions, Homebrew, Campaign Overview, Members, Dashboard, Campaigns List
**Goal:** Eliminate single-column list layouts that waste desktop width. Replace with structured two-column or bento layouts, unified by a rich atmospheric hero banner on every page.

---

## Reference: What Works

Settings (`src/components/settings/settings-shell.tsx`) is the design benchmark:
- Full-width atmospheric hero panel at top (gradient + radial glows + stat tiles on right)
- Two-column below: sticky left nav sidebar + scrollable right content

NPCs page (`src/app/(app)/campaigns/[slug]/npcs/page.tsx`) already has the correct below-hero pattern: master-detail with `grid-cols-[300px_1fr]`.

---

## 1. Shared — PageHero Component

**File:** `src/components/layout/page-layout.tsx` (modified in-place)

The thin rounded card header in `PageLayout` is replaced with a full atmospheric banner. All existing callers of `PageLayout` automatically get the upgrade.

### Props

```ts
interface PageLayoutProps {
  overline: string;
  title: string;
  subtitle?: string;
  stats?: Array<{ label: string; value: string | number; alert?: boolean }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
}
```

`maxWidth` prop is removed — pages handle their own content width via their grid structure.

### Visual spec

- Background: `linear-gradient(135deg, hsl(240 10% 10% / .92), hsl(240 12% 7% / .98))`
- Radial overlays: amber upper-left + purple upper-right (matching settings shell)
- Border: `border-amber-500/15`
- Left block: overline badge (amber pill) + display title + subtitle
- Right block: stat tiles row — each tile shows label / value / helper. Alert tiles use green border/text instead of amber.
- Actions row: right-aligned, below stat tiles on mobile, inline on desktop
- Padding: `p-5 sm:p-6`, rounded `1.25rem`

### Mobile collapse

Below `md`: stat tiles move below the title block, stacked. Actions remain right-aligned below the title row. No stat tiles hidden — just reflowed.

---

## 2. Per-Page Layouts

### 2a. Sessions (`/campaigns/[slug]/sessions`)

**Pattern:** Master-detail, full viewport height (`h-[calc(100vh-220px)]`), `-mx-8` bleed to fill shell width, matching NPCs.

**Stats for hero:** Total sessions · Completed · Active (alert=true if >0)

**Left column — 280px:**
- Filter pills at top (All / Planning / In Progress / Completed) with counts
- Scrollable session list: each row has session number bubble (circle with number) + title + status dot + feature pips (recording/transcript/summary icons)
- Selected row highlighted in amber

**Right column — flex 1:**
- When a session is selected: `SessionInspectorPanel` — title, status badge, date, prep status, quick notes, feature pip buttons (open recording, transcript, summary), link to full session page
- When nothing selected: empty state (same pattern as NPCs)

**New component:** `src/components/session/session-inspector-panel.tsx`

**Mobile:** List only. Tapping a session navigates to the session detail page (existing behavior).

---

### 2b. Homebrew (`/homebrew`)

**Pattern:** Left filter sidebar + right card grid.

**Stats for hero:** Total items · PDFs · (type breakdown as text in subtitle)

**Left column — 220px:**
- Section: **Type filters** — pill buttons (All / Items / Spells / Creatures / Classes / Feats) with counts. Active filter highlighted amber.
- Section: **Add content** — three action links: Create manually, Import from D&D Beyond, Upload PDF. These move the import/create triggers out of the header dropdown.
- Sticky, `lg:self-start`

**Right column — flex 1:**
- Search bar at top
- 3-col card grid (existing `HomebrewContentCard` components unchanged)
- Empty state unchanged

**Mobile:** Filter pills collapse to a horizontal scrolling pill row above the search bar (sidebar hidden).

---

### 2c. Campaign Overview (`/campaigns/[slug]`)

**Pattern:** Bento grid — no sidebar. Full width, mixed-size cells.

**Stats for hero:** Session count · Member count · Campaign age (e.g. "Active since Jan 2026")

**Layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`):**
- Row 1: `ContinueActionCard` — `col-span-full` (unchanged component)
- Row 2: Next upcoming session card (`col-span-1`) + World Pressure card (`col-span-1`) + Open Hooks card (`col-span-1` on lg, `col-span-full` on md)
- Open Hooks card uses `lg:col-span-1 md:col-span-2` so it fills the row on md viewports

**Mobile:** Single column stack, same order.

---

### 2d. Members (`/campaigns/[slug]/members`)

**Pattern:** Master-detail, matching Sessions layout.

**Stats for hero:** Member count · Roles breakdown (e.g. "1 DM · 3 players")

**Left column — 280px:**
- Header row: "Party (N)" label + Invite button
- Scrollable member list: avatar + name + role badge. Selected row highlighted.

**Right column — flex 1:**
- When a member is selected: member detail panel — avatar (larger), name, email, joined date, sessions attended, role editor (Select for DM, badge for owner), remove button
- When nothing selected: empty state with invite prompt

**New component:** `src/components/members/member-detail-panel.tsx`

**Mobile:** List only. Existing card rows with inline role selector remain (no sheet needed — members list is short and actions are simple).

---

### 2e. Dashboard (`/dashboard`)

**Pattern:** Left sidebar + right content.

**Stats for hero:** Campaign count · Total sessions · (no alert states needed)

**Left column — 260px, sticky:**
- Active campaign card (banner image + name + last played date) — link to campaign overview
- Summary stat tiles (campaigns count, sessions count)

**Right column — flex 1:**
- Pending invites section (if any) — existing accept/decline cards
- "Your Campaigns" heading + compact campaign list rows (name, session count, last played) — replaces the awkward horizontal carousel
- New Campaign button moved to hero actions

**Mobile:** Single column. Active campaign hero above campaigns list. Carousel removed entirely in favour of vertical list on all breakpoints.

---

### 2f. Campaigns List (`/campaigns`)

**Pattern:** Left sidebar + 2-col card grid.

**Stats for hero:** Total campaigns · Total sessions · Total members (across all campaigns)

**Left column — 200px, sticky:**
- Stat summary tiles (campaigns / sessions / members) — richer than the thin stat bar currently above the grid
- New Campaign CTA button (primary, full width)

**Right column — flex 1:**
- 2-col card grid (existing `campaign` cards, unchanged)
- Empty state unchanged

**Mobile:** Stats collapse to a single inline row. New Campaign button in hero actions. Grid goes 1-col.

---

## 3. Implementation Scope

**Files modified:**
- `src/components/layout/page-layout.tsx` — PageHero upgrade; `maxWidth` prop removed. All callers that pass `maxWidth` (campaigns page, homebrew page, dashboard page) must have that prop removed — it's a compile error if left in.
- `src/app/(app)/campaigns/[slug]/sessions/page.tsx`
- `src/app/(app)/homebrew/page.tsx`
- `src/app/(app)/campaigns/[slug]/page.tsx`
- `src/app/(app)/campaigns/[slug]/members/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/campaigns/page.tsx`

**New components:**
- `src/components/session/session-inspector-panel.tsx`
- `src/components/members/member-detail-panel.tsx`

**No changes to:**
- API / tRPC routers
- Prisma schema
- NPCs page (already correct)
- Session detail page, prep wizard, session live cockpit

**No new routes.** Mobile behavior is layout-only (CSS breakpoints), not new pages or sheets.

---

## 4. Success Criteria

- On a 1400px viewport, no page has a single stretched column of content with >50% empty space beside it
- Every page has the atmospheric PageHero with stat tiles
- Sessions, Members use master-detail matching the NPCs reference
- Homebrew, Campaigns List have a left sidebar with filters/actions
- Dashboard eliminates the horizontal carousel
- Campaign Overview uses a bento grid
- Mobile viewport: all pages render as single-column stacks with no horizontal overflow
