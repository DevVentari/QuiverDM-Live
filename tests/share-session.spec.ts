import { test, expect } from '@playwright/test';

test.describe('Shared Session Page', () => {
  test('invalid share token shows not-found without crash', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const response = await page.goto('/share/session/fake-token-does-not-exist');
    await page.waitForLoadState('domcontentloaded');

    // Server should return 404 for invalid token (via notFound())
    expect(response?.status()).toBe(404);
    expect(pageErrors).toEqual([]);
  });

  test('share page renders without authentication', async ({ page }) => {
    // Public route — no sign in needed
    await page.goto('/share/session/test-share-token');
    await page.waitForLoadState('domcontentloaded');

    // Should NOT redirect to sign in
    expect(page.url()).not.toMatch(/\/auth\/signin/);
  });
});
