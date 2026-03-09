import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('brain dashboard shows tabs: Overview, Graph, Timeline, Warnings', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'tabs-visible', async () => {
    await expect(page.getByRole('tab', { name: /overview/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /graph/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /timeline/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /warnings/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 10_000);
});

test('graph tab renders entity relationship graph', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'click-graph-tab', async () => {
    await page.getByRole('tab', { name: /graph/i }).first().click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'graph-content-visible', async () => {
    const graphHeading = page.getByText(/Entity Relationship Graph/i);
    await expect(graphHeading.first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 10_000);
});

test('timeline tab shows entity appearances per session', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'click-timeline-tab', async () => {
    await page.getByRole('tab', { name: /timeline/i }).first().click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'timeline-content-visible', async () => {
    const timelineHeading = page.getByText(/Entity Appearances by Session/i);
    await expect(timelineHeading.first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 10_000);
});

test('warnings tab surfaces continuity issues or empty state', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'click-warnings-tab', async () => {
    await page.getByRole('tab', { name: /warnings/i }).first().click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'warnings-content-visible', async () => {
    const warningsHeading = page.getByText(/Continuity Warnings/i);
    await expect(warningsHeading.first()).toBeVisible({ timeout: 10_000 });

    const hasNoIssues = await page.getByText(/No continuity issues detected/i).isVisible().catch(() => false);
    const hasWarningItem = await page.locator('[class*="destructive"]').first().isVisible().catch(() => false);

    expect(hasNoIssues || hasWarningItem).toBeTruthy();
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 10_000);
});
