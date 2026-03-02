import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers';

const DANA_EMAIL = process.env.QA_DANA_EMAIL ?? 'dana@test.local';
const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const DANA_PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('sign-in redirects to dashboard', async ({ page }) => {
  await signInAsTestUser(page, DANA_EMAIL, DANA_PASSWORD);
  await expect(page).toHaveURL(/dashboard/);
});

test('dashboard renders campaign section', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, DANA_PASSWORD);
  await expect(page.getByText(/campaign/i).first()).toBeVisible({ timeout: 10_000 });
});

test('campaign detail page loads', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, DANA_PASSWORD);
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
  await expect(page).toHaveURL(/vics-test-campaign/);
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
});

test('campaign NPC section is accessible', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, DANA_PASSWORD);
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
  await expect(page).toHaveURL(/npcs/);
  await expect(page.getByRole('heading', { name: 'NPCs' })).toBeVisible({ timeout: 10_000 });
});

test('homebrew page loads', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, DANA_PASSWORD);
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/homebrew`);
  await expect(page).toHaveURL(/homebrew/);
  await expect(page.getByRole('heading', { name: 'Homebrew Content' })).toBeVisible({ timeout: 10_000 });
});
