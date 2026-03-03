import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('session prep wizard loads and navigates all 8 steps', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  let sessionId: string;

  await checkpoint(testInfo, 'create-session-via-prep', async () => {
    // "New Session" button links to /campaigns/[slug]/sessions/prep (creates prep session automatically)
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/prep`);
    // The prep page auto-creates a session and redirects to ?sessionId=...
    await page.waitForURL(/sessionId=/, { timeout: 20_000 });
    const url = new URL(page.url());
    sessionId = url.searchParams.get('sessionId') ?? '';
    expect(sessionId).toBeTruthy();
  }, 25_000);

  await checkpoint(testInfo, 'prep-wizard-loaded', async () => {
    // The prep header title input should be visible
    await expect(page.getByPlaceholder(/session title/i)).toBeVisible({ timeout: 15_000 });
    // Step heading for step 0: "Review Characters"
    await expect(page.getByRole('heading', { name: /review characters/i })).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'step-0-characters', async () => {
    // Either character cards or the empty state message is visible
    const hasCharacters = await page.locator('text=Goals and Motivations').isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=No characters in this campaign').isVisible().catch(() => false);
    expect(hasCharacters || hasEmptyState).toBe(true);
    // Navigate to step 1
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'step-1-strong-start', async () => {
    await expect(page.getByRole('heading', { name: /strong start/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'step-2-scenes', async () => {
    await expect(page.getByRole('heading', { name: /potential scenes/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'step-3-secrets', async () => {
    await expect(page.getByRole('heading', { name: /secrets/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'step-4-npcs', async () => {
    await expect(page.getByRole('heading', { name: /featured npcs/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'step-5-monsters', async () => {
    await expect(page.getByRole('heading', { name: /monsters/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'step-6-rewards', async () => {
    await expect(page.getByRole('heading', { name: /rewards/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'step-7-loose-threads', async () => {
    await expect(page.getByRole('heading', { name: /loose threads/i })).toBeVisible({ timeout: 10_000 });
    // On the final step, Next becomes Complete Prep (may appear in header + step area)
    await expect(page.getByRole('button', { name: /complete prep/i }).first()).toBeVisible({ timeout: 5_000 });
  }, 10_000);

  await checkpoint(testInfo, 'auto-save-indicator', async () => {
    // Save status shows "Saved" or "Saving..." in the header — either is a sign the auto-save hook is running
    const savedIndicator = page.locator('text=Saved').or(page.locator('text=Saving'));
    await expect(savedIndicator.first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);
});
