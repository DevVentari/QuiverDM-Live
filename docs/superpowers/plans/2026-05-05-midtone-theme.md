# Ashwood Midtone Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current near-black dark theme with the Ashwood Midtone palette — background lifted from `oklch(0.12 0.005 265)` to `oklch(0.28 0.008 60)`.

**Architecture:** Single-file CSS change to `src/app/globals.css`. Two layers updated: (1) CSS custom property tokens in the `.dark` block, (2) hardcoded colour values in utility classes. No component files touched.

**Tech Stack:** CSS oklch + HSL, Tailwind `@layer utilities`, `@supports` progressive enhancement

---

## File Map

- Modify: `src/app/globals.css`
  - Lines 32–61: `.dark` HSL custom properties
  - Lines 86–106: `.dark` oklch custom properties (inside `@supports`)
  - Lines 115–126: `body` background-image gradients
  - Lines 166–170: `.dashboard-bg`
  - Lines 172–175: `.glass-shell`
  - Lines 177–181: `.glass-panel`
  - Lines 183–186: `.glass-row`
  - Lines 250–257: `.label-overline`
  - Lines 281–286: `.stone-card`
  - Lines 289–295: `.stone-card-header`
  - Lines 298–305: `.stone-card-title`
  - Lines 313–319: `.stat-value`
  - Lines 321–328: `.stat-label`
  - Lines 197–202: `.hero-glow`
  - Lines 204–209: `.landing-bg`

Spec: `docs/superpowers/specs/2026-05-05-midtone-theme-design.md`

---

### Task 1: Update `.dark` HSL custom property block

**Files:**
- Modify: `src/app/globals.css:32-61`

- [ ] **Step 1: Replace the HSL `.dark` block**

Replace lines 32–61 (the first `.dark { ... }` block, ending at line 61):

```css
  .dark {
    --background: hsl(32 7% 18%);
    --foreground: hsl(35 8% 93%);
    --card: hsl(32 6% 22% / 0.7);
    --card-foreground: hsl(35 8% 93%);
    --popover: hsl(32 7% 20% / 0.92);
    --popover-foreground: hsl(35 8% 93%);
    --primary: hsl(35 80% 55%);
    --primary-foreground: hsl(32 8% 8%);
    --secondary: hsl(32 6% 23% / 0.6);
    --secondary-foreground: hsl(35 8% 93%);
    --muted: hsl(32 6% 23% / 0.5);
    --muted-foreground: hsl(32 5% 60%);
    --accent: hsl(33 12% 21%);
    --accent-foreground: hsl(35 65% 78%);
    --destructive: hsl(0 62% 50%);
    --destructive-foreground: hsl(240 5% 96%);
    --border: hsl(35 8% 80% / 0.12);
    --input: hsl(35 8% 80% / 0.22);
    --ring: hsl(35 80% 55%);

    --card-stone-bg: linear-gradient(180deg, hsl(32 6% 22%) 0%, hsl(32 6% 20%) 100%);
    --card-stone-inset: inset 0 1px 0 hsl(35 60% 50% / 0.07);
    --card-amber: hsl(35, 80%, 55%);
    --card-amber-light: hsl(35, 80%, 68%);
    --card-stone-border: hsl(33, 12%, 28%);
    --card-stone-border-hi: hsl(33, 16%, 34%);
    --card-text-muted: hsl(32, 7%, 56%);
  }
```

- [ ] **Step 2: Verify syntax — run build check**

```bash
npx tsc --noEmit
```

Expected: zero type errors (CSS-only change, TypeScript won't error here, but confirms the build toolchain is happy).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update .dark HSL token block to Ashwood midtone palette"
```

---

### Task 2: Update `.dark` oklch custom property block

**Files:**
- Modify: `src/app/globals.css:86-106`

- [ ] **Step 1: Replace the oklch `.dark` block inside `@supports`**

Replace lines 86–106 (the `.dark { ... }` inside `@supports (color: oklch(0 0 0)) { ... }`):

```css
    .dark {
      --background: oklch(0.28 0.008 60);
      --foreground: oklch(0.94 0.005 60);
      --card: oklch(0.33 0.007 60 / 0.7);
      --card-foreground: oklch(0.94 0.005 60);
      --popover: oklch(0.31 0.007 60 / 0.92);
      --popover-foreground: oklch(0.94 0.005 60);
      --primary: oklch(0.70 0.16 55);
      --primary-foreground: oklch(0.15 0.01 60);
      --secondary: oklch(0.36 0.006 60 / 0.6);
      --secondary-foreground: oklch(0.94 0.005 60);
      --muted: oklch(0.36 0.006 60 / 0.5);
      --muted-foreground: oklch(0.68 0.006 60);
      --accent: oklch(0.33 0.018 55);
      --accent-foreground: oklch(0.80 0.13 55);
      --destructive: oklch(0.55 0.22 25);
      --destructive-foreground: oklch(0.96 0.003 265);
      --border: oklch(0.85 0.008 60 / 0.12);
      --input: oklch(0.85 0.008 60 / 0.22);
      --ring: oklch(0.70 0.16 55);
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update .dark oklch token block to Ashwood midtone palette"
```

---

### Task 3: Update `body` background gradients

**Files:**
- Modify: `src/app/globals.css:115-126`

- [ ] **Step 1: Replace the `body` background-image property**

The current `body` rule (lines 115–126) has these background-image lines:

```css
    background-image:
      /* Warm amber glow from upper-left (candlelight) */
      radial-gradient(ellipse 60% 50% at 25% -10%, hsl(35 70% 15% / 0.7), transparent),
      /* Cool purple glow from upper-right (mystical) */
      radial-gradient(ellipse 50% 45% at 75% -5%, hsl(258 40% 12% / 0.6), transparent),
      /* Faint amber warmth from bottom-center */
      radial-gradient(ellipse 70% 40% at 50% 110%, hsl(35 50% 10% / 0.4), transparent),
      /* Base near-black */
      linear-gradient(hsl(240 10% 4%), hsl(240 10% 4%));
```

Replace just the `background-image` value (keep `@apply bg-background text-foreground;` untouched):

```css
    background-image:
      radial-gradient(ellipse 60% 50% at 25% -10%, hsl(33 40% 22% / 0.5), transparent),
      radial-gradient(ellipse 50% 45% at 75% -5%,  hsl(258 25% 22% / 0.35), transparent),
      radial-gradient(ellipse 70% 40% at 50% 110%, hsl(33 30% 18% / 0.3), transparent),
      linear-gradient(hsl(32 7% 18%), hsl(32 7% 18%));
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update body background gradients for Ashwood midtone base"
```

---

### Task 4: Update glass utilities

**Files:**
- Modify: `src/app/globals.css:166-186`

- [ ] **Step 1: Replace `.dashboard-bg`**

Current (lines 166–170):
```css
  .dashboard-bg {
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, hsl(258 40% 12% / 0.6), transparent),
      radial-gradient(ellipse 60% 40% at 80% 100%, hsl(35 40% 10% / 0.4), transparent);
  }
```

Replace with:
```css
  .dashboard-bg {
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, hsl(258 25% 22% / 0.4), transparent),
      radial-gradient(ellipse 60% 40% at 80% 100%, hsl(33 30% 18% / 0.3), transparent);
  }
```

- [ ] **Step 2: Replace `.glass-shell`**

Current (lines 172–175):
```css
  .glass-shell {
    background-color: hsl(240 10% 8% / 0.4);
    backdrop-filter: blur(12px);
  }
```

Replace with:
```css
  .glass-shell {
    background-color: hsl(32 8% 14% / 0.5);
    backdrop-filter: blur(12px);
  }
```

- [ ] **Step 3: Replace `.glass-panel`**

Current (lines 177–181):
```css
  .glass-panel {
    background-color: hsl(240 10% 8% / 0.42);
    backdrop-filter: blur(10px);
    border-color: hsl(240 20% 85% / 0.09);
  }
```

Replace with:
```css
  .glass-panel {
    background-color: hsl(32 7% 18% / 0.55);
    backdrop-filter: blur(10px);
    border-color: hsl(35 8% 80% / 0.10);
  }
```

- [ ] **Step 4: Replace `.glass-row`**

Current (lines 183–186):
```css
  .glass-row {
    background-color: hsl(240 10% 8% / 0.3);
    border-color: hsl(240 20% 85% / 0.07);
  }
```

Replace with:
```css
  .glass-row {
    background-color: hsl(32 7% 18% / 0.4);
    border-color: hsl(35 8% 80% / 0.07);
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update glass + dashboard utilities to Ashwood midtone"
```

---

### Task 5: Update `.label-overline`

**Files:**
- Modify: `src/app/globals.css:250-257`

- [ ] **Step 1: Replace the `color` value**

Current (lines 250–257):
```css
  .label-overline {
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: hsl(35 80% 55% / 0.4);
    line-height: 1;
  }
```

Replace with:
```css
  .label-overline {
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: hsl(35 80% 55% / 0.45);
    line-height: 1;
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update label-overline opacity to 0.45 for Ashwood midtone"
```

---

### Task 6: Update stone design system utilities

**Files:**
- Modify: `src/app/globals.css:281-328`

- [ ] **Step 1: Replace `.stone-card`**

Current (lines 281–286):
```css
.stone-card {
  background: linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%);
  box-shadow: inset 0 1px 0 hsl(35 60% 50% / 0.07);
  border: 1px solid hsl(35 35% 18%);
  border-radius: 3px;
}
```

Replace with:
```css
.stone-card {
  background: linear-gradient(180deg, hsl(32 6% 22%) 0%, hsl(32 6% 20%) 100%);
  box-shadow: inset 0 1px 0 hsl(35 60% 50% / 0.07);
  border: 1px solid hsl(33 12% 26%);
  border-radius: 3px;
}
```

- [ ] **Step 2: Replace `.stone-card-header` border**

Current (lines 289–295):
```css
.stone-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 16px 9px;
  border-bottom: 1px solid hsl(35 35% 18%);
}
```

Replace with:
```css
.stone-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 16px 9px;
  border-bottom: 1px solid hsl(33 12% 26%);
}
```

- [ ] **Step 3: Replace `.stone-card-title` color**

Current (lines 298–305):
```css
.stone-card-title {
  font-family: var(--font-cinzel);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(35 30% 60%);
}
```

Replace with:
```css
.stone-card-title {
  font-family: var(--font-cinzel);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(33 20% 62%);
}
```

- [ ] **Step 4: Replace `.stat-value` color**

Current (lines 313–319):
```css
.stat-value {
  font-family: var(--font-cinzel);
  font-size: 1.5rem;
  font-weight: 700;
  color: hsl(35 80% 62%);
  line-height: 1;
}
```

Replace with:
```css
.stat-value {
  font-family: var(--font-cinzel);
  font-size: 1.5rem;
  font-weight: 700;
  color: hsl(35 80% 65%);
  line-height: 1;
}
```

- [ ] **Step 5: Replace `.stat-label` color**

Current (lines 321–328):
```css
.stat-label {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(35 10% 50%);
  margin-top: 3px;
}
```

Replace with:
```css
.stat-label {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(33 8% 52%);
  margin-top: 3px;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update stone design system colours to Ashwood midtone"
```

---

### Task 7: Update atmosphere utilities (landing-bg, hero-glow)

**Files:**
- Modify: `src/app/globals.css:197-209`

- [ ] **Step 1: Replace `.hero-glow`**

Current (lines 197–202):
```css
  .hero-glow {
    background:
      radial-gradient(ellipse 70% 60% at 50% -5%, hsl(35 80% 55% / 0.18), transparent),
      radial-gradient(ellipse 50% 40% at 80% 110%, hsl(258 40% 20% / 0.3), transparent),
      radial-gradient(ellipse 50% 40% at 20% 110%, hsl(35 60% 10% / 0.25), transparent);
  }
```

Replace with:
```css
  .hero-glow {
    background:
      radial-gradient(ellipse 70% 60% at 50% -5%,  hsl(35 80% 55% / 0.15), transparent),
      radial-gradient(ellipse 50% 40% at 80% 110%, hsl(258 30% 25% / 0.25), transparent),
      radial-gradient(ellipse 50% 40% at 20% 110%, hsl(33 40% 18% / 0.2), transparent);
  }
```

- [ ] **Step 2: Replace `.landing-bg`**

Current (lines 204–209):
```css
  .landing-bg {
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, hsl(258 40% 12% / 0.7), transparent),
      radial-gradient(ellipse 60% 40% at 80% 100%, hsl(35 40% 10% / 0.5), transparent),
      radial-gradient(ellipse 60% 40% at 20% 90%, hsl(258 30% 8% / 0.3), transparent);
  }
```

Replace with:
```css
  .landing-bg {
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, hsl(258 25% 22% / 0.5), transparent),
      radial-gradient(ellipse 60% 40% at 80% 100%, hsl(33 30% 18% / 0.4), transparent),
      radial-gradient(ellipse 60% 40% at 20% 90%,  hsl(258 20% 18% / 0.2), transparent);
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update landing-bg and hero-glow for Ashwood midtone atmosphere"
```

---

### Task 8: Build verify and push

**Files:** none (verification only)

- [ ] **Step 1: Full TypeScript build check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Next.js production build check**

```bash
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 3: Visual spot-check**

Start the dev server (`npm run dev` on port 3847) and verify:
- Dashboard background is visibly lighter (warm grey-brown, not near-black)
- Sidebar uses the darker shell tone (`hsl(32 8% 14%)`)
- Cards are readable with distinct surface vs background contrast
- Amber accent unchanged and still pops against the new background
- Landing page glow is subtle, not overblown

- [ ] **Step 4: Push**

```bash
git push origin main
```
