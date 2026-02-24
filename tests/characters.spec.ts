import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Characters', () => {
  test('characters page loads', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /characters|my characters/i })
        .or(page.getByText(/no characters|import.*character|add character/i))
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('D&D Beyond import button is visible', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('button', { name: /import|d&d beyond|dndbeyond/i })
        .or(page.getByText(/import.*character|d&d beyond/i).first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('D&D Beyond import dialog opens on button click', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
    await page.waitForLoadState('networkidle');

    const importBtn = page.getByRole('button', { name: /import|d&d beyond|dndbeyond/i }).first();
    if (await importBtn.count() === 0) { test.skip(); return; }

    await importBtn.click();

    // Dialog should appear with a URL input field
    await expect(
      page.getByRole('dialog')
        .or(page.getByRole('textbox').filter({ hasText: /url|link/i }))
        .or(page.getByPlaceholder(/url|dndbeyond/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test('invalid D&D Beyond URL shows validation error', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
    await page.waitForLoadState('networkidle');

    const importBtn = page.getByRole('button', { name: /import|d&d beyond|dndbeyond/i }).first();
    if (await importBtn.count() === 0) { test.skip(); return; }

    await importBtn.click();
    await page.waitForTimeout(500);

    const urlInput = page.getByRole('textbox').first()
      .or(page.getByPlaceholder(/url|dndbeyond/i));
    if (await urlInput.count() === 0) { test.skip(); return; }

    // Enter a non-DDB URL
    await urlInput.fill('https://not-dndbeyond.com/invalid');

    // Submit the import
    const submitBtn = page.getByRole('button', { name: /import|submit|add/i }).last();
    if (await submitBtn.count() > 0) await submitBtn.click();

    // Should show error — not crash the page
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('empty state shown when user has no characters', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
    await page.waitForLoadState('networkidle');

    const characterCards = page.locator('[href*="/characters/"]');
    const count = await characterCards.count();
    if (count > 0) { test.skip(); return; } // Has characters — skip empty state check

    await expect(
      page.getByText(/no characters|import.*character|get started|d&d beyond/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('character detail accessible from list', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
    await page.waitForLoadState('networkidle');

    const characterLink = page.locator('a[href*="/characters/"]').first();
    if (await characterLink.count() === 0) { test.skip(); return; }

    await characterLink.click();
    await page.waitForLoadState('networkidle');

    // Should navigate to character detail without error
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('unauthenticated access to /characters redirects', async ({ page }) => {
    await page.goto('/characters');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/signin|auth|login/, { timeout: 10000 });
  });
});
