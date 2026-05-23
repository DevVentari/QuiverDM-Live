# UI Consistency Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified UI inconsistencies across 22 files — replacing hardcoded Tailwind colors with q-tokens, adding missing page headers, upgrading bare settings panels, and theming unstyled dialogs.

**Architecture:** Five groups executed in order: (1) mechanical color token swaps, (2) missing page header blocks, (3) settings panel upgrade, (4) dialog/sheet theming, (5) iframe wrapper polish. Each task is self-contained and produces a clean commit.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, CSS custom properties (`--q-*` tokens in `src/styles/tokens.css`), shadcn/ui, `src/components/primitives/` (Card, Surface, Section)

---

## Token Reference

All replacements use these CSS custom properties (defined in `src/styles/tokens.css`):

| Concept | CSS token (text) | CSS token (trace bg) | CSS token (border) |
|---------|-----------------|---------------------|-------------------|
| Success (green) | `var(--q-accent-success)` | `var(--q-accent-success-trace)` | `var(--q-accent-success-border)` |
| Warning/quest (yellow) | `var(--q-accent-quest)` | `var(--q-accent-quest-trace)` | `var(--q-accent-quest-border)` |
| Danger (red) | `var(--q-accent-danger)` | `var(--q-accent-danger-trace)` | `var(--q-accent-danger-border)` |
| Arcane (purple/violet/pink) | `var(--q-accent-arcane)` | `var(--q-accent-arcane-trace)` | `var(--q-accent-arcane-border)` |
| Primary (amber) | `var(--q-accent-primary)` | `var(--q-accent-primary-trace)` | `var(--q-accent-primary-border)` |
| Info (blue/sky/cyan) | `var(--q-text-info)` | `var(--q-accent-neutral-trace)` | `var(--q-accent-neutral-border)` |
| Surface (dark bg) | — | `var(--q-surface-sunken)` | `var(--q-border)` |
| Body text | `var(--q-text)` | — | — |
| Dim text | `var(--q-text-dim)` | — | — |

**Tailwind CSS-var syntax:** Use `text-[var(--q-accent-success)]`, `bg-[var(--q-accent-success-trace)]`, `border-[var(--q-accent-success-border)]`.

---

## Page Header Pattern (canonical)

Every campaign/library/settings page should start with this block inside its outermost content padding div, before any other content:

```tsx
<div className="mb-6">
  <p className="label-overline mb-1">Campaign</p>
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    Page Title
  </h1>
</div>
```

Replace `"Campaign"` and `"Page Title"` per the table in Task 3.

---

## Task 1: Hardcoded colors — encounter dialog and entity detail sheet

**Files:**
- Modify: `src/components/encounter/load-encounter-plan-dialog.tsx:17-22`
- Modify: `src/components/brain/entity-detail-sheet.tsx:32-75`

- [ ] **Step 1: Replace DIFFICULTY_COLORS in load-encounter-plan-dialog.tsx**

Open `src/components/encounter/load-encounter-plan-dialog.tsx`. Replace lines 17–22:

```tsx
// BEFORE
const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   'bg-green-500/10 text-green-600',
  medium: 'bg-yellow-500/10 text-yellow-600',
  hard:   'bg-orange-500/10 text-orange-600',
  deadly: 'bg-red-500/10 text-red-600',
};

// AFTER
const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   'bg-[var(--q-accent-success-trace)] text-[var(--q-accent-success)]',
  medium: 'bg-[var(--q-accent-quest-trace)] text-[var(--q-accent-quest)]',
  hard:   'bg-[var(--q-accent-quest-trace)] text-[var(--q-accent-quest)]',
  deadly: 'bg-[var(--q-accent-danger-trace)] text-[var(--q-accent-danger)]',
};
```

- [ ] **Step 2: Replace statusColors and typeColors in entity-detail-sheet.tsx**

Open `src/components/brain/entity-detail-sheet.tsx`. Replace lines 32–50:

```tsx
// BEFORE
const statusColors: Record<string, string> = {
  active: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  dormant: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  destroyed: 'text-red-400 border-red-400/30 bg-red-400/10',
  resolved: 'text-muted-foreground border-border bg-muted/20',
};

const typeColors: Record<string, string> = {
  NPC: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  PC: 'text-sky-400 border-sky-400/30 bg-sky-400/10',
  FACTION: 'text-violet-400 border-violet-400/30 bg-violet-400/10',
  LOCATION: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  THREAT: 'text-red-400 border-red-400/30 bg-red-400/10',
  ITEM: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  ARC: 'text-pink-400 border-pink-400/30 bg-pink-400/10',
  EVENT: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  SECRET: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
  CUSTOM: 'text-muted-foreground border-border bg-muted/20',
};

// AFTER
const statusColors: Record<string, string> = {
  active:    'text-[var(--q-accent-success)] border-[var(--q-accent-success-border)] bg-[var(--q-accent-success-trace)]',
  dormant:   'text-[var(--q-accent-quest)] border-[var(--q-accent-quest-border)] bg-[var(--q-accent-quest-trace)]',
  destroyed: 'text-[var(--q-accent-danger)] border-[var(--q-accent-danger-border)] bg-[var(--q-accent-danger-trace)]',
  resolved:  'text-muted-foreground border-border bg-muted/20',
};

const typeColors: Record<string, string> = {
  NPC:      'text-[var(--q-accent-primary)] border-[var(--q-accent-primary-border)] bg-[var(--q-accent-primary-trace)]',
  PC:       'text-[var(--q-text-info)] border-[var(--q-accent-neutral-border)] bg-[var(--q-accent-neutral-trace)]',
  FACTION:  'text-[var(--q-accent-arcane)] border-[var(--q-accent-arcane-border)] bg-[var(--q-accent-arcane-trace)]',
  LOCATION: 'text-[var(--q-accent-success)] border-[var(--q-accent-success-border)] bg-[var(--q-accent-success-trace)]',
  THREAT:   'text-[var(--q-accent-danger)] border-[var(--q-accent-danger-border)] bg-[var(--q-accent-danger-trace)]',
  ITEM:     'text-[var(--q-accent-quest)] border-[var(--q-accent-quest-border)] bg-[var(--q-accent-quest-trace)]',
  ARC:      'text-[var(--q-accent-arcane)] border-[var(--q-accent-arcane-border)] bg-[var(--q-accent-arcane-trace)]',
  EVENT:    'text-[var(--q-text-info)] border-[var(--q-accent-neutral-border)] bg-[var(--q-accent-neutral-trace)]',
  SECRET:   'text-[var(--q-accent-arcane)] border-[var(--q-accent-arcane-border)] bg-[var(--q-accent-arcane-trace)]',
  CUSTOM:   'text-muted-foreground border-border bg-muted/20',
};
```

- [ ] **Step 3: Replace ConfidenceBadge hardcoded classes in entity-detail-sheet.tsx**

In the same file, find the `ConfidenceBadge` function (around line 52). Replace the className assignments:

```tsx
// BEFORE
if (confidence >= 0.9) {
  label = 'Confirmed';
  className = 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
} else if (confidence >= 0.7) {
  label = 'Inferred';
  className = 'text-amber-500 border-amber-500/30 bg-amber-500/10';
} else {
  label = 'Uncertain';
  className = 'text-destructive border-destructive/30 bg-destructive/10';
}

// AFTER
if (confidence >= 0.9) {
  label = 'Confirmed';
  className = 'text-[var(--q-accent-success)] border-[var(--q-accent-success-border)] bg-[var(--q-accent-success-trace)]';
} else if (confidence >= 0.7) {
  label = 'Inferred';
  className = 'text-[var(--q-accent-primary)] border-[var(--q-accent-primary-border)] bg-[var(--q-accent-primary-trace)]';
} else {
  label = 'Uncertain';
  className = 'text-destructive border-destructive/30 bg-destructive/10';
}
```

- [ ] **Step 4: Verify no old color classes remain in these two files**

```bash
grep -n "emerald\|text-green\|text-yellow\|text-orange\|text-red\|text-blue\|text-purple\|text-violet\|text-sky\|text-pink" \
  src/components/encounter/load-encounter-plan-dialog.tsx \
  src/components/brain/entity-detail-sheet.tsx
```

Expected: no output (zero matches).

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/encounter/load-encounter-plan-dialog.tsx \
        src/components/brain/entity-detail-sheet.tsx
git commit -m "fix(ui): replace hardcoded colors with q-tokens in encounter dialog and entity sheet"
```

---

## Task 2: Hardcoded colors — world import sheet, OOC review sheet, homebrew DDB dialog

**Files:**
- Modify: `src/components/world/import-sheet.tsx:19-29`
- Modify: `src/components/session/ooc-review-sheet.tsx:75-83`
- Modify: `src/components/homebrew/import-from-ddb-dialog.tsx` (emerald badge instances)

- [ ] **Step 1: Replace TYPE_META color strings in import-sheet.tsx**

Open `src/components/world/import-sheet.tsx`. Replace lines 19–29:

```tsx
// BEFORE
const TYPE_META: Record<ExtractedEntityType, { label: string; icon: React.ElementType; color: string }> = {
  location: { label: 'Locations', icon: MapPin,      color: 'text-emerald-400/80' },
  npc:      { label: 'NPCs',      icon: UsersRound,  color: 'text-blue-400/80'    },
  item:     { label: 'Items',     icon: Package,     color: 'text-yellow-400/80'  },
  creature: { label: 'Creatures', icon: Skull,       color: 'text-red-400/80'     },
  faction:  { label: 'Factions',  icon: Flag,        color: 'text-purple-400/80'  },
  lore:     { label: 'Lore',      icon: ScrollText,  color: 'text-amber-400/80'   },
  timeline: { label: 'Timelines', icon: BookOpen,    color: 'text-violet-400/80'  },
  spell:    { label: 'Spells',    icon: Sparkles,    color: 'text-cyan-400/80'    },
  race:     { label: 'Races',     icon: Dna,         color: 'text-pink-400/80'    },
};

// AFTER
const TYPE_META: Record<ExtractedEntityType, { label: string; icon: React.ElementType; color: string }> = {
  location: { label: 'Locations', icon: MapPin,      color: 'text-[var(--q-accent-success)]' },
  npc:      { label: 'NPCs',      icon: UsersRound,  color: 'text-[var(--q-text-info)]'      },
  item:     { label: 'Items',     icon: Package,     color: 'text-[var(--q-accent-quest)]'   },
  creature: { label: 'Creatures', icon: Skull,       color: 'text-[var(--q-accent-danger)]'  },
  faction:  { label: 'Factions',  icon: Flag,        color: 'text-[var(--q-accent-arcane)]'  },
  lore:     { label: 'Lore',      icon: ScrollText,  color: 'text-[var(--q-accent-primary)]' },
  timeline: { label: 'Timelines', icon: BookOpen,    color: 'text-[var(--q-accent-arcane)]'  },
  spell:    { label: 'Spells',    icon: Sparkles,    color: 'text-[var(--q-text-info)]'      },
  race:     { label: 'Races',     icon: Dna,         color: 'text-[var(--q-accent-arcane)]'  },
};
```

- [ ] **Step 2: Replace inline style objects in ooc-review-sheet.tsx**

Open `src/components/session/ooc-review-sheet.tsx`. The item div at line 72 uses inline `style` props. Replace the entire item `<div>` from `<div key={item.index}` through the closing `</div>` of the inner container:

```tsx
// BEFORE — the item wrapper div (lines 72-79)
<div
  key={item.index}
  className="rounded-sm p-3 space-y-2 transition-opacity"
  style={{
    background: isDrop ? 'hsl(0 60% 15% / 0.3)' : 'hsl(240 10% 8% / 0.6)',
    border: `1px solid ${isDrop ? 'hsl(0 60% 35% / 0.3)' : 'hsl(35 35% 15%)'}`,
    opacity: isDrop ? 0.6 : 1,
  }}
>

// AFTER
<div
  key={item.index}
  className={cn(
    'rounded-sm p-3 space-y-2 transition-opacity border',
    isDrop
      ? 'bg-[var(--q-accent-danger-trace)] border-[var(--q-accent-danger-border)] opacity-60'
      : 'bg-[var(--q-surface-sunken)] border-[var(--q-border)] opacity-100',
  )}
>
```

Then replace the two inline `style={{ color: ... }}` props on the `<p>` at lines 81-83:

```tsx
// BEFORE
<p className="text-sm" style={{ color: 'hsl(35 15% 80%)' }}>
  <span style={{ color: 'hsl(35 80% 55%)' }}>[{item.start_formatted}] {item.speaker}:</span>{' '}

// AFTER
<p className="text-sm text-[var(--q-text)]">
  <span className="text-[var(--q-accent-primary)]">[{item.start_formatted}] {item.speaker}:</span>{' '}
```

Also update the SheetHeader border to use a q-token (line 59):

```tsx
// BEFORE
<SheetHeader className="pb-4 border-b border-border">

// AFTER
<SheetHeader className="pb-4 border-b border-[var(--q-border-subtle)]">
```

- [ ] **Step 3: Fix emerald hardcodes in import-from-ddb-dialog.tsx**

Open `src/components/homebrew/import-from-ddb-dialog.tsx`. Search for any `emerald` class instances:

```bash
grep -n "emerald" src/components/homebrew/import-from-ddb-dialog.tsx
```

For each match, replace with `q-accent-success` equivalents:
- `text-emerald-*` → `text-[var(--q-accent-success)]`
- `bg-emerald-*/10` → `bg-[var(--q-accent-success-trace)]`
- `border-emerald-*/30` → `border-[var(--q-accent-success-border)]`

- [ ] **Step 4: Verify no old color classes remain in these three files**

```bash
grep -n "emerald\|text-green\|text-yellow-4\|text-orange\|text-blue-4\|text-purple\|text-violet\|text-sky\|text-pink\|text-cyan\|hsl(0 60\|hsl(240 10\|hsl(35 15\|hsl(35 80" \
  src/components/world/import-sheet.tsx \
  src/components/session/ooc-review-sheet.tsx \
  src/components/homebrew/import-from-ddb-dialog.tsx
```

Expected: no output.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/world/import-sheet.tsx \
        src/components/session/ooc-review-sheet.tsx \
        src/components/homebrew/import-from-ddb-dialog.tsx
git commit -m "fix(ui): replace hardcoded colors with q-tokens in import sheet, OOC sheet, DDB dialog"
```

---

## Task 3: Missing page headers — campaign pages

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/brain/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/brain/entities/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/summaries/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/players/page.tsx`

For each file: find the outermost content wrapper div in the JSX return (the one with `px-*` and `py-*` padding, typically `className="mx-auto max-w-[...] px-6 py-6"`). Insert the header block as the first child.

- [ ] **Step 1: Add header to brain/page.tsx**

Find the return statement's outermost content div. Add at the top before any existing content:

```tsx
<div className="mb-6">
  <p className="label-overline mb-1">Campaign</p>
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    DM Brain
  </h1>
</div>
```

Also: find any `<h2` tag that serves as the page title and change it to `<h1` (or remove it if the new header block replaces it).

- [ ] **Step 2: Add header to brain/entities/page.tsx**

Find the outermost content div. Add at the top:

```tsx
<div className="mb-6">
  <p className="label-overline mb-1">DM Brain</p>
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    Entities
  </h1>
</div>
```

- [ ] **Step 3: Add header to summaries/page.tsx**

Find the outermost content div. Add at the top:

```tsx
<div className="mb-6">
  <p className="label-overline mb-1">Campaign</p>
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    Session Summaries
  </h1>
</div>
```

- [ ] **Step 4: Add header to players/page.tsx**

Find the outermost content div. Add at the top:

```tsx
<div className="mb-6">
  <p className="label-overline mb-1">Campaign</p>
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    Players
  </h1>
</div>
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/brain/page.tsx \
        src/app/\(app\)/campaigns/\[slug\]/brain/entities/page.tsx \
        src/app/\(app\)/campaigns/\[slug\]/summaries/page.tsx \
        src/app/\(app\)/campaigns/\[slug\]/players/page.tsx
git commit -m "fix(ui): add overline+h1 headers to brain, summaries, and players pages"
```

---

## Task 4: Missing page headers — library, homebrew detail, account, admin

**Files:**
- Modify: `src/app/(app)/characters/page.tsx`
- Modify: `src/app/(app)/homebrew/[homebrewId]/page.tsx`
- Modify: `src/app/(app)/settings/account/page.tsx`
- Modify: `src/app/(admin)/admin/rules-sources/page.tsx`

- [ ] **Step 1: Add header to characters/page.tsx**

Find the outermost content div. Add at the top:

```tsx
<div className="mb-6">
  <p className="label-overline mb-1">Library</p>
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    Characters
  </h1>
</div>
```

- [ ] **Step 2: Add header to homebrew/[homebrewId]/page.tsx**

Find the outermost content div. Add at the top. The title should use the homebrew item's name from the page's data — if no data is loaded yet, use a placeholder with the dynamic name:

```tsx
<div className="mb-6">
  <p className="label-overline mb-1">Homebrew</p>
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    {homebrew?.name ?? 'Loading…'}
  </h1>
</div>
```

Use whatever variable holds the fetched homebrew item name in that file. If it's a server component that fetches data, use the fetched name directly.

- [ ] **Step 3: Add header to settings/account/page.tsx**

Find the page's content area (after any skeleton/loading states). Add at the top:

```tsx
<div className="mb-6">
  <p className="label-overline mb-1">Settings</p>
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    Account
  </h1>
</div>
```

- [ ] **Step 4: Add header and q-tokens to admin/rules-sources/page.tsx**

Find the outermost content div. Add at the top:

```tsx
<div className="mb-6">
  <p className="label-overline mb-1">Admin</p>
  <div className="section-rule" />
  <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
    Rules Sources
  </h1>
</div>
```

Also in the same file, replace any `text-gray-*` or generic color classes on stat/count labels with `text-[var(--q-text-dim)]`.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/characters/page.tsx \
        src/app/\(app\)/homebrew/\[homebrewId\]/page.tsx \
        src/app/\(app\)/settings/account/page.tsx \
        src/app/\(admin\)/admin/rules-sources/page.tsx
git commit -m "fix(ui): add overline+h1 headers to characters, homebrew detail, account, rules-sources"
```

---

## Task 5: Settings sub-pages — upgrade SettingsCard to design system

**Files:**
- Modify: `src/components/settings/panels.tsx` (SettingsCard component, lines 37–58)
- Modify: `src/app/(app)/settings/profile/page.tsx` (add overline header)
- Modify: `src/app/(app)/settings/ai/page.tsx`
- Modify: `src/app/(app)/settings/appearance/page.tsx`
- Modify: `src/app/(app)/settings/integrations/page.tsx`

The settings sub-pages (`profile`, `ai`, `appearance`, `integrations`) each render a single panel component exported from `panels.tsx`. The `SettingsCard` function in `panels.tsx` wraps all panels using `stone-card` CSS classes — replace it with the Card primitive.

- [ ] **Step 1: Update SettingsCard in panels.tsx**

Open `src/components/settings/panels.tsx`. Add the import at the top of imports:

```tsx
import { Card } from '@/components/primitives';
```

Replace the `SettingsCard` function (lines 37–58):

```tsx
// BEFORE
function SettingsCard({
  title,
  description,
  children,
  accentClassName,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  accentClassName?: string;
}) {
  return (
    <section className={`stone-card ${accentClassName ?? ''}`}>
      <div className="stone-card-header">
        <div>
          <span className="stone-card-title">{title}</span>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="stone-card-body space-y-4">{children}</div>
    </section>
  );
}

// AFTER
function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="feature" className="space-y-4">
      <div>
        <p className="label-overline mb-1">{title}</p>
        <div className="section-rule mb-3" />
        <p className="text-sm text-[var(--q-text-dim)]">{description}</p>
      </div>
      {children}
    </Card>
  );
}
```

Note: the `accentClassName` prop is removed — if any callers pass it, remove those usages too. Search for `accentClassName` in `panels.tsx` and remove all instances.

- [ ] **Step 2: Check for accentClassName usages**

```bash
grep -n "accentClassName" src/components/settings/panels.tsx
```

Remove any remaining `accentClassName` prop passes. If the prop appears on a `<SettingsCard` JSX usage, remove the prop.

- [ ] **Step 3: Verify panels.tsx type-checks**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Add overline headers to the four bare page files**

Each of these pages is a one-liner that renders a panel: `src/app/(app)/settings/profile/page.tsx`, `ai/page.tsx`, `appearance/page.tsx`, `integrations/page.tsx`.

Because the header is rendered by the `SettingsShell` in the layout (which provides the "Archive Control Room" hero), these pages do **not** need a repeated `<h1>`. The `SettingsCard` title labels (handled in step 1) are the section headers. 

Instead, verify each page file passes through cleanly and the shell's hero is sufficient. If a page is truly a one-liner with no wrapper, leave it as-is — the shell provides context.

If any of the four page files wraps the panel in a `<div>` with old classes (`space-y-6`, `px-*`), remove that wrapper div — let the panel's own Card handle spacing.

- [ ] **Step 5: Verify stone-card is gone from settings components**

```bash
grep -rn "stone-card" src/components/settings/
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/panels.tsx \
        src/app/\(app\)/settings/profile/page.tsx \
        src/app/\(app\)/settings/ai/page.tsx \
        src/app/\(app\)/settings/appearance/page.tsx \
        src/app/\(app\)/settings/integrations/page.tsx
git commit -m "fix(ui): upgrade settings SettingsCard to Card primitive with q-tokens"
```

---

## Task 6: Unthemed dialogs and sheets

**Files:**
- Modify: `src/components/homebrew/create-homebrew-dialog.tsx`
- Modify: `src/components/homebrew/edit-homebrew-dialog.tsx`
- Modify: `src/components/mechanics/mechanic-create-sheet.tsx`

Reference pattern: `src/components/npc/npc-create-sheet.tsx` (read this file for exact class patterns before editing).

- [ ] **Step 1: Read reference file**

Read `src/components/npc/npc-create-sheet.tsx` to understand the glass-panel + label-overline pattern used there. Key pattern to replicate:

```tsx
<div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
  <div>
    <p className="label-overline mb-1">Section Name</p>
    <div className="section-rule" />
  </div>
  {/* form fields */}
</div>
```

- [ ] **Step 2: Theme create-homebrew-dialog.tsx**

Open `src/components/homebrew/create-homebrew-dialog.tsx`. Read it fully first to understand the form structure.

For each logical form section (e.g., basic info, content, settings):
1. Wrap the section's fields in `<div className="glass-panel glass-grain rounded-xl p-6 space-y-4">`
2. Add a `<p className="label-overline mb-1">Section Name</p>` and `<div className="section-rule" />` at the top of each section
3. Replace any `text-gray-*` with `text-[var(--q-text-dim)]`, `text-muted-foreground` is fine to keep

Do not change form field structure, validation, or handlers.

- [ ] **Step 3: Theme edit-homebrew-dialog.tsx**

Open `src/components/homebrew/edit-homebrew-dialog.tsx`. Apply the same glass-panel wrapping pattern as step 2. The edit form should match the create form exactly in visual structure.

- [ ] **Step 4: Theme mechanic-create-sheet.tsx**

Open `src/components/mechanics/mechanic-create-sheet.tsx`. Read it fully first.

The sheet content form body should gain a glass-panel wrapper:

```tsx
<form className="mt-6 pb-4 px-5 space-y-4">
  <div className="glass-panel glass-grain rounded-xl p-6 space-y-6">
    <div>
      <p className="label-overline mb-1">Mechanic Details</p>
      <div className="section-rule" />
    </div>
    {/* existing form fields go here */}
  </div>
  {/* submit buttons go outside the glass-panel, matching npc-create-sheet pattern */}
</form>
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/homebrew/create-homebrew-dialog.tsx \
        src/components/homebrew/edit-homebrew-dialog.tsx \
        src/components/mechanics/mechanic-create-sheet.tsx
git commit -m "fix(ui): apply glass-panel and q-token theming to homebrew dialogs and mechanic sheet"
```

---

## Task 7: Wrapper and iframe pages

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sourcebook/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/foundry/page.tsx`

- [ ] **Step 1: Read both files**

Read both files to understand their current structure.

- [ ] **Step 2: Add loading/error wrapper to sourcebook/page.tsx**

The sourcebook page renders a `<SourcebookReader>` component. Wrap it with a loading and error state that uses design tokens:

```tsx
// Wrap SourcebookReader with a Suspense fallback using q-tokens
<Suspense
  fallback={
    <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-[var(--q-surface-utility)]" />
      <div className="h-[60vh] animate-pulse rounded-lg bg-[var(--q-surface-utility)]" />
    </div>
  }
>
  <SourcebookReader ... />
</Suspense>
```

If the page has an error state, replace any plain `<p>` error text with:

```tsx
<div className="mx-auto max-w-[1600px] px-6 py-6">
  <div className="rounded-lg border border-[var(--q-accent-danger-border)] bg-[var(--q-accent-danger-trace)] p-6">
    <p className="text-sm text-[var(--q-accent-danger)]">{error.message}</p>
  </div>
</div>
```

- [ ] **Step 3: Add styled wrapper to foundry/page.tsx**

The foundry page renders an iframe. Wrap it in a branded container:

```tsx
<div className="flex flex-col h-full">
  <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--q-border-subtle)] bg-[var(--q-shell-bar)]">
    <p className="label-overline">Campaign</p>
    <div className="w-px h-3 bg-[var(--q-border)]" />
    <span className="font-[var(--q-font-display)] text-sm text-[var(--q-text)]">Foundry VTT</span>
  </div>
  <div className="flex-1 relative">
    {/* existing iframe */}
    <iframe ... className="absolute inset-0 w-full h-full border-0" />
  </div>
</div>
```

Adjust the `flex flex-col h-full` to match whatever height/layout mechanism the page already uses.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sourcebook/page.tsx \
        src/app/\(app\)/campaigns/\[slug\]/foundry/page.tsx
git commit -m "fix(ui): add branded loading/error wrappers to sourcebook and foundry pages"
```

---

## Final Verification

- [ ] **Global grep for remaining hardcoded color patterns in modified files**

```bash
grep -rn "text-emerald\|text-green-5\|text-yellow-4\|text-orange-4\|text-red-4\|text-blue-4\|text-purple-4\|text-violet-4\|text-sky-4\|text-pink-4\|text-cyan-4\|stone-card" \
  src/components/encounter/ \
  src/components/brain/entity-detail-sheet.tsx \
  src/components/world/import-sheet.tsx \
  src/components/session/ooc-review-sheet.tsx \
  src/components/homebrew/ \
  src/components/mechanics/mechanic-create-sheet.tsx \
  src/components/settings/
```

Expected: no output.

- [ ] **Full type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Build check**

```bash
npm run build
```

Expected: successful build, no type errors.
