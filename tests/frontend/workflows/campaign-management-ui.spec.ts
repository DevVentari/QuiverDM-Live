import { test, expect } from '@playwright/test';
import { loginAsFrontendTestUser } from '../helpers/auth';
import { ensureFrontendFixture } from '../helpers/test-data';

test.describe('Frontend Workflow: Campaign Management', () => {
  test('campaign list UI is available to authenticated user', async ({ page }) => {
    await ensureFrontendFixture();
    await loginAsFrontendTestUser(page);
    await page.goto('/campaigns');

    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Campaign' })).toBeVisible();
    await expect(page.getByText('Frontend Certification Campaign')).toBeVisible();
  });
});

