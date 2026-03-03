import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('campaign NPC section is accessible', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
  await expect(page).toHaveURL(/\/npcs$/);
  await expect(page.getByRole('heading', { name: 'NPCs' })).toBeVisible({ timeout: 10_000 });
});

test('homebrew page loads', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/homebrew`);
  await expect(page).toHaveURL(/\/homebrew$/);
  await expect(page.getByRole('heading', { name: 'Homebrew Content' })).toBeVisible({ timeout: 10_000 });
});

