# Frontend Rewrite — Slice 0: Foundation + Home + Prep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the new CommandRail + CommandBar shell, six design primitives, session-first home page, and `/session/[id]` prep hub end-to-end — replacing the dashboard and old session routes with the v2 architecture.

**Architecture:** New primitives (Surface/Card/Section/Summon/Pill/Canvas) provide one UI vocabulary. A new shell (CommandBar top 48px, CommandRail left 56–260px) wraps all `(app)/` routes. Home page is session-first. Session hub lives at `/session/[id]` and renders existing prep components in the new shell. Old routes 308-redirect. Visual mismatch in non-migrated routes is expected and intentional.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Zustand (`useHeaderStore`), Framer Motion, shadcn/ui, Tailwind CSS, Playwright (E2E)

---

## Pre-flight verification

Before starting, confirm these assumptions hold:

- `sessions.getById` response includes `campaign: { id, slug, name }` — check `src/server/routers/sessions.ts`. If not, add `campaign: { select: { id: true, slug: true, name: true } }` to the Prisma include.
- `sessions.getAll({ campaignId })` returns sessions sorted by date descending. If not, sort client-side by `session.date ?? session.createdAt`.
- `brain.state.get` is a nested tRPC procedure called as `trpc.brain.state.get.useQuery(...)`. Verify the router nesting in `src/server/routers/brain.ts`.
- Framer Motion is installed: `npm ls framer-motion`. If not: `npm install framer-motion`.

---

## File Map

**CREATE**
```
src/styles/tokens.css
src/components/primitives/Surface.tsx
src/components/primitives/Card.tsx
src/components/primitives/Section.tsx
src/components/primitives/Summon.tsx
src/components/primitives/Pill.tsx
src/components/primitives/Canvas.tsx
src/components/primitives/index.ts
src/lib/motion.ts
src/components/shell/CommandRail.tsx
src/components/shell/CommandBar.tsx
src/components/shell/PressureGauges.tsx
src/components/shell/BrainSummon.tsx
src/components/shell/MobileHeader.tsx
src/app/(app)/page.tsx
src/app/(app)/session/[id]/page.tsx
src/app/(app)/session/[id]/_components/PhasePillBar.tsx
src/app/(app)/session/[id]/_components/PrepWorkspace.tsx
tests/workflows/home.workflow.spec.ts
tests/workflows/session-prep.workflow.spec.ts
```

**MODIFY**
```
src/app/globals.css              — strip stone/glass, import tokens.css
src/app/(app)/app-shell.tsx      — use new shell components
src/store/header-store.ts        — add brainOpen/setBrainOpen
src/app/(app)/dashboard/page.tsx — 308 → /
src/app/(app)/campaigns/page.tsx — 308 → /
src/app/(app)/campaigns/[slug]/page.tsx — 308 → /
src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx — 308 → /session/[sessionId]
src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx — 308 → /session/[sessionId]
```

**DELETE**
```
src/components/sidebar.tsx
src/components/sidebar/MobileSidebar.tsx
src/components/layout/page-layout.tsx
src/templates/  (move BRAINSTORMING.md first)
```

---

## Task 1: Write failing E2E workflow specs

Write the acceptance tests now so they can guide implementation. Both tests will fail until implementation is complete.

**Files:**
- Create: `tests/workflows/home.workflow.spec.ts`
- Create: `tests/workflows/session-prep.workflow.spec.ts`

- [ ] **Step 1.1: Create home workflow spec**

```typescript
// tests/workflows/home.workflow.spec.ts
import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

test.describe('Home — session-first', () => {
  test('renders next-session hero with campaign context', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('next-session-hero')).toBeVisible()
  })

  test('renders CommandRail with 5 nav items', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('command-rail')).toBeVisible()
    await expect(page.getByTestId('rail-nav-home')).toBeVisible()
    await expect(page.getByTestId('rail-nav-world')).toBeVisible()
    await expect(page.getByTestId('rail-nav-compendium')).toBeVisible()
    await expect(page.getByTestId('rail-nav-characters')).toBeVisible()
    await expect(page.getByTestId('rail-nav-settings')).toBeVisible()
  })

  test('opens Brain summon on Cmd+K', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Meta+k')
    await expect(page.getByTestId('brain-summon')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('brain-summon')).not.toBeVisible()
  })

  test('old dashboard URL redirects to home', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/')
  })
})
```

- [ ] **Step 1.2: Create session-prep workflow spec**

```typescript
// tests/workflows/session-prep.workflow.spec.ts
import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

test.describe('Session hub — prep phase', () => {
  test('renders PhasePillBar at /session/[id]', async ({ page, request }) => {
    // Get a real session ID — adapt the API call to match your auth setup
    const res = await page.goto('/')
    await page.waitForSelector('[data-testid="next-session-hero"]')
    const prepLink = page.getByTestId('hero-cta-prep')
    const href = await prepLink.getAttribute('href')
    if (!href) test.skip()
    await page.goto(href!)
    await expect(page.getByTestId('phase-pill-bar')).toBeVisible()
    await expect(page.getByTestId('phase-pill-prep')).toBeVisible()
  })

  test('old session URL redirects to /session/[id]', async ({ page }) => {
    // Navigate to any session via the new home first to get a real slug+id
    await page.goto('/')
    const recentLink = page.getByTestId('recent-session-0')
    const href = await recentLink.getAttribute('href')
    if (!href) test.skip()
    // The new href should be /session/<id>
    expect(href).toMatch(/^\/session\//)
  })
})
```

- [ ] **Step 1.3: Run specs to confirm they fail**

```bash
npx playwright test tests/workflows/home.workflow.spec.ts tests/workflows/session-prep.workflow.spec.ts --reporter=list
```

Expected: all tests fail (routes/elements don't exist yet). Proceed once confirmed failing.

- [ ] **Step 1.4: Commit**

```bash
git add tests/workflows/home.workflow.spec.ts tests/workflows/session-prep.workflow.spec.ts
git commit -m "test(slice-0): add failing E2E workflow specs for home + session prep"
```

---

## Task 2: OKLCH token file + globals.css cleanup

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/app/globals.css`

- [ ] **Step 2.1: Create `src/styles/tokens.css`**

```css
/* tokens.css — single source of truth for all design tokens.
   Shadcn compatibility vars use the hsl-number format expected by shadcn.
   QuiverDM semantic vars use the --q-* prefix in OKLCH. */

/* ── Shadcn compatibility (dark mode only — QuiverDM is dark-first) ── */
:root {
  --background: 240 10% 4%;
  --foreground: 35 10% 92%;
  --card: 35 5% 10%;
  --card-foreground: 35 10% 92%;
  --popover: 240 10% 6%;
  --popover-foreground: 35 10% 92%;
  --primary: 35 80% 55%;
  --primary-foreground: 240 10% 4%;
  --secondary: 35 5% 14%;
  --secondary-foreground: 35 10% 85%;
  --muted: 35 5% 14%;
  --muted-foreground: 35 5% 55%;
  --accent: 35 80% 55%;
  --accent-foreground: 240 10% 4%;
  --destructive: 0 62% 45%;
  --destructive-foreground: 35 10% 92%;
  --border: 35 8% 22%;
  --input: 35 8% 18%;
  --ring: 35 80% 55%;
  --radius: 0.375rem;
  --chart-1: 35 80% 55%;
  --chart-2: 280 50% 55%;
  --chart-3: 200 60% 50%;
  --chart-4: 160 50% 45%;
  --chart-5: 0 62% 45%;
}

/* ── QuiverDM OKLCH semantic tokens ── */
:root {
  /* Backgrounds */
  --q-bg:             oklch(0.12 0.005 265);
  --q-surface-flat:   oklch(0.16 0.01 60);
  --q-surface-raised: oklch(0.19 0.012 60);
  --q-surface-sunken: oklch(0.10 0.005 265);

  /* Card */
  --q-card-bg:        oklch(0.17 0.012 60);
  --q-card-border:    oklch(0.7 0.16 55 / 0.18);

  /* Amber (primary accent — precious, use once per screen) */
  --q-amber:          oklch(0.7 0.16 55);
  --q-amber-dim:      oklch(0.7 0.16 55 / 0.5);
  --q-amber-trace:    oklch(0.7 0.16 55 / 0.08);
  --q-amber-border:   oklch(0.7 0.16 55 / 0.22);

  /* Borders */
  --q-border:         oklch(0.28 0.02 60 / 0.4);
  --q-border-subtle:  oklch(0.28 0.02 60 / 0.18);

  /* Text */
  --q-text:           oklch(0.92 0.005 60);
  --q-text-dim:       oklch(0.65 0.01 60);
  --q-text-faint:     oklch(0.45 0.01 60);

  /* Grimoire grain/glow */
  --q-glow-amber:     oklch(0.7 0.16 55 / 0.12);
  --q-glow-mystic:    oklch(0.55 0.15 280 / 0.08);

  /* Typography */
  --q-font-display:   'Cinzel', serif;
  --q-font-body:      'Bricolage Grotesque', system-ui, sans-serif;
  --q-font-mono:      'JetBrains Mono', monospace;

  /* Motion */
  --q-ease-out-quart: cubic-bezier(0.16, 1, 0.3, 1);
}
```

- [ ] **Step 2.2: Strip stone/glass/duplicate tokens from `globals.css`**

Open `src/app/globals.css`. Make the following changes:

**At the top, add import after `@tailwind utilities`:**
```css
@import '../styles/tokens.css';
```

**Remove these entire class blocks** (search and delete):
- `.stone-card { ... }` and `.stone-card-header`, `.stone-card-title`, `.stone-card-body`
- `.stat-value`, `.stat-label`, `.hero-arch-left`
- `.glass-shell { ... }`, `.glass-panel { ... }`, `.glass-row { ... }`, `.glass-grain { ... }`
- `.dashboard-bg { ... }`
- `@keyframes auth-scene-glow` and `.auth-scene-glow` (keep auth pages working — only remove if nothing uses it; grep first)

**Remove the duplicate HSL token block** inside `:root` that duplicates vars now in tokens.css. Keep only the `@tailwind` directives, the `@import`, the body gradient background, and the utility classes that aren't covered by tokens.css (fluid typography, scrollbar-hide, landing page utilities, section-rule, label-overline).

After editing, run:
```bash
npx grep -r "stone-card\|--card-stone\|glass-shell\|glass-panel\|glass-row" src/ --include="*.tsx" --include="*.ts" --include="*.css"
```
Expected: output shows files that STILL reference these — note them for follow-up (they'll be migrated in later slices). The goal is zero NEW references, not zero total yet.

- [ ] **Step 2.3: Verify app still starts**

```bash
npm run dev
```

Navigate to `http://localhost:3847`. The existing pages may look different but should render without a white screen. TypeScript errors are expected until later tasks.

- [ ] **Step 2.4: Commit**

```bash
git add src/styles/tokens.css src/app/globals.css
git commit -m "feat(slice-0): add OKLCH token file, strip duplicate/stone/glass from globals.css"
```

---

## Task 3: Six primitives + motion library

**Files:**
- Create: `src/components/primitives/Surface.tsx`
- Create: `src/components/primitives/Card.tsx`
- Create: `src/components/primitives/Section.tsx`
- Create: `src/components/primitives/Summon.tsx`
- Create: `src/components/primitives/Pill.tsx`
- Create: `src/components/primitives/Canvas.tsx`
- Create: `src/components/primitives/index.ts`
- Create: `src/lib/motion.ts`

- [ ] **Step 3.1: Create `src/components/primitives/Surface.tsx`**

```tsx
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type SurfaceVariant = 'flat' | 'raised' | 'sunken'

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant
}

const variants: Record<SurfaceVariant, string> = {
  flat:   'bg-[var(--q-surface-flat)] border border-[var(--q-border)]',
  raised: 'bg-[var(--q-surface-raised)] border border-[var(--q-amber-border)] shadow-md shadow-black/30',
  sunken: 'bg-[var(--q-surface-sunken)] border border-[var(--q-border-subtle)]',
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ variant = 'flat', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-[var(--radius)]', variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  ),
)
Surface.displayName = 'Surface'
```

- [ ] **Step 3.2: Create `src/components/primitives/Card.tsx`**

```tsx
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type CardVariant = 'list' | 'feature' | 'grimoire'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

const variants: Record<CardVariant, string> = {
  list: 'bg-[var(--q-card-bg)] border border-[var(--q-border)] px-4 py-3',
  feature: 'bg-[var(--q-surface-raised)] border border-[var(--q-amber-border)] px-5 py-4 shadow-lg shadow-black/30',
  grimoire: cn(
    'relative bg-gradient-to-br from-[var(--q-amber-trace)] to-[oklch(0.14_0.01_265_/_0.4)]',
    'border border-[var(--q-amber-border)] px-5 py-4',
    '[clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%_-_14px))]',
  ),
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'list', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-[var(--radius)]', variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'
```

- [ ] **Step 3.3: Create `src/components/primitives/Section.tsx`**

```tsx
import { cn } from '@/lib/utils'

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  label: string
  children?: React.ReactNode
}

export function Section({ label, className, children, ...props }: SectionProps) {
  return (
    <section className={cn('mt-8', className)} {...props}>
      <div className="flex items-center gap-3 mb-4">
        <span
          className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase whitespace-nowrap"
        >
          {label}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-[var(--q-amber-dim)] to-transparent" />
      </div>
      {children}
    </section>
  )
}
```

- [ ] **Step 3.4: Create `src/components/primitives/Summon.tsx`**

```tsx
'use client'

import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type SummonVariant = 'dialog' | 'sheet' | 'overlay'

interface SummonProps {
  variant?: SummonVariant
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  grimoire?: boolean
  children: React.ReactNode
  className?: string
}

const grimoireClass =
  'bg-gradient-to-br from-[var(--q-surface-flat)] to-[var(--q-bg)] border-[var(--q-amber-border)]'

export function Summon({
  variant = 'dialog',
  open,
  onOpenChange,
  title,
  grimoire = false,
  children,
  className,
}: SummonProps) {
  if (variant === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className={cn(grimoire && grimoireClass, className)}>
          {title && (
            <SheetHeader>
              <SheetTitle className="font-[var(--q-font-display)] tracking-wider text-[var(--q-text)]">
                {title}
              </SheetTitle>
            </SheetHeader>
          )}
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(grimoire && grimoireClass, className)}>
        {title && (
          <DialogHeader>
            <DialogTitle className="font-[var(--q-font-display)] tracking-wider text-[var(--q-text)]">
              {title}
            </DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3.5: Create `src/components/primitives/Pill.tsx`**

```tsx
import { cn } from '@/lib/utils'

type PillVariant = 'info' | 'warning' | 'danger' | 'primary'

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant
}

const variants: Record<PillVariant, string> = {
  info:    'bg-[var(--q-amber-trace)] border border-[oklch(0.7_0.16_55_/_0.25)] text-[oklch(0.8_0.1_55)]',
  warning: 'bg-[oklch(0.65_0.16_55_/_0.15)] border border-[oklch(0.65_0.16_55_/_0.4)] text-[oklch(0.8_0.14_55)]',
  danger:  'bg-[oklch(0.55_0.2_25_/_0.15)] border border-[oklch(0.55_0.2_25_/_0.4)] text-[oklch(0.75_0.15_25)]',
  primary: 'bg-[var(--q-amber)] border border-[var(--q-amber)] text-[var(--q-bg)] font-semibold',
}

export function Pill({ variant = 'info', className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-sm text-[11px] tracking-wide',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 3.6: Create `src/components/primitives/Canvas.tsx`**

```tsx
import { cn } from '@/lib/utils'

interface CanvasProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

export function Canvas({ className, children, ...props }: CanvasProps) {
  return (
    <div
      className={cn('relative bg-[var(--q-bg)] min-h-screen overflow-hidden', className)}
      {...props}
    >
      {/* Ambient candlelight glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse at 15% 0%, var(--q-glow-amber), transparent 50%)',
            'radial-gradient(ellipse at 85% 100%, var(--q-glow-mystic), transparent 50%)',
          ].join(', '),
        }}
      />
      {/* Grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3.7: Create `src/components/primitives/index.ts`**

```ts
export { Surface } from './Surface'
export { Card } from './Card'
export { Section } from './Section'
export { Summon } from './Summon'
export { Pill } from './Pill'
export { Canvas } from './Canvas'
```

- [ ] **Step 3.8: Create `src/lib/motion.ts`**

```ts
import type { Variants } from 'framer-motion'

export const inkSpread: Variants = {
  hidden:  { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: 'easeIn' } },
}

export const candleBreathe: Variants = {
  idle: {
    opacity: [0.85, 1, 0.85],
    scale: [1, 1.003, 1],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
}

export const summonFade: Variants = {
  hidden:  { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2, ease: 'easeIn' } },
}

export const phaseTransition: Variants = {
  enter:  (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit:   (dir: number) => ({ x: dir < 0 ? 40 : -40, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }),
}

export const backdropFade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
}
```

- [ ] **Step 3.9: Run type check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only about missing imports in files not yet touched. No errors in the new primitive files.

- [ ] **Step 3.10: Commit**

```bash
git add src/components/primitives/ src/lib/motion.ts
git commit -m "feat(slice-0): add six design primitives and motion library"
```

---

## Task 4: Header store + shell components

**Files:**
- Modify: `src/store/header-store.ts`
- Create: `src/components/shell/PressureGauges.tsx`
- Create: `src/components/shell/BrainSummon.tsx`
- Create: `src/components/shell/CommandRail.tsx`
- Create: `src/components/shell/CommandBar.tsx`

- [ ] **Step 4.1: Add `brainOpen` to `src/store/header-store.ts`**

Read the current file first. Then replace the store definition:

```ts
import { create } from 'zustand'

export type HeaderStat = {
  label: string
  value: string | number
  alert?: boolean
}

export type HeaderSlot = {
  label: string
  title: string
  campaignSlug?: string
  campaignId?: string
  isDM?: boolean
  badge?: { text: string; color: 'amber' | 'sky' }
  stats?: HeaderStat[]
} | null

interface HeaderStore {
  slot: HeaderSlot
  setSlot: (slot: HeaderSlot) => void
  brainOpen: boolean
  setBrainOpen: (open: boolean) => void
}

export const useHeaderStore = create<HeaderStore>((set) => ({
  slot: null,
  setSlot: (slot) => set({ slot }),
  brainOpen: false,
  setBrainOpen: (brainOpen) => set({ brainOpen }),
}))
```

- [ ] **Step 4.2: Create `src/components/shell/PressureGauges.tsx`**

This is a thin fetcher wrapper around the existing `src/components/brain/pressure-gauges.tsx` display component.

```tsx
'use client'

import { useHeaderStore } from '@/store/header-store'
import { trpc } from '@/lib/trpc'
import { PressureGauges as PressureGaugesDisplay } from '@/components/brain/pressure-gauges'

export function PressureGauges() {
  const { slot } = useHeaderStore()
  const campaignId = slot?.campaignId
  const isDM = slot?.isDM

  const { data } = trpc.brain.state.get.useQuery(
    { campaignId: campaignId ?? '' },
    { enabled: !!campaignId && !!isDM, staleTime: 30_000 },
  )

  if (!isDM || !data) return null

  return <PressureGaugesDisplay state={data} />
}
```

- [ ] **Step 4.3: Create `src/components/shell/BrainSummon.tsx`**

The ⌘K Grimoire overlay. Listens globally for Cmd+K/Ctrl+K, renders with Grimoire treatment.

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHeaderStore } from '@/store/header-store'
import { backdropFade, summonFade } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function BrainSummon() {
  const { brainOpen, setBrainOpen } = useHeaderStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setBrainOpen(true)
      }
      if (e.key === 'Escape') setBrainOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setBrainOpen])

  useEffect(() => {
    if (brainOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [brainOpen])

  return (
    <AnimatePresence>
      {brainOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            variants={backdropFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setBrainOpen(false)}
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            key="panel"
            data-testid="brain-summon"
            role="dialog"
            aria-modal="true"
            aria-label="The Brain"
            variants={summonFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed top-[10vh] left-1/2 z-50 -translate-x-1/2 w-full max-w-[540px]',
              'bg-gradient-to-br from-[var(--q-surface-flat)] to-[var(--q-bg)]',
              'border border-[var(--q-amber-border)]',
              'rounded-sm shadow-2xl shadow-black/60',
              '[clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%_-_14px))]',
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--q-border-subtle)]">
              <span className="text-[var(--q-amber)] text-lg">⌖</span>
              <span className="font-[var(--q-font-display)] text-xs tracking-[3px] text-[var(--q-amber)] uppercase">
                The Brain
              </span>
              <span className="ml-auto text-[10px] text-[var(--q-text-faint)]">ESC to close</span>
            </div>

            {/* Input */}
            <div className="px-5 py-4">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask anything about your world…"
                className={cn(
                  'w-full bg-transparent text-[var(--q-text)] text-sm',
                  'placeholder:text-[var(--q-text-faint)]',
                  'border-none outline-none',
                  'font-[var(--q-font-body)]',
                )}
              />
            </div>

            {/* Hint footer */}
            <div className="px-5 py-3 border-t border-[var(--q-border-subtle)]">
              <span className="text-[10px] text-[var(--q-text-faint)]">
                Brain query — full integration in slice 3
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4.4: Create `src/components/shell/CommandRail.tsx`**

New v2 rail. Five fixed nav items. No campaign-specific sub-nav (that lives in the route pages themselves).

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Globe, BookOpen, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'home',       href: '/',            icon: Home,     label: 'Home' },
  { id: 'world',      href: '/world',       icon: Globe,    label: 'World' },
  { id: 'compendium', href: '/compendium',  icon: BookOpen, label: 'Compendium' },
  { id: 'characters', href: '/characters',  icon: Users,    label: 'Characters' },
  { id: 'settings',   href: '/settings',    icon: Settings, label: 'Settings' },
] as const

type NavId = typeof NAV_ITEMS[number]['id']

export function CommandRail() {
  const pathname = usePathname()
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('quiver.rail.pinned')
    if (saved === 'true') setPinned(true)
  }, [])

  const togglePin = () => {
    const next = !pinned
    setPinned(next)
    localStorage.setItem('quiver.rail.pinned', String(next))
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      data-testid="command-rail"
      aria-label="Main navigation"
      className={cn(
        'hidden md:flex flex-col h-full shrink-0',
        'border-r border-[var(--q-border-subtle)]',
        'bg-[var(--q-surface-sunken)]',
        'transition-[width] duration-200 ease-out',
        pinned ? 'w-[260px]' : 'w-[56px]',
        'overflow-hidden',
      )}
    >
      {/* Logo mark */}
      <div className="h-12 flex items-center justify-center border-b border-[var(--q-border-subtle)] shrink-0">
        <span className="text-[var(--q-amber)] text-lg font-[var(--q-font-display)]">⌖</span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map(({ id, href, icon: Icon, label }) => (
          <Link
            key={id}
            href={href}
            data-testid={`rail-nav-${id}`}
            aria-label={label}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-sm min-h-[44px]',
              'transition-colors duration-150',
              isActive(href)
                ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                : 'text-[var(--q-text-faint)] hover:text-[var(--q-text)] hover:bg-[var(--q-border-subtle)]',
            )}
          >
            <Icon size={18} className="shrink-0" />
            {pinned && (
              <span className="text-sm font-[var(--q-font-body)] truncate">{label}</span>
            )}
          </Link>
        ))}
      </div>

      {/* Pin toggle */}
      <button
        onClick={togglePin}
        aria-label={pinned ? 'Collapse rail' : 'Pin rail open'}
        className={cn(
          'h-10 flex items-center justify-center shrink-0',
          'border-t border-[var(--q-border-subtle)]',
          'text-[var(--q-text-faint)] hover:text-[var(--q-text)]',
          'transition-colors text-xs',
        )}
      >
        {pinned ? '‹' : '›'}
      </button>
    </nav>
  )
}
```

- [ ] **Step 4.5: Create `src/components/shell/CommandBar.tsx`**

```tsx
'use client'

import { useHeaderStore } from '@/store/header-store'
import { PressureGauges } from './PressureGauges'
import { UserMenu } from '@/components/user-menu'
import { trpc } from '@/lib/trpc'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

export function CommandBar() {
  const { slot, setBrainOpen } = useHeaderStore()
  const router = useRouter()

  const { data: campaigns } = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    staleTime: 120_000,
  })

  return (
    <header
      className={cn(
        'hidden md:flex items-center h-12 shrink-0 px-4 gap-4',
        'border-b border-[var(--q-border-subtle)]',
        'bg-[var(--q-surface-sunken)]',
      )}
    >
      {/* Campaign switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-2 text-sm text-[var(--q-text)] max-w-[200px]',
              'hover:text-[var(--q-amber)] transition-colors',
            )}
          >
            <span className="font-[var(--q-font-display)] text-[10px] tracking-[2px] text-[var(--q-amber)] uppercase truncate">
              {slot?.title ?? 'No campaign'}
            </span>
            <ChevronDown size={12} className="shrink-0 text-[var(--q-text-faint)]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-[var(--q-surface-flat)] border-[var(--q-border)]">
          {campaigns?.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onSelect={() => router.push(`/campaigns/${c.slug}`)}
              className="text-[var(--q-text)] hover:text-[var(--q-amber)] cursor-pointer"
            >
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Pressure gauges (DM only — self-contained) */}
      <div className="flex-1 flex justify-center">
        <PressureGauges />
      </div>

      {/* ⌘K trigger */}
      <button
        onClick={() => setBrainOpen(true)}
        aria-label="Open Brain (⌘K)"
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs',
          'bg-[var(--q-amber-trace)] border border-[var(--q-border-subtle)]',
          'text-[var(--q-text-dim)] hover:text-[var(--q-text)] transition-colors',
        )}
      >
        <span>⌘K</span>
        <span className="hidden lg:inline">Ask the Brain</span>
      </button>

      {/* User menu */}
      <UserMenu />
    </header>
  )
}
```

- [ ] **Step 4.6: Run type check on shell components**

```bash
npx tsc --noEmit 2>&1 | grep "shell\|store" | head -20
```

Fix any type errors in the shell files before proceeding.

- [ ] **Step 4.7: Commit**

```bash
git add src/store/header-store.ts src/components/shell/
git commit -m "feat(slice-0): add shell components — CommandRail, CommandBar, BrainSummon, PressureGauges"
```

---

## Task 5: App shell wiring + legacy deletion

**Files:**
- Modify: `src/app/(app)/app-shell.tsx`
- Delete: `src/components/sidebar.tsx`, `src/components/sidebar/MobileSidebar.tsx`, `src/components/layout/page-layout.tsx`, `src/templates/`

- [ ] **Step 5.1: Move BRAINSTORMING.md before deleting templates folder**

```bash
mv "E:\Projects\QuiverDM\src\templates\BRAINSTORMING.md" "E:\Projects\QuiverDM\docs\obsidian-vault\20-Brainstorm\digital-grimoire-treatment.md"
```

- [ ] **Step 5.2: Create `src/components/shell/MobileHeader.tsx`**

Replaces the old `MobileSidebar`. A sheet-based nav that slides in from the left on mobile.

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Globe, BookOpen, Users, Settings, Menu, X } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { UserMenu } from '@/components/user-menu'

const NAV_ITEMS = [
  { id: 'home',       href: '/',           icon: Home,     label: 'Home' },
  { id: 'world',      href: '/world',      icon: Globe,    label: 'World' },
  { id: 'compendium', href: '/compendium', icon: BookOpen, label: 'Compendium' },
  { id: 'characters', href: '/characters', icon: Users,    label: 'Characters' },
  { id: 'settings',   href: '/settings',   icon: Settings, label: 'Settings' },
] as const

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {/* Mobile top bar — hidden on md+ */}
      <header className="md:hidden flex items-center h-12 px-4 border-b border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)] shrink-0">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--q-text-dim)]"
        >
          <Menu size={20} />
        </button>
        <span className="flex-1 text-center font-[var(--q-font-display)] text-xs tracking-[2px] text-[var(--q-amber)] uppercase">
          QuiverDM
        </span>
        <UserMenu />
      </header>

      {/* Nav sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[260px] bg-[var(--q-surface-sunken)] border-r border-[var(--q-border-subtle)] p-0"
        >
          <div className="flex items-center justify-between px-5 h-12 border-b border-[var(--q-border-subtle)]">
            <span className="font-[var(--q-font-display)] text-xs tracking-[2px] text-[var(--q-amber)] uppercase">
              QuiverDM
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close navigation" className="p-1">
              <X size={16} className="text-[var(--q-text-faint)]" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-2">
            {NAV_ITEMS.map(({ id, href, icon: Icon, label }) => (
              <Link
                key={id}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-sm min-h-[44px] text-sm',
                  isActive(href)
                    ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                    : 'text-[var(--q-text-dim)] hover:text-[var(--q-text)] hover:bg-[var(--q-border-subtle)]',
                )}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 5.3: Rewrite `src/app/(app)/app-shell.tsx`**

Read the current file first. Then replace its content:

```tsx
'use client'

import { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import { NavigationProgress } from '@/components/navigation-progress'
import { FeedbackWidget } from '@/components/feedback-widget'
import { ConsoleLogCapture } from '@/components/console-log-capture'
import { PinnedItemFlags } from '@/components/pinned-item-flags'
import { OnboardingCheck } from '@/components/onboarding-check'
import { CampaignVoiceShell } from '@/components/campaign/campaign-voice-shell'
import { CommandRail } from '@/components/shell/CommandRail'
import { CommandBar } from '@/components/shell/CommandBar'
import { MobileHeader } from '@/components/shell/MobileHeader'
import { BrainSummon } from '@/components/shell/BrainSummon'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CampaignVoiceShell>
      <OnboardingCheck />
      <NavigationProgress />

      <div className="flex h-screen overflow-hidden bg-[var(--q-bg)]">
        <CommandRail />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <CommandBar />
          <MobileHeader />

          <main className="flex-1 overflow-y-auto">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Global overlays */}
      <BrainSummon />
      <FeedbackWidget />
      <ConsoleLogCapture />
      <PinnedItemFlags />
    </CampaignVoiceShell>
  )
}
```

> **Note:** If any of the above imports don't exist at that exact path, find their actual location with `grep -r "export.*OnboardingCheck\|export.*NavigationProgress\|export.*FeedbackWidget\|export.*ConsoleLogCapture\|export.*PinnedItemFlags\|export.*ErrorBoundary" src/` and update imports accordingly.

- [ ] **Step 5.4: Delete legacy sidebar and page-layout files**

Before deleting, verify nothing except the old app-shell.tsx imports them:
```bash
npx grep -r "from.*sidebar\|from.*MobileSidebar\|from.*page-layout" src/ --include="*.tsx" --include="*.ts"
```

Expected: only the old app-shell.tsx (which we just rewrote). If other files reference them, port those references first.

```bash
rm "E:\Projects\QuiverDM\src\components\sidebar.tsx"
rm -rf "E:\Projects\QuiverDM\src\components\sidebar"
rm "E:\Projects\QuiverDM\src\components\layout\page-layout.tsx"
rm -rf "E:\Projects\QuiverDM\src\templates"
```

- [ ] **Step 5.5: Check for remaining references to deleted files**

```bash
npx tsc --noEmit 2>&1 | grep "Cannot find module" | head -20
```

Fix any remaining import errors.

- [ ] **Step 5.6: Start dev server and visually verify shell loads**

```bash
npm run dev
```

Navigate to `http://localhost:3847`. You should see:
- Left rail (56px wide) with ⌖ logo mark and 5 nav icons
- Top bar with campaign dropdown area and ⌘K button
- Pressing ⌘K opens the BrainSummon overlay
- Existing pages (world, settings, etc.) render inside the new shell with visual mismatch — expected

- [ ] **Step 5.7: Commit**

```bash
git add src/components/shell/MobileHeader.tsx src/app/(app)/app-shell.tsx docs/obsidian-vault/20-Brainstorm/digital-grimoire-treatment.md
git commit -m "feat(slice-0): wire new shell into AppShell, add MobileHeader, delete legacy Sidebar/PageLayout/templates"
```

---

## Task 6: New home page `/`

**Files:**
- Create: `src/app/(app)/page.tsx`

The new home replaces `/dashboard`. It queries campaigns and derives the active one (most recently sessioned or updated), then shows: next-session hero + active threads + recent sessions.

- [ ] **Step 6.1: Create `src/app/(app)/page.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useHeaderStore } from '@/store/header-store'
import { Section } from '@/components/primitives'
import { Card } from '@/components/primitives'
import { Pill } from '@/components/primitives'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format, isToday, isTomorrow } from 'date-fns'

export default function HomePage() {
  const { setSlot } = useHeaderStore()

  const { data: campaigns, isLoading } = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    staleTime: 120_000,
  })

  // Derive active campaign: most recent session date, fall back to most recently updated
  const active = campaigns
    ?.slice()
    .sort((a, b) => {
      const aDate = a.lastSessionDate ?? a.updatedAt
      const bDate = b.lastSessionDate ?? b.updatedAt
      return new Date(bDate).getTime() - new Date(aDate).getTime()
    })[0] ?? null

  const { data: sessions } = trpc.sessions.getAll.useQuery(
    { campaignId: active?.id ?? '' },
    { enabled: !!active?.id, staleTime: 60_000 },
  )

  const recentSessions = sessions?.slice(0, 3) ?? []

  // Set header store for CommandBar context
  useEffect(() => {
    if (!active) return
    setSlot({
      label: active.name,
      title: active.name,
      campaignSlug: active.slug ?? undefined,
      campaignId: active.id,
      isDM: true, // campaigns.getMyMemberships — verify isDM field or adapt
    })
    return () => setSlot(null)
  }, [active, setSlot])

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-24">
        <p className="font-[var(--q-font-display)] text-sm tracking-[2px] text-[var(--q-text-faint)] uppercase">
          No campaigns yet
        </p>
        <Button asChild>
          <Link href="/campaigns/new">Create your first campaign</Link>
        </Button>
      </div>
    )
  }

  const next = active.nextSession
  const nextDate = next?.date ? new Date(next.date) : null
  const nextLabel = nextDate
    ? isToday(nextDate)
      ? 'Tonight'
      : isTomorrow(nextDate)
      ? 'Tomorrow'
      : format(nextDate, 'EEE d MMM')
    : 'No session scheduled'

  const nextSession = recentSessions.find((s) => s.status === 'planning') ?? recentSessions[0]

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Next session hero */}
      <div
        data-testid="next-session-hero"
        className={cn(
          'relative rounded-sm border border-[var(--q-amber-border)] p-6 mb-8',
          'bg-gradient-to-br from-[var(--q-amber-trace)] to-[var(--q-surface-sunken)]',
          '[clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%_-_14px))]',
        )}
      >
        <div
          className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase mb-2"
        >
          {nextLabel}
        </div>

        <h1 className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)] mb-4">
          {nextSession?.title ?? `${active.name} — next session`}
        </h1>

        <div className="flex flex-wrap gap-3">
          {nextSession ? (
            <>
              <Button asChild variant="default" size="sm" data-testid="hero-cta-prep">
                <Link href={`/session/${nextSession.id}`}>
                  ▣ Continue prep
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/world">⌖ Open the world</Link>
              </Button>
              {nextSession.status === 'ready' && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/session/${nextSession.id}/live`}>▷ Run live</Link>
                </Button>
              )}
            </>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href={`/campaigns/${active.slug}/sessions/new`}>
                + Schedule session
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Recent sessions */}
      <Section label="Recent sessions">
        <div className="flex flex-col gap-2">
          {recentSessions.length === 0 && (
            <p className="text-[var(--q-text-faint)] text-sm">No sessions yet.</p>
          )}
          {recentSessions.map((s, i) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              data-testid={`recent-session-${i}`}
            >
              <Card
                variant="list"
                className="flex items-center justify-between hover:border-[var(--q-amber-border)] transition-colors cursor-pointer"
              >
                <div>
                  <span className="text-sm text-[var(--q-text)]">
                    {s.title ?? `Session ${s.sessionNumber}`}
                  </span>
                  {s.date && (
                    <span className="text-xs text-[var(--q-text-faint)] ml-2">
                      {format(new Date(s.date), 'd MMM yyyy')}
                    </span>
                  )}
                </div>
                <Pill variant="info">{s.status}</Pill>
              </Card>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  )
}
```

> **Note:** The `campaigns.getMyMemberships` response may not include `isDM` directly — check the return type. If the membership includes a `role` field, set `isDM: membership.role === 'DM' || membership.role === 'OWNER' || membership.role === 'CO_DM'`.
>
> The `sessions.getAll` return type — verify `session.status`, `session.date`, `session.sessionNumber`, `session.title` exist. Adapt field names to match the actual router response.

- [ ] **Step 6.2: Start dev server and verify home page renders**

```bash
npm run dev
```

Navigate to `http://localhost:3847/`. You should see:
- Session hero with campaign name and CTAs
- Recent sessions list (or "No sessions yet" if none)
- CommandRail and CommandBar around it

- [ ] **Step 6.3: Commit**

```bash
git add src/app/(app)/page.tsx
git commit -m "feat(slice-0): session-first home page at /"
```

---

## Task 7: New session hub `/session/[id]`

**Files:**
- Create: `src/app/(app)/session/[id]/page.tsx`
- Create: `src/app/(app)/session/[id]/_components/PhasePillBar.tsx`
- Create: `src/app/(app)/session/[id]/_components/PrepWorkspace.tsx`

- [ ] **Step 7.1: Create `src/app/(app)/session/[id]/_components/PhasePillBar.tsx`**

```tsx
'use client'

import { cn } from '@/lib/utils'
import type { SessionPhase } from '@/lib/session-lifecycle'

const PHASES: { id: SessionPhase; label: string }[] = [
  { id: 'prep',       label: 'Prep' },
  { id: 'ran',        label: 'Run' },
  { id: 'processing', label: 'Process' },
  { id: 'summary',    label: 'Summary' },
  { id: 'recap',      label: 'Recap' },
]

interface PhasePillBarProps {
  current: SessionPhase
}

export function PhasePillBar({ current }: PhasePillBarProps) {
  const currentIdx = PHASES.findIndex((p) => p.id === current)

  return (
    <div
      data-testid="phase-pill-bar"
      className="flex items-center gap-1 px-5 py-3 border-b border-[var(--q-border-subtle)] overflow-x-auto"
    >
      {PHASES.map(({ id, label }, idx) => {
        const isActive = id === current
        const isDone = idx < currentIdx

        return (
          <div
            key={id}
            data-testid={`phase-pill-${id}`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs shrink-0',
              isActive && 'bg-[var(--q-amber)] text-[var(--q-bg)] font-semibold',
              isDone && 'text-[var(--q-text-dim)]',
              !isActive && !isDone && 'text-[var(--q-text-faint)]',
            )}
          >
            {isDone && <span className="text-[var(--q-amber)] text-[10px]">✓</span>}
            <span className="font-[var(--q-font-display)] tracking-wide">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
```

> **Note:** `SessionPhase` type is exported from `src/lib/session-lifecycle.ts`. If it's not yet exported as a type (only as a function return type), add `export type SessionPhase = ReturnType<typeof deriveSessionPhase>` to that file.

- [ ] **Step 7.2: Create `src/app/(app)/session/[id]/_components/PrepWorkspace.tsx`**

This wraps the existing `PhasePrep` component in the new design.

```tsx
'use client'

import { PhasePrep } from '@/components/session/phase-prep'
import { Surface } from '@/components/primitives'

interface PrepWorkspaceProps {
  session: Record<string, unknown>
  slug: string
  campaignId: string
  onStatusChange: () => void
}

export function PrepWorkspace({ session, slug, campaignId, onStatusChange }: PrepWorkspaceProps) {
  return (
    <Surface variant="flat" className="rounded-none border-0 min-h-full">
      <PhasePrep
        session={session}
        slug={slug}
        campaignId={campaignId}
        onStatusChange={onStatusChange}
      />
    </Surface>
  )
}
```

- [ ] **Step 7.3: Create `src/app/(app)/session/[id]/page.tsx`**

```tsx
'use client'

import { use, useEffect, useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import { useHeaderStore } from '@/store/header-store'
import { deriveSessionPhase } from '@/lib/session-lifecycle'
import { PhasePillBar } from './_components/PhasePillBar'
import { PrepWorkspace } from './_components/PrepWorkspace'
import { Skeleton } from '@/components/ui/skeleton'

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { setSlot } = useHeaderStore()
  const utils = trpc.useUtils()

  const { data: session, isLoading } = trpc.sessions.getById.useQuery(
    { id },
    { staleTime: 30_000 },
  )

  const invalidate = useCallback(() => {
    utils.sessions.getById.invalidate({ id })
  }, [utils, id])

  // Set header store with campaign context from session
  useEffect(() => {
    if (!session) return
    // session.campaign should include { id, slug, name } — verify in sessions router
    const campaign = (session as Record<string, unknown>).campaign as
      | { id: string; slug: string; name: string }
      | undefined

    setSlot({
      label: campaign?.name ?? '',
      title: campaign?.name ?? '',
      campaignSlug: campaign?.slug,
      campaignId: campaign?.id ?? session.campaignId as string,
      isDM: true, // derive from session membership if available
    })
    return () => setSlot(null)
  }, [session, setSlot])

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--q-text-faint)] text-sm font-[var(--q-font-display)] tracking-wider">
          Session not found
        </p>
      </div>
    )
  }

  const recordings = (session as Record<string, unknown>).recordings as unknown[] | undefined
  const hasApprovedRecap = (
    (session as Record<string, unknown>)._count as Record<string, number> | undefined
  )?.recaps
    ? ((session as Record<string, unknown>)._count as Record<string, number>).recaps > 0
    : false

  const phase = deriveSessionPhase({
    status: (session as Record<string, unknown>).status as string,
    aiSummaryStatus: (session as Record<string, unknown>).aiSummaryStatus as string ?? 'none',
    aiSummary: (session as Record<string, unknown>).aiSummary as string | null ?? null,
    recordingCount: recordings?.length ?? 0,
    hasApprovedRecap,
  })

  const campaign = (session as Record<string, unknown>).campaign as
    | { id: string; slug: string; name: string }
    | undefined

  return (
    <div className="flex flex-col h-full">
      {/* Phase pill bar */}
      <PhasePillBar current={phase} />

      {/* Phase content */}
      <div className="flex-1 overflow-y-auto">
        {phase === 'prep' && campaign && (
          <PrepWorkspace
            session={session as Record<string, unknown>}
            slug={campaign.slug}
            campaignId={campaign.id}
            onStatusChange={invalidate}
          />
        )}

        {phase !== 'prep' && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="font-[var(--q-font-display)] text-xs tracking-[2px] text-[var(--q-amber)] uppercase">
              {phase === 'ran' && 'Run phase'}
              {phase === 'processing' && 'Processing'}
              {phase === 'summary' && 'Summary'}
              {phase === 'recap' && 'Recap'}
              {phase === 'complete' && 'Complete'}
            </p>
            <p className="text-sm text-[var(--q-text-faint)]">
              Coming in slice {phase === 'ran' || phase === 'processing' ? '2' : phase === 'recap' ? '1' : '1'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

> **Note:** The heavy type casting (`as Record<string, unknown>`) is intentional to avoid needing to know the exact inferred type from tRPC. In a follow-up, you can replace with the proper inferred type from `RouterOutputs['sessions']['getById']` in `src/lib/trpc.ts` or wherever RouterOutputs is exported.
>
> If `session.campaign` is not included in the `getById` response: open `src/server/routers/sessions.ts`, find the `getById` procedure, and add `campaign: { select: { id: true, slug: true, name: true } }` to its Prisma include.

- [ ] **Step 7.4: Verify session hub renders**

Navigate to `http://localhost:3847/session/<any-real-session-id>`. You should see:
- PhasePillBar with correct phase highlighted
- Prep workspace if the session is in prep phase
- "Coming in slice N" stub for other phases

- [ ] **Step 7.5: Commit**

```bash
git add src/app/(app)/session/
git commit -m "feat(slice-0): session hub at /session/[id] with PhasePillBar and PrepWorkspace"
```

---

## Task 8: 308 redirects for old URLs

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/campaigns/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx`

308 is permanent redirect. Use Next.js `redirect()` (server-side, no client bundle cost).

- [ ] **Step 8.1: Replace `src/app/(app)/dashboard/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
export default function DashboardPage() {
  redirect('/')
}
```

- [ ] **Step 8.2: Replace `src/app/(app)/campaigns/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
export default function CampaignsPage() {
  redirect('/')
}
```

- [ ] **Step 8.3: Replace `src/app/(app)/campaigns/[slug]/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
export default function CampaignOverviewPage() {
  redirect('/')
}
```

- [ ] **Step 8.4: Replace `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
export default function OldSessionPage({
  params,
}: {
  params: { sessionId: string }
}) {
  redirect(`/session/${params.sessionId}`)
}
```

> If this is Next.js 15 App Router with async params, use:
> ```tsx
> import { redirect } from 'next/navigation'
> export default async function OldSessionPage({
>   params,
> }: {
>   params: Promise<{ sessionId: string }>
> }) {
>   const { sessionId } = await params
>   redirect(`/session/${sessionId}`)
> }
> ```

- [ ] **Step 8.5: Replace `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
export default async function OldPrepPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  redirect(`/session/${sessionId}`)
}
```

- [ ] **Step 8.6: Verify redirects work**

```bash
npm run dev
```

Test each redirect:
- `http://localhost:3847/dashboard` → should land at `/`
- `http://localhost:3847/campaigns` → should land at `/`
- `http://localhost:3847/campaigns/<any-slug>` → should land at `/`
- `http://localhost:3847/campaigns/<slug>/sessions/<sessionId>` → should land at `/session/<sessionId>`

- [ ] **Step 8.7: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx src/app/(app)/campaigns/
git commit -m "feat(slice-0): 308 redirects — dashboard/campaigns → /, old session URLs → /session/[id]"
```

---

## Task 9: Type check, token regression, and E2E verification

- [ ] **Step 9.1: Full type check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -50
```

Fix any errors in files touched by this slice. Errors in untouched legacy files can be noted but not fixed (they're slice 1+ scope).

- [ ] **Step 9.2: Token regression check**

```bash
npx grep -r "stone-card\|--card-stone\|\.glass-shell\|\.glass-panel\|\.glass-row" src/components/shell src/components/primitives src/app/\(app\)/page.tsx src/app/\(app\)/session --include="*.tsx" --include="*.css"
```

Expected: zero hits. If any appear, remove them.

- [ ] **Step 9.3: Build check**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds. Address any build errors.

- [ ] **Step 9.4: Run E2E workflow specs**

```bash
npx playwright test tests/workflows/home.workflow.spec.ts tests/workflows/session-prep.workflow.spec.ts --reporter=list
```

Expected: all tests pass. If auth storage state doesn't exist at `tests/.auth/user.json`, check for the auth setup in `playwright.config.ts` — it may be `tests/.auth/` or a different path. Adapt the `storageState` path in both spec files.

- [ ] **Step 9.5: Run veteran-dm persona suite**

```bash
npx playwright test tests/personas/veteran-dm.persona.spec.ts --reporter=list
```

Expected: all existing checks still pass (regression check — new shell shouldn't break existing functionality).

- [ ] **Step 9.6: Run qa:cycle**

```bash
npm run qa:cycle
```

Expected: green.

- [ ] **Step 9.7: Push**

```bash
git push origin main
```

---

## Definition of Done — Slice 0

- [ ] `/` renders session-first home with CommandRail + CommandBar + BrainSummon (⌘K works)
- [ ] `/session/[id]` renders PhasePillBar + PrepWorkspace (prep phase) + stubs (other phases)
- [ ] Old session URLs (`/campaigns/*/sessions/[id]`) 308-redirect to `/session/[id]`
- [ ] Dashboard and campaign list URLs redirect to `/`
- [ ] `src/styles/tokens.css` exists; `globals.css` no longer defines tokens three times
- [ ] Six primitives importable from `@/components/primitives`
- [ ] Legacy `Sidebar`, `MobileSidebar`, `PageLayout` deleted
- [ ] `src/templates/` deleted; `BRAINSTORMING.md` moved to `docs/obsidian-vault/20-Brainstorm/`
- [ ] `home.workflow.spec.ts` and `session-prep.workflow.spec.ts` pass
- [ ] `veteran-dm.persona.spec.ts` passes
- [ ] `npm run qa:cycle` green
- [ ] `npm run build` clean
