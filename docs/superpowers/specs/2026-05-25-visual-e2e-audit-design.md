# Visual E2E Audit — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Overview

Three-part Playwright test suite covering visual correctness: component rendering in the dev museum, light-mode WCAG contrast, and responsive layout dimensions. Complements the existing axe + screenshot specs in `tests/ui/`.

## Goals

1. Assert all 12 card types, 8 icon placeholders, and 6 badge tones render with bounded dimensions — in both dark and light mode.
2. Assert every text/surface token pair in light mode meets WCAG AA contrast ratios via computed CSS + WCAG math.
3. Extend the existing axe sweep to cover light mode on live pages.
4. Assert card layout stays within column-appropriate width ranges at mobile/tablet/desktop breakpoints.
5. Clean up stale credentials (`VIC_EMAIL`, `DANA_EMAIL`) in the three existing UI test files.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `tests/ui/dev-components.ui.spec.ts` | **Create** | Component museum audit |
| `tests/ui/light-mode-contrast.ui.spec.ts` | **Create** | WCAG token contrast + live axe in light |
| `tests/ui/layout-integrity.ui.spec.ts` | **Extend** | Add responsive breakpoint section |
| `tests/ui/visual-regression.ui.spec.ts` | **Update** | Stale credential refs |
| `tests/ui/accessibility.ui.spec.ts` | **Update** | Stale credential refs |

---

## 1. `tests/ui/dev-components.ui.spec.ts`

### Auth
None. `/dev/*` pages are public.

### Helper
```typescript
async function injectLight(page: Page) {
  await page.evaluate(() => document.documentElement.classList.add('light'));
}
```

### describe: `dev/cards — component museum`

Navigate to `/dev/cards`. Assert each card type is visible and has a bounding box within bounds. Run once in dark, once after `injectLight`.

**Card selectors** (by section heading or component test-id fallback to first card in each section):

| Card | Section heading text | Width | Height |
|------|---------------------|-------|--------|
| WorldEntryCard | `WORLD ENTRY CARD` | 120–220 | 180–320 |
| CharacterCard | `CHARACTER CARD` | 220–420 | 280–480 |
| SpellCard | `SPELL CARD` | 220–420 | 200–500 |
| MonsterStatBlock | `MONSTER STAT BLOCK` | 280–560 | 400–1200 |
| MagicItemCard | `MAGIC ITEM CARD` | 220–420 | 200–450 |
| EntityCard | `ENTITY CARD` | 200–400 | 180–350 |
| NpcCard | `NPC CARD` | 220–420 | 200–380 |
| HomebrewContentCard | `HOMEBREW CONTENT CARD` | 200–420 | 180–380 |
| MechanicCard | `MECHANIC CARD` | 200–420 | 160–350 |
| StatBlockCard | `STAT BLOCK CARD` | 280–560 | 200–600 |
| PressureCard | `PRESSURE CARD` | 200–420 | 140–280 |
| EncounterCard | `ENCOUNTER CARD` | 200–420 | 180–350 |

Strategy: each section on `/dev/cards` is preceded by a `SectionHeading` containing an `<h2 class="label-overline">`. Locate by `page.getByRole('heading', { name: /SECTION TEXT/i })`, then `heading.locator('xpath=following::*[contains(@class,"card") or contains(@class,"stat-block")][1]')`. If the section heading is not found, the test skips with `test.skip(true, 'section not on dev/cards yet')` — not a failure.

### describe: `dev/icons — entity placeholders`

Navigate to `/dev/icons`. Eight entity placeholder squares:

| Label | Expected size |
|-------|--------------|
| NPC / Person | 80–300px each axis |
| Monster | 80–300px each axis |
| Location | 80–300px each axis |
| Magic Item | 80–300px each axis |
| Spell | 80–300px each axis |
| Faction / Org | 80–300px each axis |
| Sourcebook | 80–300px each axis |
| Weapon | 80–300px each axis |

Strategy: icons are CSS `mask-image` on `<span>` elements, not `<img>` tags. Locate each by its label text (`getByText('NPC / Person')` etc.), then grab the preceding sibling `<span>` via `.locator('xpath=preceding-sibling::span[1]')` or find the nearest container with a `mask-image` style. Assert `boundingBox.width >= 80` and `<= 300`.

### describe: `dev/icons — badge tones`

Six badge tones: AMBER, ARCANE, QUEST, DANGER, SUCCESS, NEUTRAL. In each theme:
- `getByText(tone)` — assert visible
- `boundingBox.height` in `18–48px`
- `boundingBox.width > 40px`

---

## 2. `tests/ui/light-mode-contrast.ui.spec.ts`

### describe: `token contrast audit — light mode`

Navigate to `/dev/design-system`. Inject `html.light`. For each pair below, append a hidden probe `<div>` to `document.body`, read computed `color` + `background-color`, remove probe, compute WCAG ratio.

**WCAG contrast formula (run in browser JS):**
```js
function wcagContrast(fg, bg) {
  const lum = (css) => {
    const [r, g, b] = css.match(/\d+/g).map(Number);
    return [r, g, b].reduce((acc, c, i) => {
      const s = c / 255;
      const lin = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      return acc + lin * [0.2126, 0.7152, 0.0722][i];
    }, 0);
  };
  const L1 = Math.max(lum(fg), lum(bg));
  const L2 = Math.min(lum(fg), lum(bg));
  return (L1 + 0.05) / (L2 + 0.05);
}
```

**Token pairs and thresholds:**

| Text token | Background token | Min ratio |
|------------|-----------------|-----------|
| `--q-text` | `--q-bg` | 4.5 |
| `--q-text` | `--q-surface-flat` | 4.5 |
| `--q-text` | `--q-surface-raised` | 4.5 |
| `--q-text` | `--q-surface-sunken` | 4.5 |
| `--q-text-dim` | `--q-bg` | 4.5 |
| `--q-text-dim` | `--q-surface-flat` | 4.5 |
| `--q-text-dim` | `--q-surface-raised` | 4.5 |
| `--q-text-faint` | `--q-bg` | 3.0 |
| `--q-text-faint` | `--q-surface-flat` | 3.0 |
| `--q-text-info` | `--q-bg` | 3.0 |
| `--q-text-info` | `--q-surface-flat` | 3.0 |
| `--q-text-info` | `--q-surface-raised` | 3.0 |
| `--q-text-warning` | `--q-bg` | 3.0 |
| `--q-text-warning` | `--q-surface-flat` | 3.0 |
| `--q-text-danger` | `--q-bg` | 4.5 |
| `--q-text-danger` | `--q-surface-flat` | 4.5 |

Each pair = one `test()` so failures are individually named and reportable.

**Test naming:** `contrast: --q-text on --q-surface-raised >= 4.5`

**Light inject timing:** inject `html.light` immediately after `waitForLoadState('domcontentloaded')`, before any probe runs.

### describe: `live pages axe — light mode`

Sign in as Blake (`QA_BLAKE_EMAIL`). Inject `html.light` after each navigation. Run axe with `wcag2a` + `wcag2aa` tags, filter to critical/serious only.

Pages:
- `/dashboard`
- `/campaigns`
- `/campaigns/${CAMPAIGN_SLUG}` (env: `QA_CAMPAIGN_SLUG ?? 'blakes-test-campaign'`)

One `test()` per page. Failure message lists violations with impact + description.

---

## 3. `tests/ui/layout-integrity.ui.spec.ts` — Extension

Add a new `test.describe('responsive breakpoints — card grids')` block.

Three viewport sizes tested:

| Viewport | Width px | NPC card width range | Campaign card width range |
|----------|----------|---------------------|--------------------------|
| mobile | 375 | 280–375 | 310–375 |
| tablet | 768 | 200–400 | 200–420 |
| desktop | 1280 | 150–420 | 200–480 |

**Per breakpoint test:**
1. `page.setViewportSize({ width, height: 800 })`
2. Sign in as Blake, navigate to `/campaigns/${CAMPAIGN_SLUG}/npcs`
3. `waitForLoadState('networkidle')`
4. Locate first NPC card (`.npc-card, [data-testid*="npc"], article` — first match)
5. Assert `boundingBox.width` within range
6. Navigate to `/campaigns`
7. Locate first campaign card
8. Assert width within range

No horizontal overflow check (already in existing layout spec).

---

## 4. Credential Updates

In `visual-regression.ui.spec.ts`, `layout-integrity.ui.spec.ts`, `accessibility.ui.spec.ts`:

| Old | New |
|-----|-----|
| `VIC_EMAIL` / `QA_VIC_EMAIL` / `vic@test.local` | `BLAKE_EMAIL` / `QA_BLAKE_EMAIL` / `blake@test.local` |
| `DANA_EMAIL` / `QA_DANA_EMAIL` / `dana@test.local` | `JORDAN_EMAIL` / `QA_JORDAN_EMAIL` / `jordan@test.local` |
| `vics-test-campaign` | `blakes-test-campaign` |

---

## Running the New Tests

```bash
# No auth required
$env:CI=$null; $env:BASE_URL='http://localhost:3847'
npx playwright test tests/ui/dev-components.ui.spec.ts

# Auth required — set QA_BLAKE_EMAIL + QA_TEST_PASSWORD
npx playwright test tests/ui/light-mode-contrast.ui.spec.ts

# Full UI suite
npx playwright test tests/ui/
```

First run of `dev-components` may reveal cards not yet added to `/dev/cards` — those tests skip with a warning, not a failure.

---

## Definition of Done

- All 16 contrast pairs pass `>= threshold` in light mode
- All 12 card types visible with bounded dimensions in both themes
- All 8 icon placeholders `>= 80px` each axis
- All 6 badge tones visible `18–48px` height in both themes
- Responsive layout within column ranges at all 3 breakpoints
- No critical/serious axe violations on 3 live pages in light mode
- Stale credentials updated in 3 existing files
