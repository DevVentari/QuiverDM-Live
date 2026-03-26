import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('session prep accordion loads with all 8 sections', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  let sessionId: string;

  await checkpoint(testInfo, 'create-session-via-prep', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/prep`);
    await page.waitForURL(/sessionId=/, { timeout: 20_000 });
    const url = new URL(page.url());
    sessionId = url.searchParams.get('sessionId') ?? '';
    expect(sessionId).toBeTruthy();
  }, 25_000);

  await checkpoint(testInfo, 'prep-wizard-loaded', async () => {
    await expect(page.getByPlaceholder(/session title/i)).toBeVisible({ timeout: 15_000 });
  }, 15_000);

  await checkpoint(testInfo, 'section-review-characters', async () => {
    await expect(page.getByText('Review Characters').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'section-strong-start', async () => {
    await expect(page.getByText('Strong Start').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'section-potential-scenes', async () => {
    await expect(page.getByText('Potential Scenes').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'section-secrets-clues', async () => {
    await expect(page.getByText('Secrets & Clues').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'section-featured-npcs', async () => {
    await expect(page.getByText('Featured NPCs').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'section-monsters', async () => {
    await expect(page.getByText('Monsters').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'section-rewards', async () => {
    await expect(page.getByText('Rewards').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'section-loose-threads', async () => {
    await expect(page.getByText('Loose Threads').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'complete-prep-button', async () => {
    await expect(page.getByRole('button', { name: /complete prep/i }).first()).toBeVisible({ timeout: 5_000 });
  }, 10_000);

  await checkpoint(testInfo, 'auto-save-indicator', async () => {
    const savedIndicator = page.locator('text=Saved').or(page.locator('text=Saving'));
    await expect(savedIndicator.first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);
});
