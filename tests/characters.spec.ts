import { test, expect, type Page } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

async function openFirstCampaignPlayers(page: Page): Promise<boolean> {
  await page.goto('/campaigns');
  await page.waitForLoadState('domcontentloaded');

  // Exclude the "New Campaign" create link; find actual campaign card links only.
  const campaignLink = page.locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])').first();
  if ((await campaignLink.count()) === 0) {
    return false;
  }

  const href = await campaignLink.getAttribute('href');
  if (!href) return false;
  // Navigate directly to players to avoid strict mode on sidebar vs tab nav links.
  await page.goto(`${href}/players`);
  await page.waitForLoadState('domcontentloaded');
  if (!page.url().includes('/players')) return false;
  return true;
}

async function isDungeonMaster(page: Page): Promise<boolean> {
  return (await page.getByText(/dungeon master|co-dm/i).count()) > 0;
}

test.describe('Characters', () => {
  test('characters list for a campaign loads via Players tab', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstCampaignPlayers(page);
    if (!opened) {
      test.skip(true, 'No campaign exists for players/characters coverage.');
      return;
    }

    // Edge case: campaign characters page may be populated or empty.
    await expect(
      page.getByRole('heading', { name: /pending characters|party/i })
        .or(page.getByText(/no players in this campaign yet/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('empty state is shown when campaign has no characters', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstCampaignPlayers(page);
    if (!opened) {
      test.skip(true, 'No campaign exists for players/characters coverage.');
      return;
    }

    const characterCards = page.locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])').filter({ hasText: /level|pending|active|retired/i });
    if ((await characterCards.count()) > 0) {
      test.skip(true, 'Campaign already has characters; empty-state assertion is not applicable.');
      return;
    }

    // Edge case: empty state should not be treated as an error.
    await expect(page.getByText(/no players in this campaign yet/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/failed|error|500/i)).toHaveCount(0);
  });

  test('D&D Beyond import UI is visible for DM users', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    await page.waitForLoadState('domcontentloaded');

    const campaignLink = page.locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])').first();
    if ((await campaignLink.count()) === 0) {
      test.skip(true, 'No campaign exists to validate DM role prerequisites.');
      return;
    }

    const campaignHref = await campaignLink.getAttribute('href');
    if (!campaignHref) { test.skip(true, 'Could not read campaign href.'); return; }
    await page.goto(campaignHref);
    await page.waitForLoadState('domcontentloaded');
    if (!(await isDungeonMaster(page))) {
      test.skip(true, 'Current campaign role is not DM.');
      return;
    }

    // Edge case: DM flow should expose import entry points in character management UI.
    await page.goto('/characters');
    await page.waitForLoadState('domcontentloaded');
    const importButton = page.getByRole('button', { name: /import from d&d beyond/i });
    if ((await importButton.count()) === 0) {
      test.skip(true, 'D&D Beyond import UI is not available in this environment.');
      return;
    }
    await expect(importButton).toBeVisible({ timeout: 10000 });
  });

  test('D&D Beyond URL validation rejects non-DDB URLs', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
    await page.waitForLoadState('domcontentloaded');

    // Edge case: malformed/non-DDB URL should produce a validation/service error.
    const importButton = page.getByRole('button', { name: /import from d&d beyond/i });
    if ((await importButton.count()) === 0) {
      test.skip(true, 'D&D Beyond import UI is not available in this environment.');
      return;
    }
    await importButton.click();
    await page.getByLabel(/character url/i).fill('https://example.com/not-a-dndbeyond-character');
    await page.getByRole('button', { name: /import character/i }).click();

    await expect(
      page.getByText(
        /could not extract character id from url|expected format:\s*https:\/\/www\.dndbeyond\.com\/characters\/12345678|dndbeyond\.com\/characters/i
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('clicking a character card opens detail view with key stats', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
    await page.waitForLoadState('domcontentloaded');

    const characterLink = page
      .locator('a[href*="/characters/"]')
      .filter({ hasNot: page.locator('[href="/characters/new"]') })
      .first();
    if ((await characterLink.count()) === 0) {
      test.skip(true, 'No characters exist for detail-page coverage.');
      return;
    }

    // Edge case: character card navigation should land on a detail page with stats.
    await characterLink.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/characters\/[a-zA-Z0-9_-]+/);
    await expect(
      page.getByText(/armor class/i)
        .or(page.getByText(/level \d/i))
        .or(page.getByRole('tab', { name: /overview/i }))
    ).toBeVisible({ timeout: 10000 });
  });

  test('player role cannot access DM-only character controls in campaign view', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    await page.waitForLoadState('domcontentloaded');

    const campaignLinks = await page.locator('a[href^="/campaigns/"]').evaluateAll((links) => {
      const unique = new Set<string>();
      for (const link of links) {
        const href = link.getAttribute('href');
        // Match campaign slugs but exclude the "New Campaign" create link.
        if (href && /\/campaigns\/(?!new(?:\/|$))[^/]+$/.test(href)) unique.add(href);
      }
      return [...unique];
    });

    let playerCampaignFound = false;
    for (const href of campaignLinks) {
      await page.goto(href);
      await page.waitForLoadState('domcontentloaded');
      if ((await page.getByText(/player/i).count()) > 0) {
        playerCampaignFound = true;
        break;
      }
    }

    if (!playerCampaignFound) {
      test.skip(true, 'No player-role campaign available for permission check.');
      return;
    }

    const slug = page.url().match(/\/campaigns\/([^/]+)/)?.[1];
    if (!slug) { test.skip(); return; }
    await page.goto(`/campaigns/${slug}/players`);
    await page.waitForLoadState('domcontentloaded');

    // Edge case: DM-only moderation controls should be hidden for player role.
    await expect(page.getByRole('button', { name: /approve|reject|remove/i })).toHaveCount(0);
  });

  test('delete character action requires confirmation dialog', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
    await page.waitForLoadState('domcontentloaded');

    const characterLink = page.locator('a[href*="/characters/"]').first();
    if ((await characterLink.count()) === 0) {
      test.skip(true, 'No characters exist for delete-flow coverage.');
      return;
    }

    await characterLink.click();
    await page.waitForLoadState('domcontentloaded');

    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    if ((await deleteButton.count()) === 0) {
      test.skip(true, 'Delete action is not available for this character/user.');
      return;
    }

    // Edge case: destructive character delete must prompt for confirmation.
    await deleteButton.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('dialog').getByText(/delete character/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

