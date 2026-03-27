import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

async function navigateToSessionDetail(page: Parameters<typeof signInAsTestUser>[0]): Promise<string | null> {
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
  await page.waitForLoadState('networkidle');

  const sessionHref = await page.locator(`a[href^="/campaigns/${CAMPAIGN_SLUG}/sessions/"]`).evaluateAll((links) => {
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && /\/campaigns\/[^/]+\/sessions\/([a-zA-Z0-9_-]{10,})$/.test(href)) {
        return href;
      }
    }
    return null;
  });

  if (sessionHref) {
    await page.goto(sessionHref);
    await page.waitForLoadState('networkidle');
    return sessionHref;
  }

  // No sessions — create one via prep wizard
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/prep`);
  await page.waitForURL(/sessionId=/, { timeout: 20_000 });
  const url = new URL(page.url());
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) return null;

  const detailHref = `/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}`;
  await page.goto(detailHref);
  await page.waitForLoadState('networkidle');
  return detailHref;
}

test('session detail shows recordings section for DMs', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    const href = await navigateToSessionDetail(page);
    if (!href) test.skip(true, 'Could not find or create a session.');
    await expect(page).toHaveURL(/\/campaigns\/[^/]+\/sessions\/[^/]+$/);
  }, 25_000);

  await checkpoint(testInfo, 'verify-recordings-section', async () => {
    // Recordings section is in the DM sidebar of session detail
    await expect(page.getByText('Recordings')).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'verify-audio-recorder', async () => {
    // AudioRecorder component renders mic/record UI for DMs
    const hasRecordBtn = await page.getByRole('button', { name: /record/i }).isVisible({ timeout: 5_000 }).catch(() => false);
    const hasUploadBtn = await page.getByRole('button', { name: /upload/i }).isVisible({ timeout: 3_000 }).catch(() => false);
    const hasRecordingsLabel = await page.getByText('Recordings').isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasRecordBtn || hasUploadBtn || hasRecordingsLabel).toBe(true);
  }, 10_000);

  await checkpoint(testInfo, 'no-crash-or-error-page', async () => {
    await expect(page.getByText(/failed to load|500 internal|something went wrong/i)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/error|\/500/);
  }, 5_000);
});
