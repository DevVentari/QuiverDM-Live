# Portal Login Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the plain auth layout with a full-screen cinematic portal scene — layered CSS parallax, amber glowing portal ring, floating particles, login form centered inside.

**Architecture:** A new `PortalScene` client component handles all parallax layers via `mousemove` + `requestAnimationFrame` lerp. The auth layout becomes a full-screen pass-through. Sign-in and sign-up pages wrap their existing forms in `PortalScene`. No changes to form internals.

**Tech Stack:** React, Framer Motion (already installed), Tailwind CSS, CSS keyframe animations, `useRef` / `useEffect` for mouse tracking.

**Design doc:** `docs/plans/2026-03-09-portal-login-design.md`

---

## Prerequisites

Add the background image before starting:
- Place any dark atmospheric fantasy image at `public/images/login-bg.jpg`
- Recommended dimensions: 1920×1080 or larger
- Suggested AI prompt: *"two ancient stone guardian statues flanking a misty stone archway, dark fantasy dungeon entrance, candlelit atmosphere, dramatic cinematic lighting, wide angle, no UI, no text"*
- A placeholder dark image works fine for development — swap it later

---

### Task 1: Strip auth layout to full-screen pass-through

**Files:**
- Modify: `src/app/(auth)/layout.tsx`

**Step 1: Read the current file**

Current content is a centered flex wrapper. We need to remove all centering so `PortalScene` can be full-screen.

**Step 2: Replace with pass-through**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Step 3: Verify visually**

Run `npm run dev`, navigate to `/auth/signin` — the form will now be top-left (broken layout). That's expected. The scene component in Task 2 will fix it.

**Step 4: Commit**

```bash
git add src/app/(auth)/layout.tsx
git commit -m "refactor(auth): strip layout to full-screen pass-through for portal scene"
```

---

### Task 2: Create the PortalScene component

**Files:**
- Create: `src/components/auth/portal-scene.tsx`

**Step 1: Create the file with skeleton**

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface PortalSceneProps {
  children: React.ReactNode;
}

export function PortalScene({ children }: PortalSceneProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      {children}
    </div>
  );
}
```

**Step 2: Verify the form centers correctly**

Navigate to `/auth/signin` — form should be centered, full screen, plain black background.

**Step 3: Add background image layer**

Replace the outer div content with layered structure:

```tsx
'use client';

import { useEffect, useRef, useReducedMotion } from 'react';

// Particle data — fixed positions so no hydration mismatch
const PARTICLES = [
  { id: 1, left: '15%', delay: '0s', duration: '6s', size: 3, opacity: 0.5 },
  { id: 2, left: '22%', delay: '1.2s', duration: '8s', size: 2, opacity: 0.3 },
  { id: 3, left: '35%', delay: '0.4s', duration: '7s', size: 4, opacity: 0.6 },
  { id: 4, left: '48%', delay: '2s', duration: '5s', size: 2, opacity: 0.4 },
  { id: 5, left: '55%', delay: '0.8s', duration: '9s', size: 3, opacity: 0.5 },
  { id: 6, left: '63%', delay: '1.6s', duration: '6.5s', size: 2, opacity: 0.3 },
  { id: 7, left: '72%', delay: '0.2s', duration: '7.5s', size: 4, opacity: 0.55 },
  { id: 8, left: '80%', delay: '2.4s', duration: '8s', size: 2, opacity: 0.35 },
  { id: 9, left: '88%', delay: '1s', duration: '6s', size: 3, opacity: 0.45 },
  { id: 10, left: '10%', delay: '3s', duration: '10s', size: 2, opacity: 0.3 },
  { id: 11, left: '42%', delay: '1.8s', duration: '7s', size: 3, opacity: 0.4 },
  { id: 12, left: '92%', delay: '0.6s', duration: '8.5s', size: 2, opacity: 0.35 },
];

interface PortalSceneProps {
  children: React.ReactNode;
}

export function PortalScene({ children }: PortalSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerBgRef = useRef<HTMLDivElement>(null);
  const layerFogRef = useRef<HTMLDivElement>(null);
  const layerRingRef = useRef<HTMLDivElement>(null);
  const layerFormRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const container = containerRef.current;
    if (!container) return;

    function onMouseMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      // Normalize to -1..1 from center
      mouseRef.current = {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
      };
    }

    function tick() {
      const lerp = 0.06;
      currentRef.current.x += (mouseRef.current.x - currentRef.current.x) * lerp;
      currentRef.current.y += (mouseRef.current.y - currentRef.current.y) * lerp;

      const mx = currentRef.current.x;
      const my = currentRef.current.y;

      // Each layer moves at different magnitude — creates depth illusion
      if (layerBgRef.current) {
        layerBgRef.current.style.transform = `translate(${mx * -18}px, ${my * -10}px) scale(1.06)`;
      }
      if (layerFogRef.current) {
        layerFogRef.current.style.transform = `translate(${mx * -10}px, ${my * -6}px)`;
      }
      if (layerRingRef.current) {
        layerRingRef.current.style.transform = `translate(${mx * -6}px, ${my * -4}px)`;
      }
      if (layerFormRef.current) {
        layerFormRef.current.style.transform = `translate(${mx * 8}px, ${my * 5}px)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    container.addEventListener('mousemove', onMouseMove);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      container.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [reduced]);

  return (
    <div
      ref={containerRef}
      className="portal-scene relative min-h-screen w-full overflow-hidden flex items-center justify-center dark"
    >
      {/* Layer 1: Background image */}
      <div
        ref={layerBgRef}
        className="absolute inset-[-6%] bg-cover bg-center bg-no-repeat will-change-transform"
        style={{ backgroundImage: "url('/images/login-bg.jpg')" }}
      />

      {/* Layer 2: Atmospheric fog */}
      <div
        ref={layerFogRef}
        className="portal-fog absolute inset-0 will-change-transform pointer-events-none"
      />

      {/* Layer 3: Vignette — static, always dark edges */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, hsl(240 10% 4% / 0.85) 100%)',
        }}
      />

      {/* Layer 4: Portal ring */}
      <div
        ref={layerRingRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none will-change-transform"
      >
        <div className="portal-ring" aria-hidden="true">
          <div className="portal-ring-inner" />
        </div>
      </div>

      {/* Layer 5: Particles */}
      {!reduced && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {PARTICLES.map((p) => (
            <span
              key={p.id}
              className="portal-particle absolute bottom-0 rounded-full"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animationDelay: p.delay,
                animationDuration: p.duration,
                background: `hsl(35 80% ${55 + Math.floor(p.id * 3) % 20}%)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Layer 6: Login form */}
      <div
        ref={layerFormRef}
        className={`relative z-10 will-change-transform ${reduced ? '' : 'portal-form-float'}`}
      >
        {children}
      </div>
    </div>
  );
}
```

**Step 4: Verify component renders**

Navigate to `/auth/signin` — you'll see the form centered, black background (image not yet styled), no animations yet. That's expected.

**Step 5: Commit skeleton**

```bash
git add src/components/auth/portal-scene.tsx
git commit -m "feat(auth): add PortalScene component skeleton with parallax layers"
```

---

### Task 3: Add portal CSS animations to globals.css

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add the portal keyframes and utility classes at the end of globals.css**

```css
/* ─── Portal Login Scene ────────────────────────────────────────────────── */

.portal-fog {
  background: radial-gradient(
    ellipse 60% 55% at 50% 55%,
    hsl(35 40% 20% / 0.18) 0%,
    hsl(240 20% 8% / 0.45) 60%,
    transparent 100%
  );
  animation: fog-breathe 8s ease-in-out infinite;
}

@keyframes fog-breathe {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

/* Portal ring — oval arch shape */
.portal-ring {
  position: relative;
  width: 380px;
  height: 500px;
  border-radius: 50%;
  animation: portal-pulse 3s ease-in-out infinite;
}

.portal-ring::before {
  content: '';
  position: absolute;
  inset: -18px;
  border-radius: 50%;
  background: transparent;
  box-shadow:
    0 0 60px 20px hsl(35 80% 55% / 0.15),
    0 0 120px 40px hsl(35 80% 55% / 0.08),
    0 0 200px 80px hsl(35 60% 40% / 0.05);
  animation: portal-glow-outer 3s ease-in-out infinite;
}

.portal-ring-inner {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid hsl(35 80% 55% / 0.55);
  box-shadow:
    inset 0 0 30px hsl(35 80% 55% / 0.12),
    0 0 20px hsl(35 80% 55% / 0.3),
    0 0 40px hsl(35 80% 55% / 0.15);
}

@keyframes portal-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.012); }
}

@keyframes portal-glow-outer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Floating ember particles */
.portal-particle {
  animation: ember-rise linear infinite;
}

@keyframes ember-rise {
  0% {
    transform: translateY(0) translateX(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  80% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-100vh) translateX(calc(sin(1rad) * 40px));
    opacity: 0;
  }
}

/* Login form float */
.portal-form-float {
  animation: portal-float 4s ease-in-out infinite;
}

@keyframes portal-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-7px); }
}
```

**Step 2: Verify animations apply**

Navigate to `/auth/signin` — you should see the fog layer breathing, portal ring ring glowing (even without image it'll show on black). Particles should float up.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(auth): add portal scene CSS keyframes and animation classes"
```

---

### Task 4: Wire PortalScene into sign-in page

**Files:**
- Modify: `src/app/(auth)/auth/signin/page.tsx`

**Step 1: Update the page**

```tsx
import { Metadata } from 'next';
import { SignInForm } from './signin-form';
import { Suspense } from 'react';
import { PortalScene } from '@/components/auth/portal-scene';

export const metadata: Metadata = {
  title: 'Sign In — QuiverDM',
  description: 'Sign in to your QuiverDM account.',
};

export default function SignInPage() {
  return (
    <PortalScene>
      <Suspense>
        <SignInForm />
      </Suspense>
    </PortalScene>
  );
}
```

**Step 2: Verify visually**

Navigate to `/auth/signin` — form should be centered inside the portal ring with the background image showing, fog breathing, particles rising, form floating gently.

**Step 3: Test mouse parallax**

Move your mouse around the page. The background should drift opposite to cursor movement, the form should drift slightly with it. Subtle but visible.

**Step 4: Commit**

```bash
git add src/app/(auth)/auth/signin/page.tsx
git commit -m "feat(auth): wrap sign-in page in PortalScene"
```

---

### Task 5: Apply same treatment to sign-up page

**Files:**
- Modify: `src/app/(auth)/auth/signup/page.tsx`

**Step 1: Update the page**

```tsx
import { Metadata } from 'next';
import { SignUpForm } from './signup-form';
import { PortalScene } from '@/components/auth/portal-scene';

export const metadata: Metadata = {
  title: 'Create Account — QuiverDM',
  description: 'Create your QuiverDM account and start managing your D&D campaigns.',
};

export default function SignUpPage() {
  return (
    <PortalScene>
      <SignUpForm />
    </PortalScene>
  );
}
```

**Step 2: Verify visually**

Navigate to `/auth/signup` — same portal scene, sign-up form inside.

**Step 3: Commit**

```bash
git add src/app/(auth)/auth/signup/page.tsx
git commit -m "feat(auth): wrap sign-up page in PortalScene"
```

---

### Task 6: Style the login card to match the portal aesthetic

**Files:**
- Modify: `src/app/(auth)/auth/signin/signin-form.tsx`

The `SignInForm` currently uses a plain `Card`. We want it to feel like it's inside the portal — darker glass, amber accents, slightly wider.

**Step 1: Update the Card wrapper**

Find the Card element at `signin-form.tsx:45`:

```tsx
// Before
<Card className="w-full max-w-md">

// After
<Card className="w-full max-w-sm glass-panel border-border/30 shadow-2xl shadow-black/50">
```

**Step 2: Verify**

The form card should now have the glass-panel treatment against the portal background — looks like it's floating inside the gate.

**Step 3: Commit**

```bash
git add src/app/(auth)/auth/signin/signin-form.tsx
git commit -m "feat(auth): apply glass-panel style to sign-in card for portal aesthetic"
```

---

### Task 7: Verify reduced motion and mobile

**Step 1: Test reduced motion**

In browser DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`. Navigate to `/auth/signin`.

Expected: No animations, no parallax, form is statically centered, portal ring is visible but static, no particles.

**Step 2: Test mobile viewport**

DevTools → Toggle device toolbar → iPhone SE (375px wide).

Expected: Portal ring should still be visible, form should not overflow horizontally. If the ring is too wide, add this to globals.css:

```css
@media (max-width: 480px) {
  .portal-ring {
    width: 300px;
    height: 400px;
  }
}
```

**Step 3: Test forgot password and other auth pages**

Navigate to `/auth/forgot-password` and `/auth/reset-password` routes — they use the same auth layout so they'll also be full-screen without the portal. That's acceptable as they're secondary flows.

**Step 4: Final commit if any fixes made**

```bash
git add -A
git commit -m "fix(auth): portal scene responsive and reduced motion adjustments"
```

---

### Task 8: Provide background image guidance

**Step 1: Add placeholder note to public directory**

If no image exists yet, create a simple placeholder CSS gradient fallback in PortalScene so it doesn't show a broken state. Find the background image div in `portal-scene.tsx` and add a fallback:

```tsx
// In the background layer div, add fallback gradient
style={{
  backgroundImage: "url('/images/login-bg.jpg')",
  background: "url('/images/login-bg.jpg') center/cover no-repeat, linear-gradient(160deg, hsl(240 15% 8%) 0%, hsl(25 20% 10%) 50%, hsl(240 10% 6%) 100%)",
}}
```

This ensures the scene looks atmospheric even before the image is placed.

**Step 2: Source the background image**

Options:
- Generate via fal.ai: use prompt from design doc
- Use any dark fantasy art (stone gateway, dungeon entrance, etc.)
- Free option: search Unsplash for "stone archway dark fantasy"
- Place at: `public/images/login-bg.jpg`

**Step 3: Commit**

```bash
git add src/components/auth/portal-scene.tsx
git commit -m "feat(auth): add CSS fallback gradient for portal scene before image is placed"
```

---

## Final Verification

1. `/auth/signin` — portal scene, form inside ring, parallax on mouse, particles floating
2. `/auth/signup` — same scene, sign-up form
3. Mouse parallax smooth and subtle
4. Reduced motion: static, no animations
5. Mobile: centered, no overflow
6. `npm run build` — no TypeScript errors
