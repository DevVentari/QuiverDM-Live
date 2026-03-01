# Create Pages Redesign — Design Doc
_2026-03-02_

## Problem

The three main create pages (Campaign, NPC, Character) are plain utility forms that predate the current design language. They use a single card inside `max-w-2xl`, have no visual identity, no ambient atmosphere, and don't reflect the amber/glass/fantasy aesthetic of the rest of the app.

## Goal

Redesign all three create pages to use a **live-preview split layout** that matches the current design system and gives DMs a real-time preview of what they're creating.

## Scope

- `src/app/(app)/campaigns/new/page.tsx`
- `src/app/(app)/campaigns/[slug]/npcs/new/page.tsx`
- `src/app/(app)/characters/new/page.tsx`

No backend changes. No new tRPC procedures. No schema changes.

---

## Layout Shell (shared)

```
max-w-5xl mx-auto
├── Page header (label-overline + font-cinzel title)
└── flex gap-8 items-start
    ├── Left: sticky preview panel (w-[40%], top-6)
    └── Right: form panel (flex-1)
```

Both panels use `glass-panel glass-grain rounded-xl p-6`.

---

## Left Panel — Live Preview

Pixel-identical to the entity's list card, fed live from form state via React state. The same card component used in the listing is reused here (or a thin wrapper thereof).

### Campaign Preview
- `h-24` gradient banner (`from-stone-900 via-amber-950/20 to-stone-900`)
- Campaign name in `font-cinzel` (or placeholder text if empty)
- `Draft` status badge
- Description snippet (or "No description" muted)
- `0 sessions · 0 NPCs` stat pills

### NPC Preview
- Image upload drop zone **is** the `h-24` banner
  - Click or drag-and-drop to upload
  - Shows uploaded image or gradient fallback
  - Upload progress indicator overlaid on the banner
- NPC name (or placeholder)
- Faction badge (or hidden if empty)
- Description snippet (or "No description")

### Character Preview
- Portrait upload drop zone **is** the `h-24` banner
  - Same click/drag-drop behaviour as NPC
- Character name in `font-cinzel` (or placeholder)
- `Race · Class · Level N` badge row
- Backstory snippet (first 80 chars)

### Empty State
When all fields are blank, the preview card shows:
- Gradient fallback banner
- Muted placeholder text for name: "Your Campaign / NPC / Character"
- Faint dashed border on the card

---

## Right Panel — Form

One `glass-panel glass-grain rounded-xl p-6` surface. Sections divided by `label-overline` + `section-rule` (no nested cards).

### Campaign Form
```
[CAMPAIGN IDENTITY]  ← label-overline + section-rule
  Name (required, full-width)
  Description (textarea, 4 rows)

[submit row]
  "Create Campaign" (amber primary)  |  "Cancel" (ghost)
```

### NPC Form
```
[IDENTITY]  ← label-overline + section-rule
  Name (required)  |  Faction  ← 2-col grid

[DETAILS]  ← label-overline + section-rule
  Description (textarea, 4 rows)

[DM ONLY]  ← label-overline (lock icon) + section-rule
  Secrets (textarea, 3 rows)
  Subtle amber/red tint on the overline to signal DM-private

[submit row]
  "Create NPC" (amber primary)  |  "Cancel" (ghost)
```

### Character Form
```
[IDENTITY]  ← label-overline + section-rule
  Name (required, full-width)
  Race  |  Class  ← 2-col grid
  Level (number stepper, 1–20)

[BACKGROUND]  ← label-overline + section-rule
  Background (text input, full-width)

[BACKSTORY]  ← label-overline + section-rule
  Backstory (textarea, 6 rows)

[submit row]
  "Create Character" (amber primary)  |  "Cancel" (ghost)
```

---

## Image Upload (NPC + Character)

The banner area in the preview card doubles as the upload zone:
- Renders `<label>` wrapping a hidden `<input type="file" accept="image/*">`
- Hover state: amber ring + "Upload image" overlay text
- Upload via existing `/api/upload/npc-image` route (NPC) and a new or existing route for characters
- Shows spinner overlay while uploading
- Error shown inline below the preview card (not a toast)

---

## Shared Component

Extract a `CreatePageShell` component:
```tsx
<CreatePageShell
  title="New Campaign"           // font-cinzel heading
  overline="Create"              // label-overline above title
  preview={<CampaignPreviewCard ... />}
>
  {/* form content */}
</CreatePageShell>
```

This ensures consistent layout across all three pages and any future create pages.

---

## Design Tokens Used

| Token | Usage |
|-------|-------|
| `glass-panel glass-grain` | Both panels |
| `font-display` | Page title, entity name in preview |
| `label-overline` | Section headers |
| `section-rule` | Amber line under section headers |
| `text-primary` / `bg-primary` | Submit button, focus rings |
| `from-stone-900 via-amber-950/20` | Default banner gradient |
| `text-muted-foreground` | Placeholder text in preview |

---

## Non-Goals

- No multi-step wizard (kept as single-page)
- No AI field suggestions at creation time
- No campaign image upload (can be added from the campaign settings page later)
- No ability score fields on character create (entered after creation on the character detail page)
