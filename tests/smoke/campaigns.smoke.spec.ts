import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('dashboard renders campaign section', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await expect(page.getByText(/campaign/i).first()).toBeVisible({ timeout: 10_000 });
});

test('campaign detail page loads', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
  await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}`));
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
});

