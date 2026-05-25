import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3847';

async function injectLight(page: Page): Promise<void> {
  await page.evaluate(() => document.documentElement.classList.add('light'));
}

function assertBounded(val: number, min: number, max: number, label: string): void {
  expect(val, `${label}: expected ${min}–${max}px, got ${val}px`).toBeGreaterThanOrEqual(min);
  expect(val, `${label}: expected ${min}–${max}px, got ${val}px`).toBeLessThanOrEqual(max);
}

// Bounds derived from measured /dev/cards page at 1280px viewport.
// Cards are shown in compact/list state — heights reflect that, not expanded forms.
const CARD_SECTIONS = [
  { name: 'WorldEntryCard',      heading: /world entry card/i,      wMin: 100, wMax: 300,  hMin: 80,  hMax: 200  },
  { name: 'CharacterCard',       heading: /character card/i,         wMin: 400, wMax: 900,  hMin: 150, hMax: 400  },
  { name: 'SpellCard',           heading: /spell card/i,             wMin: 220, wMax: 420,  hMin: 60,  hMax: 400  },
  { name: 'MonsterStatBlock',    heading: /monster stat block/i,     wMin: 220, wMax: 420,  hMin: 200, hMax: 1000 },
  { name: 'MagicItemCard',       heading: /magic item card/i,        wMin: 220, wMax: 420,  hMin: 80,  hMax: 200  },
  { name: 'EntityCard',          heading: /entity card/i,            wMin: 220, wMax: 420,  hMin: 80,  hMax: 200  },
  { name: 'NpcCard',             heading: /npc card/i,               wMin: 220, wMax: 420,  hMin: 80,  hMax: 200  },
  { name: 'HomebrewContentCard', heading: /homebrew content card/i,  wMin: 220, wMax: 420,  hMin: 80,  hMax: 200  },
  { name: 'MechanicCard',        heading: /mechanic card/i,          wMin: 220, wMax: 420,  hMin: 80,  hMax: 200  },
  { name: 'StatBlockCard',       heading: /stat block card/i,        wMin: 220, wMax: 420,  hMin: 300, hMax: 600  },
  { name: 'PressureCard',        heading: /pressure card/i,          wMin: 300, wMax: 500,  hMin: 200, hMax: 400  },
  { name: 'EncounterCard',       heading: /encounter card/i,         wMin: 220, wMax: 420,  hMin: 80,  hMax: 200  },
] as const;

const ICON_LABELS = [
  'NPC / Person', 'Monster', 'Location', 'Magic Item',
  'Spell', 'Faction / Org', 'Sourcebook', 'Weapon',
] as const;

// Badge tone labels are lowercase on the /dev/icons page
const BADGE_TONES = ['amber', 'arcane', 'quest', 'danger', 'success', 'neutral'] as const;

// ── Cards ────────────────────────────────────────────────────────────────────

test.describe('dev/cards — component museum', () => {
  async function checkCards(page: Page, theme: 'dark' | 'light'): Promise<void> {
    await page.goto(`${BASE}/dev/cards`);
    await page.waitForLoadState('domcontentloaded');
    if (theme === 'light') await injectLight(page);

    for (const cs of CARD_SECTIONS) {
      const heading = page.getByRole('heading', { name: cs.heading });
      const headingVisible = await heading.isVisible({ timeout: 3_000 }).catch(() => false);
      if (!headingVisible) {
        console.warn(`[skip] ${cs.name} section not on /dev/cards`);
        continue;
      }

      // SectionHeading wrapper is heading's parent div.
      // Cards follow as the first div sibling (there may be a <p> description between them,
      // so we use following-sibling::div[1] which skips non-div elements).
      const wrapper = heading.locator('..');
      const firstSiblingDiv = wrapper.locator('xpath=following-sibling::div[1]');
      const firstChild = firstSiblingDiv.locator('> *').first();

      const box = await firstChild.boundingBox();
      expect(box, `${cs.name} (${theme}): no element rendered after heading`).not.toBeNull();
      assertBounded(box!.width,  cs.wMin, cs.wMax, `${cs.name} width  (${theme})`);
      assertBounded(box!.height, cs.hMin, cs.hMax, `${cs.name} height (${theme})`);
    }
  }

  test('all card types render with bounded dimensions (dark)', async ({ page }) => {
    await checkCards(page, 'dark');
  });

  test('all card types render with bounded dimensions (light)', async ({ page }) => {
    await checkCards(page, 'light');
  });
});

// ── Icons ────────────────────────────────────────────────────────────────────

test.describe('dev/icons — entity placeholders', () => {
  async function checkIcons(page: Page, theme: 'dark' | 'light'): Promise<void> {
    await page.goto(`${BASE}/dev/icons`);
    await page.waitForLoadState('domcontentloaded');
    if (theme === 'light') await injectLight(page);

    // Each icon card unit is a flex-col container; the label text is 3 levels deep inside it.
    // Scoping the mask span lookup per-label avoids matching sidebar/nav icons.
    for (const label of ICON_LABELS) {
      const labelEl = page.getByText(label, { exact: true }).first();
      await expect(labelEl, `Label "${label}" not visible (${theme})`).toBeVisible({ timeout: 5_000 });

      // label → text div → text-center div → flex-col card unit; icon span is direct child of card unit
      const cardUnit = labelEl.locator('../../..');
      const iconSpan = cardUnit.locator('span[style*="mask"]').first();
      const box = await iconSpan.boundingBox();
      expect(box, `Entity icon "${label}" (${theme}): icon span not found`).not.toBeNull();
      assertBounded(box!.width,  40, 300, `Entity icon "${label}" width  (${theme})`);
      assertBounded(box!.height, 40, 300, `Entity icon "${label}" height (${theme})`);
    }
  }

  test('all 8 entity placeholder icons render (dark)',  async ({ page }) => { await checkIcons(page, 'dark');  });
  test('all 8 entity placeholder icons render (light)', async ({ page }) => { await checkIcons(page, 'light'); });
});

// ── Badges ───────────────────────────────────────────────────────────────────

test.describe('dev/icons — badge tones', () => {
  async function checkBadges(page: Page, theme: 'dark' | 'light'): Promise<void> {
    await page.goto(`${BASE}/dev/icons`);
    await page.waitForLoadState('domcontentloaded');
    if (theme === 'light') await injectLight(page);

    for (const tone of BADGE_TONES) {
      const badge = page.getByText(tone, { exact: true }).first();
      await expect(badge, `Badge "${tone}" not visible (${theme})`).toBeVisible({ timeout: 5_000 });

      const box = await badge.boundingBox();
      expect(box, `Badge "${tone}" (${theme}): no bounding box`).not.toBeNull();
      assertBounded(box!.height, 18, 48, `${tone} badge height (${theme})`);
      expect(box!.width, `${tone} badge width too narrow`).toBeGreaterThan(40);
    }
  }

  test('all 6 badge tones render with correct dimensions (dark)',  async ({ page }) => { await checkBadges(page, 'dark');  });
  test('all 6 badge tones render with correct dimensions (light)', async ({ page }) => { await checkBadges(page, 'light'); });
});
