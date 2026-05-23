# UI Consistency Audit — Design Spec

**Date:** 2026-05-23  
**Scope:** All app pages, sheets, dialogs, and admin surfaces  
**Approach:** Group fixes by type (hardcoded colors → headers → settings pages → dialogs → wrappers)

---

## Context

The QuiverDM design system has a well-defined token set (`--q-*` OKLCH tokens in `src/styles/tokens.css`) and a set of utility classes (`glass-panel`, `glass-grain`, `label-overline`, `section-rule`, `q-hero-glow`). Several reference-quality pages exist (NPCs, World, Encounters, Sessions, Quests) but a significant portion of the app was built before the design system matured and still uses hardcoded Tailwind colors, missing page headers, or no design token application at all.

The audit covered 36 surfaces. Results: 14 well-styled, 15 partially styled, 7 need work.

---

## Design System Reference

### Page header pattern (canonical)
```tsx
<p className="label-overline">Campaign</p>
<div className="section-rule" />
<h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)]">
  Page Title
</h1>
```

### Color token mapping for status/type/difficulty
Replace hardcoded Tailwind color classes with semantic q-tokens:

| Concept | Old (hardcoded) | New (q-token) |
|---------|----------------|---------------|
| Success/alive | `text-emerald-400`, `green-500` | `var(--q-accent-success)` / `var(--q-accent-success-border)` / `var(--q-accent-success-trace)` |
| Warning/caution | `text-yellow-400`, `yellow-500` | `var(--q-accent-quest)` / `var(--q-accent-quest-border)` / `var(--q-accent-quest-trace)` |
| Danger/dead | `text-red-400`, `red-500` | `var(--q-accent-danger)` / `var(--q-accent-danger-border)` / `var(--q-accent-danger-trace)` |
| Neutral/unknown | `text-gray-400`, `gray-500` | `var(--q-accent-neutral)` / `var(--q-accent-neutral-border)` |
| Info/highlight | `text-blue-400` | `var(--q-text-info)` |
| Arcane/special | `text-purple-400` | `var(--q-accent-arcane)` / `var(--q-accent-arcane-border)` |

### Inline HSL → q-token mapping
`hsl(var(--primary))` → `var(--q-accent-primary)`  
`hsl(var(--muted-foreground))` → `var(--q-text-dim)`  
`hsl(var(--border))` → `var(--q-border)`

### Sheet interior pattern (canonical — NPC create sheet)
```tsx
<div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
  <div>
    <p className="label-overline mb-1">Section Name</p>
    <div className="section-rule" />
  </div>
  {/* form fields */}
</div>
```

---

## Audit Results

### Well-styled (no action needed)
- `/campaigns/[slug]/npcs` — full pattern, filter rail, card grid, sheets
- `/campaigns/[slug]/world` — comprehensive q-token + utility class usage
- `/campaigns/[slug]/encounters` — BentoCanvas, consistent q-tokens
- `/campaigns/[slug]/sessions` — SplitCanvas, proper structure
- `/campaigns/[slug]/quests` — full overline + h1 pattern
- `/campaigns/[slug]/members` — well-styled
- `/campaigns/[slug]/mechanics` — q-tokens, amber accent
- `/homebrew` (top-level) — well-styled
- `/settings` (shell header) — amber gradient hero
- `/settings/ddb` — q-tokens, overline + h1
- `/settings/api-usage` — q-tokens, overline + h1
- `/admin` and most admin sub-pages — consistent stone-card pattern
- `campaign-create-sheet` — reference quality, animations
- `npc-create-sheet` — glass-panel, section-rule, label-overline
- `confirm-dialog` — clean shadcn, no issues

---

## Fix Plan

### Group 1 — Hardcoded colors → q-tokens
**~5 files, ~30 min. Pure mechanical token swap, no layout changes.**

| File | What to fix |
|------|-------------|
| `components/encounter/load-encounter-plan-dialog.tsx` | `DIFFICULTY_COLORS` object: green/yellow/red/orange Tailwind → `--q-accent-success/quest/danger` |
| `components/world/import-sheet.tsx` | `TYPE_META` color strings: emerald-400/blue-400/red-400 → `--q-accent-success/primary/danger` |
| `components/brain/entity-detail-sheet.tsx` | `STATUS_COLORS` + `TYPE_COLORS`: emerald/yellow/red → `--q-accent-*` tokens |
| `components/homebrew/import-from-ddb-dialog.tsx` | Emerald badge hardcodes → `--q-accent-success` |
| `components/session/ooc-review-sheet.tsx` | All `hsl()` inline values → equivalent q-tokens |

For each file: find all color class assignments, replace with the mapping table above. Do not change layout or structure.

### Group 2 — Missing page headers
**~8 pages, ~1 hr. Add the same 3-element header block to each.**

The standard block to add at the top of each page's content area:
```tsx
<div className="mb-6">
  <p className="label-overline mb-1">Campaign</p>  {/* or "Library", "Settings", etc. */}
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    Page Title
  </h1>
</div>
```

| File | Overline label | h1 text | Additional |
|------|---------------|---------|------------|
| `campaigns/[slug]/brain/page.tsx` | "Campaign" | "DM Brain" | Fix existing h2 → h1 |
| `campaigns/[slug]/brain/entities/page.tsx` | "DM Brain" | "Entities" | Add header block |
| `campaigns/[slug]/summaries/page.tsx` | "Campaign" | "Session Summaries" | Add header block |
| `campaigns/[slug]/players/page.tsx` | "Campaign" | "Players" | Add header block |
| `characters/page.tsx` | "Library" | "Characters" | Add header + switch stone-card → `Card` primitive |
| `homebrew/[homebrewId]/page.tsx` | "Homebrew" | Content title | Add header block |
| `settings/account/page.tsx` | "Settings" | "Account" | Add header block |
| `admin/rules-sources/page.tsx` | "Admin" | "Rules Sources" | Add header + add `var(--q-text-dim)` to stat labels |

### Group 3 — Bare settings sub-pages
**~4 pages, ~1.5 hr. Apply full q-token + card treatment to match `settings/ddb` as reference.**

Reference file: `src/app/(app)/settings/ddb/page.tsx` (well-styled, use as template).

Pages to fix:
- `settings/profile/page.tsx`
- `settings/ai/page.tsx`
- `settings/appearance/page.tsx`
- `settings/integrations/page.tsx`

Pattern for each page:
```tsx
<div className="space-y-6">
  <div>
    <p className="label-overline mb-1">Settings</p>
    <div className="section-rule" />
    <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
      {Page Title}
    </h1>
  </div>
  <div className="glass-panel glass-grain rounded-xl p-6 space-y-4">
    {/* existing form content, swap generic classes for q-tokens */}
  </div>
</div>
```

Do not redesign the forms — only add the header and wrap existing content in a glass-panel card.

### Group 4 — Unthemed dialogs and sheets
**~3 components, ~1.5 hr. Bring to NPC create sheet standard.**

Reference: `src/components/npc/npc-create-sheet.tsx`.

| File | What to add |
|------|-------------|
| `components/homebrew/create-homebrew-dialog.tsx` | Wrap form sections in `glass-panel glass-grain`, add `label-overline` section labels, replace generic colors with q-tokens |
| `components/homebrew/edit-homebrew-dialog.tsx` | Match create-dialog — same glass-panel + q-token treatment |
| `components/mechanics/mechanic-create-sheet.tsx` | Add glass-panel wrapper for form body, add `label-overline` to section headings |

Constraint: dialog `max-w` and overall structure must not change — only interior theming.

### Group 5 — Wrapper / iframe pages
**~2 pages, ~45 min. Add branded loading + error states.**

| File | What to add |
|------|-------------|
| `campaigns/[slug]/sourcebook/page.tsx` | Skeleton loading state with q-token colors; error state using `Card variant="detail"` with destructive styling |
| `campaigns/[slug]/foundry/page.tsx` | Styled iframe container: header bar with `label-overline` + title, `var(--q-bg)` background, loading indicator |

---

## Implementation Constraints

- Do not redesign any page — fixes are additive or token-replacement only
- Do not change component APIs, props, or data fetching
- Do not add new utility classes to `globals.css` — use existing ones
- Glass-panel inside a Sheet must not double up (SheetContent already has a background) — apply `glass-panel` to inner form sections, not the sheet wrapper itself
- After any change to a settings sub-page, verify the settings shell's nav still highlights correctly
- The `stone-card` CSS class is a legacy alias for the Card primitive — prefer `<Card variant="feature">` from `src/components/primitives/Card.tsx` over raw `stone-card` classnames going forward

---

## Definition of Done

Each group is done when:
- No hardcoded Tailwind color classes remain in the target files (grep for `green-`, `emerald-`, `yellow-`, `red-`, `blue-` in the affected files)
- Every page in scope has an overline label + h1 matching the canonical pattern
- Light mode (`html.light`) is not broken — q-tokens automatically adapt, but verify visually
- No TypeScript errors introduced
