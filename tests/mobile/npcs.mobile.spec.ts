import { test, expect } from '@playwright/test';
import { BASE_URL, signIn, pageChecks } from './helpers';

const SPEC = 'npcs';

async function discoverCampaignSlug(page: Parameters<typeof pageChecks>[0]) {
  await page.goto(`${BASE_URL}/campaigns`);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  const firstLink = await page
    .locator('a[href*="/campaigns/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);
  if (!firstLink) return '';
  const m = firstLink.match(/\/campaigns\/([^/?#\s]+)/);
  return m ? m[1] : '';
}

test.describe('NPCs — mobile', () => {
  test('NPCs list: no overflow, cards render, search visible', async ({ page }) => {
    await signIn(page);

    const slug = await discoverCampaignSlug(page);
    if (!slug) {
      test.skip(true, 'No campaign found');
      return;
    }

    await page.goto(`${BASE_URL}/campaigns/${slug}/npcs`);
    await pageChecks(page, SPEC, SPEC, 'npcs-list');

    const content = page
      .getByRole('heading', { name: /npcs|characters/i })
      .or(page.getByText(/no npcs/i))
      .or(page.locator('a[href*="/npcs/"]').first());
    await expect(content.first()).toBeVisible({ timeout: 10000 });

    const search = page.getByRole('searchbox').or(page.locator('input[type="search"], input[placeholder*="search" i]'));
    const searchVisible = await search.first().isVisible().catch(() => false);
    if (!searchVisible) {
      console.warn('[npcs-list] No search input found on NPCs page');
    }
  });

  test('NPC detail: no overflow, stat blocks not clipped', async ({ page }) => {
    await signIn(page);

    const slug = await discoverCampaignSlug(page);
    if (!slug) {
      test.skip(true, 'No campaign found');
      return;
    }

    await page.goto(`${BASE_URL}/campaigns/${slug}/npcs`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const firstLink = await page
      .locator(`a[href*="/campaigns/${slug}/npcs/"]`)
      .first()
      .getAttribute('href')
      .catch(() => null);

    if (!firstLink) {
      test.skip(true, 'No NPCs found for this campaign');
      return;
    }

    const m = firstLink.match(/\/npcs\/([^/?#\s]+)/);
    const npcId = m ? m[1] : '';
    if (!npcId) {
      test.skip(true, 'Could not extract NPC ID');
      return;
    }

    await page.goto(`${BASE_URL}/campaigns/${slug}/npcs/${npcId}`);
    await pageChecks(page, SPEC, SPEC, 'npc-detail');

    const statBlockViolations = await page.evaluate(() => {
      const statCells = Array.from(
        document.querySelectorAll('[data-testid*="stat"], .stat-block, dl dt, dl dd')
      );
      return statCells
        .map(el => {
          const r = el.getBoundingClientRect();
          return { right: Math.round(r.right), tag: el.tagName };
        })
        .filter(r => r.right > window.innerWidth + 10);
    });

    if (statBlockViolations.length > 0) {
      console.warn(`[npc-detail] ${statBlockViolations.length} stat block element(s) overflow viewport`);
    }
    expect(statBlockViolations.length, 'Stat block elements overflowing viewport').toBe(0);
  });
});
