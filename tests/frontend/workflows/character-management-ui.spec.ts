import { test, expect } from '@playwright/test';
import { loginAsFrontendTestUser } from '../helpers/auth';
import { ensureFrontendFixture } from '../helpers/test-data';

test.describe('Frontend Workflow: Character Management', () => {
  test('character list page renders with fixture character', async ({ page }) => {
    await ensureFrontendFixture();
    await loginAsFrontendTestUser(page);

    await page.goto('/characters');
    await expect(page.getByRole('heading', { name: 'My Characters' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Character' })).toBeVisible();
    await expect(page.getByText('Frontend Cert Hero')).toBeVisible();
  });
});

