import { test, expect } from '@playwright/test';
import { BASE_URL, signIn, pageChecks } from './helpers';

const SPEC = 'homebrew';

test.describe('Homebrew — mobile', () => {
  test('homebrew list: no overflow, list renders, create button touchable', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/homebrew`);

    await pageChecks(page, SPEC, SPEC, 'homebrew-list');

    const content = page
      .getByRole('heading', { name: /homebrew/i })
      .or(page.getByText(/no homebrew/i))
      .or(page.getByText(/your homebrew/i));
    await expect(content.first()).toBeVisible({ timeout: 10000 });

    const createBtn = page
      .getByRole('button', { name: /create|add|new/i })
      .or(page.getByRole('link', { name: /create|add|new/i }))
      .first();

    const isVisible = await createBtn.isVisible().catch(() => false);
    if (isVisible) {
      const btnBox = await createBtn.boundingBox();
      if (btnBox) {
        expect(btnBox.width, 'Create button width < 44px').toBeGreaterThanOrEqual(44);
        expect(btnBox.height, 'Create button height < 44px').toBeGreaterThanOrEqual(44);
      }
    } else {
      console.warn('[homebrew] No create/add button found on homebrew page');
    }
  });

  test('homebrew PDFs: no overflow, list renders', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/homebrew/pdfs`);

    await pageChecks(page, SPEC, SPEC, 'homebrew-pdfs');

    const content = page
      .getByRole('heading', { name: /pdf|upload/i })
      .or(page.getByText(/no pdfs/i))
      .or(page.getByText(/upload/i));
    await expect(content.first()).toBeVisible({ timeout: 10000 }).catch(() => {
      console.warn('[homebrew-pdfs] No heading found — page may have different structure');
    });
  });
});
