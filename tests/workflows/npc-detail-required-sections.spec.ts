import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('npc detail renders required 5e stat block sections', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-npc-create', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`);
    await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`));
    await expect(page.getByRole('button', { name: /create npc/i })).toBeEnabled();
  }, 8_000);

  await checkpoint(testInfo, 'submit-5e-stat-block', async () => {
    await page.getByLabel(/^name$/i).fill(`QA NPC ${Date.now()}`);
    await page.getByRole('button', { name: /d&d 5e stat block/i }).click();

    await page.getByLabel(/challenge rating/i).fill('5');
    await page.getByLabel(/hit points/i).fill('78');
    await page.getByLabel(/armor class/i).fill('14');
    await page.getByLabel(/^traits/i).fill('Dark resilience.');
    await page.getByLabel(/^actions/i).fill('Shadow bolt.');
    await page.getByLabel(/^reactions/i).fill('Parry.');
    await page.getByLabel(/legendary actions/i).fill('Shadow step.');

    await page.getByRole('button', { name: /create npc/i }).click();
    await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/npcs/`));
    await expect(page).not.toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`));
  }, 15_000);

  await checkpoint(testInfo, 'verify-stat-block-sections', async () => {
    await expect(page.getByText(/stat block/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/^CR 5$/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/^Traits$/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/^Actions$/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/^Reactions$/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/^Legendary Actions$/)).toBeVisible({ timeout: 10_000 });
  }, 8_000);
});
