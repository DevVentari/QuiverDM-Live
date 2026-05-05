# Compendium Sidebar — Design Spec
**Date:** 2026-05-05
**Status:** Approved

## Overview

Replace the existing Homebrew nav tab and bottom Compendium panel with a unified compendium browser built into the sidebar. Every campaign content type (NPCs, Items, Locations, Spells, Monsters, Encounters) is browseable inline via expandable nav sections. A global search bar handles cross-type lookup. The right-side pin rail is extended from character-only to all content types, with drag-to-reorder.

---

## 1. Sidebar Structure

### Nav sections (after)

```
QUIVERDM [logo]

[search bar] ⌕ Search campaign...

CAMPAIGN
  Overview
  Sessions
  Summaries

WORLD
  NPCs          ›  (chevron = expand inline list)
  DM Brain         (no chevron — not a list)
  Encounters    ›

LIBRARY
  Items         ›
  Locations     ›
  Spells        ›
  Monsters      ›

[bottom icon row]
  Party  |  Members  |  ⚙ Settings
```

### What's removed
- Homebrew nav item (Items/Spells/Monsters/Locations replace it as individual sections under LIBRARY)
- Bottom "Compendium" panel button (BookOpen icon)

### What changes
- NPCs gains a chevron (label still navigates to NPCs list page)
- Encounters gains a chevron (label still navigates to Encounters list page)
- LIBRARY section retains its label but loses Homebrew, gains Items/Locations/Spells/Monsters

### What moves
- Characters page → "Party" icon in bottom row
- Members page → icon in bottom row
- Settings → icon in bottom row

### DDB sourcebook content
If sourcebook content has been imported to the campaign, it appears within the relevant type section (e.g. monsters from an imported sourcebook appear under Monsters). No separate "Sourcebooks" section — it merges by type.

---

## 2. Expandable Nav Sections

Each content-type nav item has two interaction zones:

| Interaction | Behaviour |
|---|---|
| Click label (e.g. "NPCs") | Navigate to the full list page for that type |
| Click chevron › | Toggle inline list expansion in sidebar |

### Expanded section anatomy

```
NPCs  17  ›              ← label (navigates) + count + chevron
  [⌕ Filter NPCs...]    ← search within type (client-side filter)
  ● Arveth the Cold  ⊞  ← row: click = navigate, ⊞ hover = open sheet
  ● Bryndra Holt
  ● Caldris Vane
  ● Dusk Warden
  + New NPC    +13 more →
```

### Row states
- **Default** — name + type icon, ⊞ hidden
- **Hover** — row background lightens, ⊞ appears
- **Active** (current page) — amber left border, ⊞ always visible
- **Pinned** — small 📌 indicator on right, no interaction

### Row interactions
- **Click row** → navigate to item's full detail page
- **Click ⊞** → open `CompendiumItemSheet` from right (no navigation)
- **Click label** (section header) → navigate to full list page for that type

### "+ New" button
Appears at the bottom of each expanded section. Only visible when the section is expanded. Routes:
- NPCs → existing NPC create sheet
- Items/Spells/Monsters/Locations → homebrew create flow for that type

### Count + "more" link
Shows total count next to chevron. Inline list shows first 8 items. "+ N more →" navigates to the full list page.

### Multiple sections open
Multiple sections can be expanded simultaneously. No accordion behaviour — all stay open independently.

---

## 3. Top Search Bar

- Positioned above the CAMPAIGN section, below the logo
- Searches across all campaign content types simultaneously
- Typing replaces the nav sections with a flat result list grouped by type
- Each result row: type icon + name + ⊞ view icon
- Click result → navigate to page; click ⊞ → open sheet
- Escape or clearing input → returns to normal nav view
- Does not search DDB sourcebook content by default (only campaign-linked content)

---

## 4. Pin Rail

Extends the existing `PinnedCharacterFlags` component to handle all content types.

### Store: `usePinnedItems`
Replaces `usePinnedCharacters`. Shape:

```ts
interface PinnedItem {
  id: string
  entityType: 'npc' | 'item' | 'location' | 'spell' | 'monster' | 'encounter'
  name: string
  iconUrl?: string   // portrait for NPCs, null for others
  order: number      // persists drag order
}
```

### Pin flag appearance
- Same tab-flag style as current character pins: rounded-left, attached to right viewport edge
- Width 44px, height 52px, `rounded-l-xl border-r-0`
- **NPC** — circular initial (portrait if available), amber tones
- **Item** — square badge, indigo tones, ⚔ icon
- **Location** — square badge, emerald tones, 🗺 icon
- **Spell** — square badge, violet tones, ✦ icon
- **Monster** — square badge, red tones, 💀 icon
- **Encounter** — square badge, orange tones, ⚡ icon

### Interactions
| State | Behaviour |
|---|---|
| Click pin (not current page) | Open `CompendiumItemSheet` |
| Click pin (current page) | Unpin — no sheet needed |
| Hover | Name tooltip slides left + ✕ unpin button appears top-left |
| Drag handle (two dots) | Drag vertically to reorder; persists to `order` field |

### Drag-to-reorder
Implemented with `@dnd-kit/core` + `@dnd-kit/sortable`. Order persists in Zustand store (session-only, not server-persisted in v1).

---

## 5. CompendiumItemSheet

One shared component opened by ⊞ icon or pin click.

```tsx
<CompendiumItemSheet entityType="npc" entityId="..." />
```

**Props:** `entityType`, `entityId`. Fetches its own data via tRPC.

**Width:** 420px. Uses existing shadcn `Sheet side="right"`.

### Header (all types)
- Entity icon/initial + name + type+subtype line
- **Pin toggle** — "Pin" outline when unpinned, "📌 Pinned" amber fill when pinned; clicking pinned state unpins and closes sheet
- **"Open →"** button — navigates to full detail page
- Close ✕

### Content blocks by type

| Type | Content |
|---|---|
| NPC | HP · AC · Prof · Speed grid · ability scores · description · tags |
| Item | Type · rarity · attunement · description · properties |
| Location | Region · description · notable features |
| Spell | Level · school · casting time · range · description |
| Monster | CR · type · HP/AC · description · key traits |
| Encounter | Difficulty · XP · creature list · notes |

---

## 6. What Gets Removed

| Component / Route | Fate |
|---|---|
| `src/app/(app)/campaigns/[slug]/homebrew/page.tsx` | Deleted. Homebrew content is now browsed via type sections (Items, Spells, etc.) |
| Homebrew sidebar nav item | Removed |
| Bottom Compendium panel (`src/components/compendium/`) | Removed. Content types fold into respective sidebar sections |
| `useCompendiumStore` (open/close panel state) | Removed |
| `CharacterSheetDrawer` (if only used by pin rail) | Replaced by `CompendiumItemSheet` |
| `usePinnedCharacters` store | Replaced by `usePinnedItems` |

---

## 7. Out of Scope (this spec)

- SRD seeding at campaign creation
- Full compendium page route (`/compendium`) for bulk browse/filter
- Server-persisted pin order (v1 is session-only via Zustand)
- Collapsed sidebar behaviour for the expandable sections
