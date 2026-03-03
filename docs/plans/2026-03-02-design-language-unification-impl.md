# Design Language Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the amber/glass design system (label-overline, section-rule, glass-panel) to 4 remaining pages: NPC list, NPC detail, sessions list, and homebrew gallery.

**Architecture:** Each task is a targeted find-and-replace on one file or component — no new components needed. Use existing CSS utilities from `globals.css`. Reference implementations: `src/app/(app)/dashboard/page.tsx` and `src/app/(app)/campaigns/[slug]/page.tsx`.

**Tech Stack:** Next.js 15, Tailwind, shadcn/ui, existing CSS utilities in `src/app/globals.css`

---

## Context: Design System Utilities (globals.css)

```css
.label-overline  — amber caps section header (0.625rem, 0.25em tracking, hsl(35 80% 55% / 0.4))
.section-rule    — amber gradient horizontal rule (1px height)
.glass-panel     — frosted dark glass card (bg 240 10% 8% / 0.42, backdrop blur)
.glass-row       — lighter glass for list rows
.glass-grain     — noise texture overlay
```

**Section header pattern:**
```tsx
<p className="label-overline">SECTION TITLE</p>
<div className="section-rule mb-4" />
```

**Card pattern:** Add `glass-panel` to the `className` of any `<Card>` component.

---

### Task 1: NPC List Page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/npcs/page.tsx`

**Step 1: Read the current file**

Run: `cat src/app/(app)/campaigns/[slug]/npcs/page.tsx`

Confirm you can see:
- A header section with `text-lg sm:text-xl font-semibold` for the NPCs heading
- NPC cards: `Card className="h-full hover:border-foreground/50..."`
- A grid of cards somewhere below the header row

**Step 2: Add label-overline section header above the NPC grid**

Find the JSX block that renders the grid of NPC cards. Immediately before the `<div className="grid ...">` (or equivalent container), insert:

```tsx
<p className="label-overline">Characters</p>
<div className="section-rule mb-4" />
```

If the grid already has a `<div>` wrapper or is inside a section, add the label-overline + section-rule as the first children of that wrapper, before the grid itself.

**Step 3: Apply glass-panel to NPC cards**

Find every `<Card` that wraps an NPC entry. The current className likely starts with `"h-full hover:border-foreground/50`. Change it to include `glass-panel`:

```tsx
// Before:
<Card className="h-full hover:border-foreground/50 transition-colors cursor-pointer">
// After:
<Card className="glass-panel h-full hover:border-foreground/50 transition-colors cursor-pointer">
```

Apply to all NPC card instances in the file (could be 1 component, could be repeated).

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep "npcs/page"`
Expected: no output (no errors in this file)

**Step 5: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/npcs/page.tsx
git commit -m "design: apply glass-panel and label-overline to NPC list page"
```

---

### Task 2: NPC Detail Page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx`

**Step 1: Read the current file**

Run: `cat src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx`

Confirm you can see:
- Section headers using `text-sm font-semibold text-muted-foreground uppercase tracking-wide`
- Cards for Description, DM Secrets, Stat Block sections
- DM Secrets card with border styling like `border-foreground/30`

**Step 2: Replace section headers with label-overline pattern**

Find all occurrences of the pattern:
```tsx
<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
  SOME TITLE
</h3>
```
(or similar — may be `<p>`, `<h2>`, `<h4>` etc.)

Replace each with:
```tsx
<p className="label-overline">SOME TITLE</p>
<div className="section-rule mb-4" />
```

Keep the title text exactly as-is. Remove any `<Separator />` components that appear before section content (the section-rule replaces them).

**Step 3: Apply glass-panel to content cards**

Find the `<Card` wrapping each content section (Description, DM Secrets, Stat Block, etc.). Add `glass-panel` to each:

```tsx
// Before:
<Card className="p-6">
// After:
<Card className="glass-panel p-6">
```

For any card that already has a className, prepend `glass-panel ` to it.

**Step 4: Apply amber border to DM Secrets card**

Find the DM Secrets card specifically (it contains content about DM secrets/notes). Change its border to amber:

```tsx
// Before (some variant of):
<Card className="border-foreground/30 p-6">
// After:
<Card className="glass-panel border-amber-500/30 p-6">
```

**Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep "npcs/\[npcId\]"`
Expected: no output

**Step 6: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx
git commit -m "design: apply glass-panel and label-overline to NPC detail page"
```

---

### Task 3: Sessions List Page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/page.tsx`

**Step 1: Read the current file**

Run: `cat src/app/(app)/campaigns/[slug]/sessions/page.tsx`

Confirm you can see:
- Session row cards using `rounded-lg border border-border bg-card` (or similar)
- A header area (already good — `font-display text-2xl font-bold`)
- Status filter pills (already use amber correctly)

**Step 2: Apply glass-panel to session row cards**

Find the card/div that wraps each session row. It likely has `bg-card` in the className.

```tsx
// Before:
<div className="rounded-lg border border-border bg-card p-4 ...">
// After:
<div className="glass-panel rounded-lg border border-border p-4 ...">
```

Remove `bg-card` if present (glass-panel sets its own background). Keep all other classes.

If sessions are wrapped in `<Card>` components instead:
```tsx
// Before:
<Card className="p-4">
// After:
<Card className="glass-panel p-4">
```

**Step 3: Add label-overline section header above the sessions list**

Immediately before the list/grid of session cards, insert:

```tsx
<p className="label-overline">Sessions</p>
<div className="section-rule mb-4" />
```

Place it inside any existing container div, as the first child before the session rows begin.

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep "sessions/page"`
Expected: no output

**Step 5: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/sessions/page.tsx
git commit -m "design: apply glass-panel and label-overline to sessions list page"
```

---

### Task 4: Homebrew Gallery

**Files:**
- Modify: `src/components/homebrew/homebrew-content-card.tsx`
- Modify: `src/app/(app)/homebrew/page.tsx`

**Step 1: Read both files**

Run: `cat src/components/homebrew/homebrew-content-card.tsx`
Run: `cat src/app/(app)/homebrew/page.tsx`

Confirm in homebrew-content-card.tsx:
- `<Card className="group transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer overflow-hidden">`

Confirm in homebrew/page.tsx:
- Grid of `<HomebrewContentCard>` components
- No section header above the grid

**Step 2: Apply glass-panel to HomebrewContentCard**

In `src/components/homebrew/homebrew-content-card.tsx`, add `glass-panel` to the Card:

```tsx
// Before:
<Card className="group transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer overflow-hidden">
// After:
<Card className="glass-panel group transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer overflow-hidden">
```

**Step 3: Add label-overline section header on homebrew gallery page**

In `src/app/(app)/homebrew/page.tsx`, find the container just before the grid of `<HomebrewContentCard>` elements. Add a label-overline + section-rule:

```tsx
<p className="label-overline">Homebrew Library</p>
<div className="section-rule mb-4" />
```

If there's already a visible heading like "Homebrew" or "Your Homebrew", replace it with the label-overline pattern instead of adding a duplicate.

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | grep -E "homebrew/(page|homebrew-content-card)"`
Expected: no output

**Step 5: Commit**

```bash
git add src/components/homebrew/homebrew-content-card.tsx src/app/(app)/homebrew/page.tsx
git commit -m "design: apply glass-panel and label-overline to homebrew gallery"
```

---

## Final Verification

After all 4 tasks complete, run a full type check:

```bash
npx tsc --noEmit
```

Expected: 0 errors introduced by these changes.

Then update the kanban: move **Design Language Unification** card from Backlog to Done in `docs/obsidian-vault/KANBAN.md`.
