# Codex Agent Task: Framer Motion Entrance Animations

## Goal
Add tasteful spring-based entrance animations to key list pages in QuiverDM. Framer Motion is already installed at v11.18.2. No behavior changes — visual polish only.

## Context
QuiverDM is a Next.js 15 App Router app with:
- `framer-motion` v11.18.2 (already in package.json)
- `'use client'` required for any Framer Motion component
- Dark amber aesthetic with Cinzel display font

## Changes Required

### Principle: Strategic, not scattered
Apply animations ONLY on:
1. List item entrances when the page loads (staggered slide-up)
2. Page-level fade-in on first mount
DO NOT add hover animations (shadcn handles that) or click animations.

### 1. Sessions list page: `src/app/(app)/campaigns/[slug]/sessions/page.tsx`

The sessions page has a list of session cards (timeline with numbered bubbles).

Wrap the card list with Framer Motion stagger:

```tsx
import { motion, AnimatePresence } from 'framer-motion';

// At top of component, define variants
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 320, damping: 28 }
  },
};
```

Wrap the container that renders session cards with:
```tsx
<motion.div
  variants={listVariants}
  initial="hidden"
  animate="visible"
>
  {filteredSessions.map((s) => (
    <motion.div key={s.id} variants={itemVariants}>
      {/* existing session card JSX */}
    </motion.div>
  ))}
</motion.div>
```

Also wrap the page header with a simple fade-in:
```tsx
<motion.div
  initial={{ opacity: 0, y: -8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  {/* heading + New Session button */}
</motion.div>
```

### 2. Encounters index page: `src/app/(app)/campaigns/[slug]/encounters/page.tsx`

The encounters page has a grid of encounter plan cards.

Same stagger pattern for the card grid:

```tsx
import { motion } from 'framer-motion';

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  },
};
```

Change the grid `<div>` to a `<motion.div>`:
```tsx
<motion.div
  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
  variants={gridVariants}
  initial="hidden"
  animate="visible"
>
  {plans.map((plan) => (
    <motion.div key={plan.id} variants={cardVariants} className="relative group">
      {/* existing card content — keep exact same JSX inside */}
    </motion.div>
  ))}
</motion.div>
```

**IMPORTANT**: The inner `<div key={plan.id} className="relative group">` becomes `<motion.div>`. Keep all classNames and children unchanged.

### 3. Empty states — don't animate

Only animate when there are items. The empty state (`plans.length === 0` or `sessions.length === 0`) should NOT be wrapped in animation variants — just a plain fade:
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.4 }}
>
  {/* empty state content */}
</motion.div>
```

### 4. prefers-reduced-motion

Add this hook to BOTH pages at the top of the component:
```tsx
import { useReducedMotion } from 'framer-motion';

// Inside component:
const prefersReducedMotion = useReducedMotion();

// Then in variants, check:
const listVariants = {
  hidden: {},
  visible: { transition: prefersReducedMotion ? {} : { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: prefersReducedMotion ? {} : { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 28 }
  },
};
```

## Files to Modify

1. `src/app/(app)/campaigns/[slug]/sessions/page.tsx`
2. `src/app/(app)/campaigns/[slug]/encounters/page.tsx`

## Type-Checking

After changes:
```bash
npx tsc --noEmit
```

Should be 0 errors. Framer Motion v11 with Next.js 15 needs `'use client'` — both files already have it.

## Do NOT change

- Any component logic, tRPC calls, state management
- The Skeleton loading states (don't animate those)
- Session/encounter data fetching
- Any other pages not listed above
- shadcn/ui component internals
