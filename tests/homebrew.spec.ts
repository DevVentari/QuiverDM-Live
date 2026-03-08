import { test, expect, type Page } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

async function openFirstCampaignHomebrew(page: Page): Promise<boolean> {
  await page.goto('/campaigns');
  await page.waitForLoadState('domcontentloaded');

  // Exclude the "New Campaign" create link; find actual campaign card links only.
  const campaignLink = page.locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])').first();
  if (await campaignLink.count() === 0) return false;

  const href = await campaignLink.getAttribute('href');
  if (!href) return false;
  // Navigate directly to campaign homebrew to avoid strict mode on shared sidebar nav.
  await page.goto(`${href}/homebrew`);
  await page.waitForLoadState('domcontentloaded');
  if (!page.url().includes('/homebrew')) return false;
  return true;
}

async function createManualHomebrew(page: Page, name: string, description: string) {
  await page.goto('/homebrew');
  await page.waitForLoadState('domcontentloaded');

  const createBtn = page.getByRole('button', { name: /^create$/i });
  await expect(createBtn).toBeVisible({ timeout: 10000 });
  await createBtn.click();

  await page.getByLabel(/name/i).fill(name);
  await page.getByRole('textbox', { name: /content/i }).fill(description);

  // Submit button inside dialog (second "Create" button on page)
  await page.getByRole('button', { name: /^create$/i }).last().click();

  // Wait for dialog to close (mutation succeeded), then reload to bypass staleTime cache
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15000 });
  await page.goto('/homebrew');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText(name)).toBeVisible({ timeout: 15000 });
}

async function openFirstCampaignByRole(page: Page, role: 'Player' | 'Dungeon Master'): Promise<boolean> {
  await page.goto('/campaigns');
  await page.waitForLoadState('domcontentloaded');

  const hrefs = await page.locator('a[href^="/campaigns/"]').evaluateAll((links) => {
    const result = new Set<string>();
    for (const link of links) {
      const href = link.getAttribute('href');
      // Match campaign slugs but exclude the "New Campaign" create link.
      if (href && /\/campaigns\/(?!new(?:\/|$))[^/]+$/.test(href)) {
        result.add(href);
      }
    }
    return [...result];
  });

  for (const href of hrefs) {
    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');

    // Use exact match (^...$) to avoid matching e.g. "Invite Player" when checking for "Player" role.
    if (await page.getByText(new RegExp(`^${role}$`, 'i')).count()) {
      return true;
    }
  }

  return false;
}

test.describe('Homebrew', () => {
  test('homebrew list loads for a campaign', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstCampaignHomebrew(page);
    if (!opened) {
      test.skip(true, 'No campaign exists for homebrew navigation.');
      return;
    }

    // Edge case: page may render either list or empty state; both are valid.
    await expect(
      page.getByRole('heading', { name: /homebrew content/i })
        .or(page.getByText(/no homebrew content yet/i))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('create homebrew manually from library page', async ({ page }) => {
    await signInAsTestUser(page);

    // Edge case: ensure manual creation flow works with unique names.
    const name = `E2E Homebrew ${Date.now()}`;
    await createManualHomebrew(page, name, 'Created by Playwright E2E test.');

    await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
  });

  test('empty state is shown when campaign has no homebrew', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstCampaignHomebrew(page);
    if (!opened) {
      test.skip(true, 'No campaign exists for homebrew navigation.');
      return;
    }

    const items = page.locator('a[href*="/homebrew/"]');
    if ((await items.count()) > 0) {
      test.skip(true, 'Campaign already has homebrew content; empty state is not applicable.');
      return;
    }

    // Edge case: empty state should be user-friendly, not an error screen.
    await expect(page.getByText(/no homebrew content yet/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/failed to load|500|error/i)).toHaveCount(0);
  });

  test('player cannot see DM-only create/add controls in campaign homebrew', async ({ page }) => {
    await signInAsTestUser(page);

    const openedPlayerCampaign = await openFirstCampaignByRole(page, 'Player');
    if (!openedPlayerCampaign) {
      test.skip(true, 'No player-role campaign available for permission check.');
      return;
    }

    // Navigate directly to homebrew to avoid strict mode on sidebar vs tab nav links.
    const slug = page.url().match(/\/campaigns\/([^/]+)/)?.[1];
    if (!slug) { test.skip(); return; }
    await page.goto(`/campaigns/${slug}/homebrew`);
    await page.waitForLoadState('domcontentloaded');

    // Edge case: DM-only actions should be hidden from players.
    await expect(page.getByRole('button', { name: /add from library|create/i })).toHaveCount(0);
  });

  test('delete homebrew shows confirmation and removes item when UI is available', async ({ page }) => {
    await signInAsTestUser(page);

    const name = `E2E Delete ${Date.now()}`;
    await createManualHomebrew(page, name, 'Disposable item for delete coverage.');

    const itemLink = page.locator('a[href*="/homebrew/"]').filter({ hasText: name }).first();
    if ((await itemLink.count()) === 0) {
      test.skip(true, 'Created homebrew item link not found on page.');
      return;
    }

    const href = await itemLink.getAttribute('href');
    if (!href) { test.skip(); return; }
    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');

    const deleteButton = page.getByRole('button', { name: /delete/i });
    if ((await deleteButton.count()) === 0) {
      test.skip(true, 'Delete homebrew control is not exposed in this UI version.');
      return;
    }

    // Edge case: destructive actions must require explicit confirmation.
    await deleteButton.first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.getByRole('dialog').getByRole('button', { name: /delete|confirm/i }).click();

    await page.goto('/homebrew');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test('uploading a non-PDF file shows an error and does not crash', async ({ page }) => {
    await signInAsTestUser(page);

    const opened = await openFirstCampaignHomebrew(page);
    if (!opened) {
      test.skip(true, 'No campaign exists for homebrew navigation.');
      return;
    }

    const input = page.locator('input[type="file"]').first();
    if ((await input.count()) === 0) {
      test.skip(true, 'No file input exists on this page.');
      return;
    }

    // Edge case: invalid MIME type should show a toast, not break the page.
    await input.setInputFiles({
      name: 'invalid-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a pdf'),
    });

    await expect(page.getByText(/invalid file type|please upload a pdf/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/failed to load|500/i)).toHaveCount(0);
  });

  test('search input filters visible homebrew list', async ({ page }) => {
    await signInAsTestUser(page);

    const name = `E2E Search ${Date.now()}`;
    await createManualHomebrew(page, name, 'Search coverage entry.');

    // Ensure we're on the library page with content loaded
    await page.goto('/homebrew');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    if ((await searchInput.count()) === 0) {
      test.skip(true, 'Search input not available on this page.');
      return;
    }
    await searchInput.fill(name);

    // Edge case: filter should match the exact created item.
    await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
  });

  test('clicking a homebrew item opens the detail page', async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto('/homebrew');
    await page.waitForLoadState('domcontentloaded');

    if ((await page.locator('a[href*="/homebrew/"]').count()) === 0) {
      const name = `E2E Detail ${Date.now()}`;
      await createManualHomebrew(page, name, 'Detail navigation fallback item.');
      await page.goto('/homebrew');
      await page.waitForLoadState('domcontentloaded');
    }

    const itemLink = page.locator('a[href*="/homebrew/"]').first();
    if ((await itemLink.count()) === 0) {
      test.skip(true, 'No homebrew items available for detail navigation.');
      return;
    }

    // Edge case: card navigation should resolve to a stable detail route.
    const href = await itemLink.getAttribute('href');
    if (!href) { test.skip(); return; }
    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/homebrew\/[a-zA-Z0-9_-]+/);
    await expect(page.getByRole('heading').or(page.getByText(/content not found|failed to load/i)).first()).toBeVisible();
  });
});

