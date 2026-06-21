import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  seedLiveSession,
} from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test.describe('Session Scene Runner', () => {
  // An in-progress session with prepared scenes so the live cockpit renders a
  // real scene runner. Without this the cockpit tests used to silently skip.
  let liveSessionId = '';

  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    const seeded = await seedLiveSession(VIC_EMAIL, CAMPAIGN_SLUG);
    liveSessionId = seeded.sessionId;
  });

  test('prep workspace mounts without hanging on the loading skeleton', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'create-fresh-prep', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/prep`);
      await page.waitForURL(/sessionId=/, { timeout: 20_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 30_000);

    await checkpoint(testInfo, 'verify-workspace-mounted', async () => {
      // Regression guard: gating isLoading on createPrepSession.isPending used to
      // pin the page on the skeleton forever (the mutation observer is orphaned
      // under React Strict Mode). The import button only renders once the
      // workspace itself mounts, so its presence proves we escaped the skeleton.
      await expect(page.getByTestId('prep-import-button')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(/something went wrong|404|internal server error|unable to load prep/i);
    }, 15_000);
  });

  test('prep workspace has an import-notes entry point', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'create-fresh-prep', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/prep`);
      await page.waitForURL(/sessionId=/, { timeout: 20_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 30_000);

    await checkpoint(testInfo, 'verify-import-entry-point', async () => {
      // "Import from Sourcebook" became the briefing-board "Import notes" button,
      // which opens the import sheet (sourcebook + notes extraction live there).
      const importBtn = page.getByTestId('prep-import-button');
      await expect(importBtn).toBeVisible({ timeout: 8000 });
      await importBtn.click();
      await expect(page.getByTestId('prep-import-zone')).toBeVisible({ timeout: 5000 });
    });
  });

  test('session hub surfaces an Enter Live Session entry point', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'open-session-hub', async () => {
      // The seeded session is in_progress -> the hub's "ran" phase must offer a
      // way into the live cockpit (previously a "coming in a future slice" stub).
      // Don't wait for networkidle: a live session keeps connections open, so the
      // page never goes idle — auto-wait on the link below instead.
      await page.goto(`/session/${liveSessionId}`, { waitUntil: 'domcontentloaded' });
    }, 25_000);

    await checkpoint(testInfo, 'verify-enter-live-link', async () => {
      const enterLive = page.getByRole('link', { name: /Enter Live Session/i });
      await expect(enterLive).toBeVisible({ timeout: 15_000 });
      await expect(enterLive).toHaveAttribute('href', new RegExp(`/sessions/${liveSessionId}/live$`));
      await expect(page.locator('body')).not.toContainText(/something went wrong|404|internal server error|session not found/i);
    }, 20_000);
  });

  test('cockpit shows scene runner above live notes', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'open-cockpit', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${liveSessionId}/live`);
      await page.waitForLoadState('networkidle', { timeout: 20_000 });
      await expect(page.locator('body')).not.toContainText(/something went wrong|404|internal server error|session not found/i);
    }, 25_000);

    await checkpoint(testInfo, 'verify-scene-runner', async () => {
      // Runner starts collapsed: shows the seeded first scene's title + a "1/2" counter.
      await expect(page.getByText('The Sleeping Giant Tap House').first()).toBeVisible({ timeout: 8000 });
    });
  });

  test('cockpit right panel has Scene tab', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'open-cockpit', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${liveSessionId}/live`);
      await page.waitForLoadState('networkidle', { timeout: 20_000 });
      await expect(page.locator('body')).not.toContainText(/something went wrong|404|internal server error|session not found/i);
    }, 25_000);

    await checkpoint(testInfo, 'verify-scene-tab', async () => {
      await expect(page.getByRole('tab', { name: 'Scene' })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('tab', { name: 'Prep' })).not.toBeVisible();
    });
  });

  test('scene navigation advances to next scene', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'open-cockpit', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${liveSessionId}/live`);
      await page.waitForLoadState('networkidle', { timeout: 20_000 });
      await expect(page.locator('body')).not.toContainText(/something went wrong|404|internal server error|session not found/i);
    }, 25_000);

    const sceneCounter = page.locator('text=/Scene \\d+ of \\d+/').first();

    await checkpoint(testInfo, 'expand-scene-card', async () => {
      // "Scene N of M" + the labelled Next button only render in the expanded
      // card; the runner loads collapsed, so click the scene to open it.
      await page.getByText('The Sleeping Giant Tap House').first().click();
      await expect(sceneCounter).toContainText('Scene 1 of 2', { timeout: 8000 });
    });

    await checkpoint(testInfo, 'navigate-scene', async () => {
      const nextBtn = page.getByRole('button', { name: /Next/i }).first();
      await nextBtn.click();
      await expect(sceneCounter).toContainText('Scene 2 of 2', { timeout: 5000 });
    });
  });
});
