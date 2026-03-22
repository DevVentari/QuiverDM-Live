# Logo Variant System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the d20-driven logo variant system — Arcane/Standard/Legendary/Gilded — in the QuiverDM sidebar, replacing the current text-only logo slot.

**Architecture:** A `QuiverLogo` component renders one of four SVG icon variants. A `useLogoVariant` hook rolls a d20 on first render, stores the result in `sessionStorage`, and returns a stable `LogoVariant` for the session. The sidebar reads the variant, overriding to `'gilded'` when the live session route is active.

**Tech Stack:** Next.js 15 App Router, React hooks, TypeScript, Tailwind, `sessionStorage`

**Spec:** `docs/superpowers/specs/2026-03-22-logo-system-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/components/logo/quiver-logo.tsx` | SVG icon for all 4 variants, size variants |
| Create | `src/hooks/use-logo-variant.ts` | d20 roll, sessionStorage read/write, SSR-safe |
| Modify | `src/components/sidebar.tsx:313–349` | Replace text-only logo with QuiverLogo + wordmark |
| Modify | `src/components/auth/portal-scene.tsx:44` | Replace `<img>` with `<QuiverLogo variant="standard" size="lg">` |

---

## Task 1: `QuiverLogo` component

**Files:**
- Create: `src/components/logo/quiver-logo.tsx`

### Step 1.1 — Create the file with type definitions and size map

```tsx
// src/components/logo/quiver-logo.tsx
export type LogoVariant = 'standard' | 'arcane' | 'legendary' | 'gilded';

interface QuiverLogoProps {
  variant: LogoVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { w: 26, h: 32 },
  md: { w: 28, h: 34 },
  lg: { w: 52, h: 64 },
};
```

### Step 1.2 — Add the shared base paths (Standard variant first)

Standard variant uses the canonical shield path from `public/images/logo.svg` scaled to viewBox 0 0 72 88:

```tsx
function StandardIcon() {
  return (
    <>
      {/* Shield outer */}
      <path
        d="M36,4 L60,15 L60,39 Q60,57 36,70 Q12,57 12,39 L12,15 Z"
        fill="hsl(240,10%,11%)"
        stroke="hsl(35,80%,48%)"
        strokeWidth="1.8"
      />
      {/* Shield inner bevel */}
      <path
        d="M36,9 L55,18 L55,39 Q55,54 36,65 Q17,54 17,39 L17,18 Z"
        fill="none"
        stroke="hsl(35,35%,22%)"
        strokeWidth="0.7"
      />
      {/* Quiver body */}
      <rect x="29" y="24" width="14" height="26" rx="7"
        fill="hsl(240,10%,8%)" stroke="hsl(35,60%,50%)" strokeWidth="1.3" />
      {/* Gem */}
      <circle cx="36" cy="46" r="4.5"
        fill="hsl(260,55%,32%)" stroke="hsl(260,60%,62%)" strokeWidth="1.2" />
      {/* Arrow shafts */}
      <line x1="33" y1="23" x2="33" y2="15" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="36" y1="23" x2="36" y2="12" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="39" y1="23" x2="39" y2="16" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      {/* Arrow tips */}
      <polygon points="33,15 31.5,19 34.5,19" fill="hsl(35,80%,52%)" />
      <polygon points="36,12 34.5,16 37.5,16" fill="hsl(35,80%,52%)" />
      <polygon points="39,16 37.5,20 40.5,20" fill="hsl(35,80%,52%)" />
    </>
  );
}
```

### Step 1.3 — Add Arcane variant (purple quiver interior, empty socket)

```tsx
function ArcaneIcon() {
  return (
    <>
      <path d="M36,4 L60,15 L60,39 Q60,57 36,70 Q12,57 12,39 L12,15 Z"
        fill="hsl(240,10%,11%)" stroke="hsl(35,80%,48%)" strokeWidth="1.8" />
      <path d="M36,9 L55,18 L55,39 Q55,54 36,65 Q17,54 17,39 L17,18 Z"
        fill="none" stroke="hsl(35,35%,22%)" strokeWidth="0.7" />
      {/* Purple-filled quiver body */}
      <rect x="29" y="24" width="14" height="26" rx="7"
        fill="hsl(260,45%,22%)" stroke="hsl(260,50%,58%)" strokeWidth="1.4" />
      {/* Empty arcane socket (stroke-only circle) */}
      <circle cx="36" cy="40" r="3.5"
        fill="none" stroke="hsl(260,50%,55%)" strokeWidth="0.8" opacity="0.7" />
      <line x1="33" y1="23" x2="33" y2="15" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="36" y1="23" x2="36" y2="12" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="39" y1="23" x2="39" y2="16" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <polygon points="33,15 31.5,19 34.5,19" fill="hsl(35,80%,52%)" />
      <polygon points="36,12 34.5,16 37.5,16" fill="hsl(35,80%,52%)" />
      <polygon points="39,16 37.5,20 40.5,20" fill="hsl(35,80%,52%)" />
    </>
  );
}
```

### Step 1.4 — Add Legendary variant (horizontal purple band, brighter tips)

`clipPath` must use a unique ID per instance to avoid collision when multiple `QuiverLogo` components appear in the same DOM (e.g. sidebar + portal-scene). Use React's `useId()` hook at the parent `QuiverLogo` level and pass the ID down as a prop.

```tsx
function LegendaryIcon({ clipId }: { clipId: string }) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d="M36,4 L60,15 L60,39 Q60,57 36,70 Q12,57 12,39 L12,15 Z" />
        </clipPath>
      </defs>
      <path d="M36,4 L60,15 L60,39 Q60,57 36,70 Q12,57 12,39 L12,15 Z"
        fill="hsl(240,10%,11%)" stroke="hsl(35,80%,48%)" strokeWidth="1.8" />
      {/* Purple band clipped to shield */}
      <rect x="12" y="33" width="48" height="13"
        fill="hsl(260,40%,25%)" opacity="0.45" clipPath={`url(#${clipId})`} />
      <path d="M36,9 L55,18 L55,39 Q55,54 36,65 Q17,54 17,39 L17,18 Z"
        fill="none" stroke="hsl(35,35%,22%)" strokeWidth="0.7" />
      <rect x="29" y="24" width="14" height="26" rx="7"
        fill="hsl(240,10%,8%)" stroke="hsl(35,60%,50%)" strokeWidth="1.3" />
      <line x1="33" y1="23" x2="33" y2="15" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="36" y1="23" x2="36" y2="12" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="39" y1="23" x2="39" y2="16" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      {/* Brighter arrow tips */}
      <polygon points="33,15 31.5,19 34.5,19" fill="hsl(35,80%,62%)" />
      <polygon points="36,12 34.5,16 37.5,16" fill="hsl(35,80%,62%)" />
      <polygon points="39,16 37.5,20 40.5,20" fill="hsl(35,80%,62%)" />
    </>
  );
}
```

### Step 1.5 — Add Gilded variant (gold family, larger 100×120 viewBox)

Note: Gilded has its own viewBox (0 0 100 120), so the exported component must handle that separately.

```tsx
function GildedIcon() {
  return (
    <>
      <path d="M50,8 L76,20 L76,48 Q76,68 50,82 Q24,68 24,48 L24,20 Z"
        fill="hsl(40,60%,14%)" stroke="hsl(40,80%,55%)" strokeWidth="2.2" />
      {/* Inner bevel */}
      <path d="M50,13 L71,23 L71,48 Q71,64 50,76 Q29,64 29,48 L29,23 Z"
        fill="none" stroke="hsl(40,70%,40%)" strokeWidth="1" />
      {/* Crown ornament */}
      <circle cx="50" cy="13" r="2" fill="hsl(40,80%,55%)" />
      {/* Quiver body */}
      <rect x="43" y="30" width="14" height="30" rx="7"
        fill="hsl(40,50%,16%)" stroke="hsl(40,80%,58%)" strokeWidth="1.5" />
      {/* Arrow shafts */}
      <line x1="46" y1="29" x2="46" y2="19" stroke="hsl(40,90%,68%)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="29" x2="50" y2="16" stroke="hsl(40,90%,68%)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="54" y1="29" x2="54" y2="20" stroke="hsl(40,90%,68%)" strokeWidth="1.8" strokeLinecap="round" />
      {/* Arrow tips */}
      <polygon points="46,19 44,24 48,24" fill="hsl(40,90%,62%)" />
      <polygon points="50,16 48,21 52,21" fill="hsl(40,90%,62%)" />
      <polygon points="54,20 52,25 56,25" fill="hsl(40,90%,62%)" />
    </>
  );
}
```

### Step 1.6 — Wire up the `QuiverLogo` export

Gilded uses a different viewBox. `useId()` generates the unique clipPath ID for Legendary.

Add `'use client';` at the top of the file — needed for `useId()`.

```tsx
'use client';

import { useId } from 'react';
```

```tsx
export function QuiverLogo({ variant, size = 'md', className }: QuiverLogoProps) {
  const { w, h } = SIZE_MAP[size];
  const clipId = useId().replace(/:/g, '');  // sanitize React's ":r0:" format for SVG id
  const isGilded = variant === 'gilded';

  return (
    <svg
      width={w}
      height={h}
      viewBox={isGilded ? '0 0 100 120' : '0 0 72 88'}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {variant === 'standard' && <StandardIcon />}
      {variant === 'arcane' && <ArcaneIcon />}
      {variant === 'legendary' && <LegendaryIcon clipId={`legendary-${clipId}`} />}
      {variant === 'gilded' && <GildedIcon />}
    </svg>
  );
}
```

### Step 1.7 — Commit

```bash
git add src/components/logo/quiver-logo.tsx
git commit -m "feat(logo): add QuiverLogo SVG component with 4 variants"
```

---

## Task 2: `useLogoVariant` hook

**Files:**
- Create: `src/hooks/use-logo-variant.ts`

The hook's `src/hooks/` location is confirmed — the directory already exists with other hooks like `use-debounce.ts`, `use-toast.ts`.

### Step 2.1 — Write the hook

```ts
// src/hooks/use-logo-variant.ts
'use client';

import { useEffect, useState } from 'react';
import type { LogoVariant } from '@/components/logo/quiver-logo';

const STORAGE_KEY = 'quiverdm-logo-variant';

function rollVariant(): LogoVariant {
  const roll = Math.floor(Math.random() * 20) + 1;
  if (roll <= 6) return 'arcane';
  if (roll <= 14) return 'standard';
  return 'legendary';
}

export function useLogoVariant(): LogoVariant {
  // SSR-safe: default to 'standard' until client hydrates
  const [variant, setVariant] = useState<LogoVariant>('standard');

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) as LogoVariant | null;
    if (stored && ['arcane', 'standard', 'legendary'].includes(stored)) {
      setVariant(stored);
    } else {
      const rolled = rollVariant();
      sessionStorage.setItem(STORAGE_KEY, rolled);
      setVariant(rolled);
    }
  }, []);

  return variant;
}
```

### Step 2.2 — Commit

```bash
git add src/hooks/use-logo-variant.ts
git commit -m "feat(logo): add useLogoVariant hook with d20 roll + sessionStorage"
```

---

## Task 3: Sidebar logo slot

**Files:**
- Modify: `src/components/sidebar.tsx:313–349`

This replaces the current `{!collapsed && <Link ...>QuiverDM / Campaign Companion</Link>}` block with the icon-equipped version. The collapsed state gets an icon-only centered slot.

### Step 3.1 — Add imports at top of sidebar.tsx

Find the existing import block. Add:

```tsx
import { QuiverLogo } from '@/components/logo/quiver-logo';
import { useLogoVariant } from '@/hooks/use-logo-variant';
```

### Step 3.2 — Add variant logic inside `Sidebar()` function body

After `const campaignNavSections = ...` (currently line ~284), add:

```tsx
const baseVariant = useLogoVariant();
const isLiveSession = pathname.match(/\/sessions\/[^/]+\/live$/) !== null;
const logoVariant = isLiveSession ? 'gilded' : baseVariant;
```

### Step 3.3 — Replace the logo div (lines 313–349)

Find this block:

```tsx
      {/* Logo */}
      <div
        className={cn(
          'relative z-10 flex items-center justify-between border-b border-[hsl(35_35%_18%)]',
          collapsed ? 'px-3 h-14' : 'px-5 h-14'
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex flex-col leading-none">
            <span
              className="font-display text-base font-bold tracking-wide"
              style={{
                color: 'hsl(35 80% 62%)',
                textShadow: '0 0 18px hsl(35 80% 48% / 0.35)',
              }}
            >
              QuiverDM
            </span>
            <span className="font-sans text-[9px] uppercase tracking-[0.14em] mt-0.5" style={{ color: 'hsl(240 5% 36%)' }}>
              Campaign Companion
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn('h-7 w-7 shrink-0', collapsed && 'mx-auto')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.8} />
          )}
        </Button>
      </div>
```

Replace with:

```tsx
      {/* Logo */}
      <div
        className={cn(
          'relative z-10 flex items-center border-b border-[hsl(35_35%_18%)]',
          collapsed ? 'justify-center px-3 h-14' : 'justify-between px-5 h-14'
        )}
      >
        {collapsed ? (
          <>
            <Link href="/dashboard" aria-label="QuiverDM">
              <QuiverLogo variant={logoVariant} size="sm" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="absolute right-1 h-7 w-7"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </>
        ) : (
          <>
            <Link href="/dashboard" className="flex items-center gap-2.5 leading-none min-w-0">
              <QuiverLogo variant={logoVariant} size="md" />
              <div className="flex flex-col min-w-0">
                <span
                  className="font-display text-[13px] font-bold tracking-[0.1em] leading-none"
                  style={{ color: 'hsl(35 70% 88%)', textShadow: '0 0 18px hsl(35 80% 48% / 0.35)' }}
                >
                  QUIVER<span style={{ color: 'hsl(35 80% 62%)' }}>DM</span>
                </span>
                <span className="font-sans text-[8px] uppercase tracking-[0.14em] mt-1" style={{ color: 'hsl(240 5% 36%)' }}>
                  Campaign Companion
                </span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-7 w-7 shrink-0"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </>
        )}
      </div>
```

### Step 3.4 — Run TypeScript check

```bash
npx tsc --noEmit
```

Expected: no errors related to `QuiverLogo` or `useLogoVariant`.

### Step 3.5 — Commit

```bash
git add src/components/sidebar.tsx
git commit -m "feat(logo): integrate QuiverLogo variant system into sidebar"
```

---

## Task 4: Auth portal-scene update

**Files:**
- Modify: `src/components/auth/portal-scene.tsx:44`

The auth page always shows `Standard` — no hook needed. The subtitle "The DM's Second Brain" stays in the hero panel (it's marketing copy, not a product label).

### Step 4.1 — Add import

In `portal-scene.tsx`, add:

```tsx
import { QuiverLogo } from '@/components/logo/quiver-logo';
```

### Step 4.2 — Replace the `<img>` element

Find:

```tsx
<img src="/images/logo.svg" alt="QuiverDM" width={52} height={52} />
```

Replace with:

```tsx
<QuiverLogo variant="standard" size="lg" />
```

The surrounding `flex items-center gap-4` div and wordmark text remain unchanged.

### Step 4.3 — Run TypeScript check

```bash
npx tsc --noEmit
```

Expected: clean.

### Step 4.4 — Commit

```bash
git add src/components/auth/portal-scene.tsx
git commit -m "feat(logo): use QuiverLogo component in auth portal scene"
```

---

## Task 5: Push and verify

### Step 5.1 — Build check

```bash
npm run build
```

Expected: no errors. If Stripe env vars are missing locally, set dummy values — see CLAUDE.md operational notes.

### Step 5.2 — Visual verification

Start dev server: `npm run dev`

- Visit `http://localhost:3847/auth/signin` — left panel shows Standard quiver icon with "QUIVERDM" wordmark, subtitle "The DM's Second Brain"
- Visit `http://localhost:3847/dashboard` — sidebar shows the rolled variant (refresh tab to re-verify same variant persists; new tab should potentially roll a different one)
- Open devtools > Application > Session Storage — confirm `quiverdm-logo-variant` key exists with value `arcane`, `standard`, or `legendary`
- Delete the sessionStorage key and refresh — new variant should roll
- Navigate to any `/sessions/[id]/live` route — sidebar icon should switch to Gilded

### Step 5.3 — Push

```bash
git push origin main
```

---

## Out of Scope

- MobileSidebar logo treatment
- Gilded animation/transition effects
- Animated variant reveal on roll
- OG images / favicon / marketing pages
