import { test, expect } from '@playwright/test';
import { loginAsFrontendTestUser } from '../helpers/auth';
import { ensureFrontendFixture } from '../helpers/test-data';

test.describe('Frontend Workflow: Homebrew Content', () => {
  test('homebrew library page renders', async ({ page }) => {
    await ensureFrontendFixture();
    await loginAsFrontendTestUser(page);

    await page.goto('/homebrew');
    await expect(page.getByRole('heading', { name: 'Homebrew Library' })).toBeVisible();
    await expect(page.getByPlaceholder('Search homebrew content...')).toBeVisible();
    await expect(page.getByText('Frontend Cert Item')).toBeVisible();
  });
});

