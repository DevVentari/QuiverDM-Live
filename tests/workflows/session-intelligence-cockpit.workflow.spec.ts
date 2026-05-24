import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

// Run locally with:
// $env:CI=$null; $env:BASE_URL='http://localhost:3847'; npx playwright test tests/workflows/session-intelligence-cockpit.workflow.spec.ts

const DM_EMAIL = process.env.QA_DM_EMAIL ?? process.env.TEST_DM_EMAIL ?? 'dm@test.com';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? process.env.TEST_DM_PASSWORD ?? 'TestPass123!';
const CAMPAIGN_SLUG = process.env.TEST_CAMPAIGN_SLUG ?? 'year-of-rogue-dragons';

async function navigateToCockpit(page: import('@playwright/test').Page, sessionId: string) {
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
}

test('session-intelligence: intel drawer opens, shows Secrets Web, and closes', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-cockpit', async () => {
    if (!sessionId) return;
    await navigateToCockpit(page, sessionId);
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-secrets-panel', async () => {
    if (!sessionId) return;
    const secretsBtn = page.locator('button').filter({ hasText: 'SECRETS' }).last();
    const hasBtn = await secretsBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await secretsBtn.click();
    await page.waitForTimeout(500);
    const panelTitle = page.getByText(/Secrets Web/i).first();
    const titleVisible = await panelTitle.isVisible({ timeout: 8_000 }).catch(() => false);
    expect(titleVisible).toBeTruthy();
  }, 20_000);

  await checkpoint(testInfo, 'close-secrets-panel', async () => {
    if (!sessionId) return;
    const closeBtn = page.getByRole('button', { name: /close/i }).first();
    const hasClose = await closeBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasClose) {
      await closeBtn.click();
    } else {
      const secretsBtn = page.locator('button').filter({ hasText: 'SECRETS' }).last();
      const hasBtn = await secretsBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasBtn) await secretsBtn.click();
    }
    await page.waitForTimeout(500);
    const panelGone = await page.getByText(/Secrets Web/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(panelGone).toBeFalsy();
  }, 15_000);

  await checkpoint(testInfo, 'open-brief-panel', async () => {
    if (!sessionId) return;
    const briefBtn = page.locator('button').filter({ hasText: 'BRIEF' }).last();
    const hasBtn = await briefBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await briefBtn.click();
    await page.waitForTimeout(500);
    const panelTitle = page.getByText(/Session Brief/i).first();
    const titleVisible = await panelTitle.isVisible({ timeout: 8_000 }).catch(() => false);
    expect(titleVisible).toBeTruthy();
  }, 20_000);
});

test('session-intelligence: routes panel renders with content or empty state', async ({ page }, testInfo) => {
  test.slow();

  const sessionId = process.env.TEST_SESSION_ID ?? '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DM_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-cockpit', async () => {
    if (!sessionId) return;
    await navigateToCockpit(page, sessionId);
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 30_000);

  await checkpoint(testInfo, 'open-routes-panel', async () => {
    if (!sessionId) return;
    const routesBtn = page.locator('button').filter({ hasText: 'ROUTES' }).last();
    const hasBtn = await routesBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBtn) return;
    await routesBtn.click();
    await page.waitForTimeout(500);
    const panelTitle = page.getByText(/Escape Routes/i).first();
    const titleVisible = await panelTitle.isVisible({ timeout: 8_000 }).catch(() => false);
    expect(titleVisible).toBeTruthy();
  }, 20_000);

  await checkpoint(testInfo, 'verify-routes-content-or-empty', async () => {
    if (!sessionId) return;
    const hasRoutes = await page.locator('[data-route-item]').first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasEmptyState = await page.getByText(/no escape routes|no routes/i).first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasAddBtn = await page.getByRole('button', { name: /add route/i }).first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasRoutes || hasEmptyState || hasAddBtn).toBeTruthy();
  }, 10_000);
});
