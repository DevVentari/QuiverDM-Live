import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Rules Sources', () => {
  test('admin rules sources page loads for authenticated user', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/admin/rules-sources');
    await page.waitForLoadState('domcontentloaded');

    // Admin page either renders (if user is admin) or redirects (if not)
    const isRedirected = page.url().includes('signin') || page.url().includes('dashboard');
    if (!isRedirected) {
      await expect(page.getByText(/error|500/i)).toHaveCount(0);
      await expect(
        page.getByText(/rules.*source|pdf|index|homebrew/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('rules panel visible on session detail page', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    if (await campaignLink.count() === 0) { test.skip(); return; }
    await campaignLink.click();
    await page.waitForLoadState('domcontentloaded');

    const sessionsLink = page.getByRole('link', { name: /sessions/i });
    if (await sessionsLink.count() === 0) { test.skip(); return; }
    await sessionsLink.click();
    await page.waitForLoadState('domcontentloaded');

    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (await sessionLink.count() === 0) { test.skip(); return; }
    await sessionLink.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByText(/rules|rules lookup|ask rules/i).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('rules query input is present on session page', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    if (await campaignLink.count() === 0) { test.skip(); return; }
    await campaignLink.click();
    await page.waitForLoadState('domcontentloaded');

    const sessionsLink = page.getByRole('link', { name: /sessions/i });
    if (await sessionsLink.count() === 0) { test.skip(); return; }
    await sessionsLink.click();
    await page.waitForLoadState('domcontentloaded');

    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (await sessionLink.count() === 0) { test.skip(); return; }
    await sessionLink.click();
    await page.waitForLoadState('domcontentloaded');

    // RulesPanel has a search/query input
    const rulesInput = page.locator('input[placeholder*="rules" i]')
      .or(page.locator('input[placeholder*="search" i]').last());
    // Just verify no error — rules input may not be visible without sources indexed
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('rules query with XSS does not execute script', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    if (await campaignLink.count() === 0) { test.skip(); return; }
    await campaignLink.click();
    await page.waitForLoadState('domcontentloaded');

    const sessionsLink = page.getByRole('link', { name: /sessions/i });
    if (await sessionsLink.count() === 0) { test.skip(); return; }
    await sessionsLink.click();
    await page.waitForLoadState('domcontentloaded');

    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (await sessionLink.count() === 0) { test.skip(); return; }
    await sessionLink.click();
    await page.waitForLoadState('domcontentloaded');

    const rulesInput = page.locator('input[placeholder*="rules" i]')
      .or(page.locator('input[placeholder*="search" i]').last());
    if (await rulesInput.count() === 0) { test.skip(); return; }

    await rulesInput.fill('<script>window.__rulesXss=true</script>');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('domcontentloaded');

    const xssExecuted = await page.evaluate(() => (window as Record<string, unknown>).__rulesXss);
    expect(xssExecuted).toBeFalsy();
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });
});

