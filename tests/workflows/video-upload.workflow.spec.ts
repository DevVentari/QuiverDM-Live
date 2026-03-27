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

test('session detail shows recording controls for DMs', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    const href = await navigateToSessionDetail(page);
    if (!href) test.skip(true, 'Could not find or create a session.');
    await expect(page).toHaveURL(/\/campaigns\/[^/]+\/sessions\/[^/]+$/);
  }, 25_000);

  await checkpoint(testInfo, 'verify-session-detail-loads', async () => {
    // Session detail renders without crash
    await expect(page.getByText(/session/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/failed to load|500 internal|something went wrong/i)).toHaveCount(0);
  }, 15_000);

  await checkpoint(testInfo, 'verify-recording-controls-visible', async () => {
    // Recordings sidebar section appears for DMs
    const hasRecordingsSection = await page.getByText('Recordings').isVisible({ timeout: 8_000 }).catch(() => false);
    const hasMicButton = await page.getByRole('button', { name: /record|mic/i }).isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasRecordingsSection || hasMicButton).toBe(true);
  }, 10_000);
});
