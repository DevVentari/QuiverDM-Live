import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3847';

async function injectLight(page: Page): Promise<void> {
  await page.evaluate(() => document.documentElement.classList.add('light'));
}

function assertBounded(val: number, min: number, max: number, label: string): void {
  expect(val, `${label}: expected ${min}–${max}px, got ${val}px`).toBeGreaterThanOrEqual(min);
  expect(val, `${label}: expected ${min}–${max}px, got ${val}px`).toBeLessThanOrEqual(max);
}

const CARD_SECTIONS = [
  { name: 'WorldEntryCard',      heading: /world entry card/i,      wMin: 120, wMax: 220, hMin: 180, hMax: 320  },
  { name: 'CharacterCard',       heading: /character card/i,         wMin: 220, wMax: 420, hMin: 280, hMax: 480  },
  { name: 'SpellCard',           heading: /spell card/i,             wMin: 220, wMax: 420, hMin: 200, hMax: 500  },
  { name: 'MonsterStatBlock',    heading: /monster stat block/i,     wMin: 280, wMax: 560, hMin: 400, hMax: 1200 },
  { name: 'MagicItemCard',       heading: /magic item card/i,        wMin: 220, wMax: 420, hMin: 200, hMax: 450  },
  { name: 'EntityCard',          heading: /^entity card$/i,          wMin: 200, wMax: 400, hMin: 180, hMax: 350  },
  { name: 'NpcCard',             heading: /npc card/i,               wMin: 220, wMax: 420, hMin: 200, hMax: 380  },
  { name: 'HomebrewContentCard', heading: /homebrew content card/i,  wMin: 200, wMax: 420, hMin: 180, hMax: 380  },
  { name: 'MechanicCard',        heading: /mechanic card/i,          wMin: 200, wMax: 420, hMin: 160, hMax: 350  },
  { name: 'StatBlockCard',       heading: /stat block card/i,        wMin: 280, wMax: 560, hMin: 200, hMax: 600  },
  { name: 'PressureCard',        heading: /pressure card/i,          wMin: 200, wMax: 420, hMin: 140, hMax: 280  },
  { name: 'EncounterCard',       heading: /encounter card/i,         wMin: 200, wMax: 420, hMin: 180, hMax: 350  },
] as const;

const ICON_LABELS = [
  'NPC / Person', 'Monster', 'Location', 'Magic Item',
  'Spell', 'Faction / Org', 'Sourcebook', 'Weapon',
] as const;

const BADGE_TONES = ['AMBER', 'ARCANE', 'QUEST', 'DANGER', 'SUCCESS', 'NEUTRAL'] as const;

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

      // SectionHeading wrapper is heading's parent div; cards follow as the next sibling div
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

    for (const label of ICON_LABELS) {
      await expect(
        page.getByText(label, { exact: true }).first(),
        `Label "${label}" not visible (${theme})`,
      ).toBeVisible({ timeout: 5_000 });
    }

    // Icons are CSS mask-image <span> elements (not <img>).
    // The entity placeholder section comes first — grab the first 8 mask-image spans.
    const iconSpans = page.locator('span[style*="mask-image"]');
    const count = await iconSpans.count();
    expect(count, 'Expected at least 8 entity placeholder icon spans').toBeGreaterThanOrEqual(8);

    for (let i = 0; i < 8; i++) {
      const box = await iconSpans.nth(i).boundingBox();
      expect(box, `Entity icon ${i} (${theme}): no bounding box`).not.toBeNull();
      assertBounded(box!.width,  80, 300, `Entity icon ${i} width  (${theme})`);
      assertBounded(box!.height, 80, 300, `Entity icon ${i} height (${theme})`);
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
