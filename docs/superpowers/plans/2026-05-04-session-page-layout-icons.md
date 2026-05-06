# Session Page Layout & Icon Treatment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the session hub page and add phase-specific icons to the pipeline tracker, phase complete rows, and prep section chips.

**Architecture:** Pure visual changes across four existing files plus one new shared icon-map file. No logic changes, no new components, no API calls. The shared `session-phase-icons.ts` avoids duplicating the icon map between the two files that need it.

**Tech Stack:** Lucide React (already in project), Tailwind CSS, Next.js 15 App Router.

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/lib/session-phase-icons.ts` | Icon map for all 6 session phases |
| Modify | `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` | `max-w-2xl` → `max-w-3xl` |
| Modify | `src/components/session/session-pipeline.tsx` | Phase icons replace abstract dots |
| Modify | `src/components/session/phase-complete-row.tsx` | Phase icon in green circle |
| Modify | `src/components/session/prep-status-card.tsx` | Icon + label in section chips |

---

## Task 1: Widen the page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

- [ ] **Step 1: Open the file and locate the two `max-w-2xl` occurrences**

  Lines 27 (loading skeleton div) and 68 (main return div). Both need updating.

- [ ] **Step 2: Update both occurrences**

  In the loading skeleton (line 27):
  ```tsx
  <div className="space-y-4 max-w-3xl">
  ```

  In the main return (line 68):
  ```tsx
  <div className="space-y-5 max-w-3xl">
  ```

- [ ] **Step 3: Verify in browser**

  Start dev server if not running: `npm run dev`
  
  Navigate to any session detail page (e.g. `/campaigns/tales-from-the-bonfire-keep/sessions/<id>`).
  
  Expected: content area is visibly wider — roughly 768px instead of 672px. Sidebar + content should no longer feel cramped.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
  git commit -m "feat(session): widen hub page to max-w-3xl"
  ```

---

## Task 2: Create shared phase icon map

**Files:**
- Create: `src/lib/session-phase-icons.ts`

- [ ] **Step 1: Create the file**

  ```ts
  import { BookOpen, Play, Mic, MessageSquare, FileText, Star } from 'lucide-react';
  import type { SessionPhase } from '@/lib/session-lifecycle';
  import type { LucideIcon } from 'lucide-react';

  export const PHASE_ICONS: Record<SessionPhase, LucideIcon> = {
    prep:       BookOpen,
    ran:        Play,
    processing: Mic,
    summary:    MessageSquare,
    recap:      FileText,
    complete:   Star,
  };
  ```

- [ ] **Step 2: Check types compile**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/session-phase-icons.ts
  git commit -m "feat(session): add shared PHASE_ICONS map"
  ```

---

## Task 3: Phase icons in the pipeline tracker

**Files:**
- Modify: `src/components/session/session-pipeline.tsx`

- [ ] **Step 1: Read the current file**

  Open `src/components/session/session-pipeline.tsx`. The current pipeline step renders:
  ```tsx
  <div className={cn(
    'h-2 w-2 rounded-full transition-all flex items-center justify-center',
    isDone   && 'bg-emerald-500',
    isActive && 'bg-amber-400 shadow-[0_0_6px_hsl(35_80%_55%/0.5)]',
    isLocked && 'bg-muted-foreground/30 border border-muted-foreground/20'
  )}>
    {isDone && <Check className="h-1.5 w-1.5 text-white" strokeWidth={3} />}
  </div>
  ```
  This entire `<div>` (the dot container) will be replaced with a phase icon.

- [ ] **Step 2: Update the imports**

  Replace the `Check` import with the shared map:
  ```tsx
  import { PHASE_ICONS } from '@/lib/session-phase-icons';
  ```
  Remove the `Check` import from lucide-react (it's no longer used in this file).

- [ ] **Step 3: Replace the dot div with a phase icon**

  Inside the `PHASE_ORDER.map(...)` callback, replace the dot `<div>` with:
  ```tsx
  {(() => {
    const Icon = PHASE_ICONS[phase];
    return (
      <Icon
        className={cn(
          'h-3.5 w-3.5 transition-all',
          isDone   && 'text-emerald-400/70',
          isActive && 'text-amber-400 drop-shadow-[0_0_4px_hsl(35_80%_55%/0.5)]',
          isLocked && 'text-muted-foreground/30'
        )}
      />
    );
  })()}
  ```

  The full updated `button` children should now be:
  ```tsx
  {(() => {
    const Icon = PHASE_ICONS[phase];
    return (
      <Icon
        className={cn(
          'h-3.5 w-3.5 transition-all',
          isDone   && 'text-emerald-400/70',
          isActive && 'text-amber-400 drop-shadow-[0_0_4px_hsl(35_80%_55%/0.5)]',
          isLocked && 'text-muted-foreground/30'
        )}
      />
    );
  })()}
  <span className={cn(
    'text-[9px] font-semibold uppercase tracking-[0.1em]',
    isDone   && 'text-emerald-400/70',
    isActive && 'text-amber-400',
    isLocked && 'text-muted-foreground/40'
  )}>
    {PHASE_LABELS[phase]}
  </span>
  ```

- [ ] **Step 4: Verify types compile**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Verify in browser**

  Navigate to a session detail page. The pipeline bar should show icons (open book, play triangle, microphone, message square, file, star) instead of colored dots. Active phase icon glows amber. Done phase icons are emerald-tinted. Locked phases are dimmed.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/session/session-pipeline.tsx
  git commit -m "feat(session): replace pipeline dots with phase icons"
  ```

---

## Task 4: Phase icon in complete rows

**Files:**
- Modify: `src/components/session/phase-complete-row.tsx`

- [ ] **Step 1: Read the current file**

  Open `src/components/session/phase-complete-row.tsx`. The green circle currently contains:
  ```tsx
  import { Check, Pencil } from 'lucide-react';
  // ...
  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
    <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
  </div>
  ```

- [ ] **Step 2: Update imports**

  ```tsx
  import { Pencil } from 'lucide-react';
  import { PHASE_ICONS } from '@/lib/session-phase-icons';
  ```
  Remove the `Check` import.

- [ ] **Step 3: Render the phase icon inside the circle**

  Replace the `Check` with the dynamic phase icon:
  ```tsx
  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
    {(() => {
      const Icon = PHASE_ICONS[phase];
      return <Icon className="h-3 w-3 text-emerald-400" strokeWidth={1.5} />;
    })()}
  </div>
  ```

- [ ] **Step 4: Verify types compile**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Verify in browser**

  On a session that has completed the prep phase, the green "Prep complete" row should now show a small `BookOpen` icon inside the green circle instead of a checkmark. The row for "ran" phase should show a `Play` icon, etc.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/session/phase-complete-row.tsx
  git commit -m "feat(session): phase-complete rows use phase icon instead of check"
  ```

---

## Task 5: Icon + label chips in prep status card

**Files:**
- Modify: `src/components/session/prep-status-card.tsx`

- [ ] **Step 1: Read the current file**

  Open `src/components/session/prep-status-card.tsx`. The `SECTIONS` array has `id` and `label`. Each chip renders:
  ```tsx
  <div
    key={id}
    className="px-2 py-1.5 rounded text-center text-[9px] uppercase tracking-wide border"
    style={{ ... }}
  >
    {label}
  </div>
  ```

- [ ] **Step 2: Add the icon map after the existing imports**

  ```tsx
  import {
    Users, Zap, MapPin, KeyRound, Users2, Skull, Award, List,
  } from 'lucide-react';
  import type { LucideIcon } from 'lucide-react';

  const SECTION_ICONS: Record<string, LucideIcon> = {
    characters:     Users,
    'strong-start': Zap,
    scenes:         MapPin,
    secrets:        KeyRound,
    npcs:           Users2,
    monsters:       Skull,
    rewards:        Award,
    threads:        List,
  };
  ```

- [ ] **Step 3: Update the chip div to render icon + label**

  The chip `div` needs `flex items-center justify-center gap-1`. Replace the existing chip `div`:
  ```tsx
  <div
    key={id}
    className="px-2 py-1.5 rounded text-[9px] uppercase tracking-wide border flex items-center justify-center gap-1"
    style={{
      background: done ? 'hsl(140 30% 10%)' : 'hsl(240 10% 13%)',
      color: done ? 'hsl(140 50% 50%)' : 'var(--card-text-muted)',
      borderColor: done ? 'hsl(140 30% 18%)' : 'hsl(240 20% 16%)',
    }}
  >
    {(() => {
      const Icon = SECTION_ICONS[id];
      return Icon ? <Icon className="h-2 w-2 shrink-0" strokeWidth={2} /> : null;
    })()}
    {label}
  </div>
  ```

- [ ] **Step 4: Verify types compile**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Verify in browser**

  Navigate to a session in the prep phase. The prep status card should show 8 chips, each with a small icon beside the label. Done chips are green with their icon; todo chips are dimmed with their icon. Nothing should overflow or wrap unexpectedly at `max-w-3xl`.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/session/prep-status-card.tsx
  git commit -m "feat(session): add icons to prep section chips"
  ```

---

## Task 6: Push and verify

- [ ] **Step 1: Run type check one final time**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 2: Run lint**

  ```bash
  npm run lint
  ```

  Expected: no errors (or only pre-existing warnings).

- [ ] **Step 3: Push**

  ```bash
  git push origin main
  ```

- [ ] **Step 4: Check Vercel deployment**

  Watch the Vercel dashboard for `quiver-dm-live`. Deployment should complete within ~3 minutes. Navigate to the live session page and verify all four changes are visible.
