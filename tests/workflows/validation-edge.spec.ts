import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('campaign create requires a name', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await page.goto('/campaigns/new');
  await page.getByRole('button', { name: /create campaign/i }).click();

  await expect(page).toHaveURL('/campaigns/new');
  await expect(page.getByText('Campaign name is required')).toBeVisible({ timeout: 10_000 });
});

test('npc create requires a name', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`);
  await page.getByRole('button', { name: /create npc/i }).click();

  await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`));
  await expect(page.getByText('Name is required')).toBeVisible({ timeout: 10_000 });
});
