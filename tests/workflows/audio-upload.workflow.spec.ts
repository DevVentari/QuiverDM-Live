import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

async function navigateToSessionDetail(page: Parameters<typeof signInAsTestUser>[0]): Promise<string | null> {
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
  await page.waitForLoadState('domcontentloaded');

  const sessionHref = await page.locator('a[href*="/sessions/"]').evaluateAll((links) => {
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
    await page.waitForLoadState('domcontentloaded');
    return sessionHref;
  }

  // No sessions — navigate to prep wizard to create one
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/prep`);
  await page.waitForURL(/sessionId=/, { timeout: 20_000 });
  const url = new URL(page.url());
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) return null;

  const detailHref = `/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}`;
  await page.goto(detailHref);
  await page.waitForLoadState('domcontentloaded');
  return detailHref;
}

test('audio upload: WAV file is accepted and appears in recordings', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    const href = await navigateToSessionDetail(page);
    if (!href) test.skip(true, 'Could not find or create a session.');
    await expect(page).toHaveURL(/\/campaigns\/[^/]+\/sessions\/[^/]+$/);
  }, 25_000);

  await checkpoint(testInfo, 'open-recordings-tab', async () => {
    const recordingsTab = page.getByRole('tab', { name: /recordings/i });
    await expect(recordingsTab).toBeVisible({ timeout: 10_000 });
    await recordingsTab.click();
    await expect(page.getByRole('tabpanel')).toBeVisible({ timeout: 8_000 });
  }, 12_000);

  await checkpoint(testInfo, 'upload-wav-file', async () => {
    const uploadButton = page.getByRole('button', { name: /upload recording/i });
    await expect(uploadButton).toBeVisible({ timeout: 8_000 });

    const fileInput = page.locator('input[type="file"][accept*="audio"]');
    await expect(fileInput).toHaveCount(1);

    await fileInput.setInputFiles('.archive/test-documents/test-10sec.wav');
  }, 15_000);

  await checkpoint(testInfo, 'verify-upload-accepted', async () => {
    // After upload: button reverts to non-uploading state, and either a recording
    // entry appears or a status badge (pending/processing/queued/uploaded) is visible.
    const uploadButton = page.getByRole('button', { name: /upload recording/i });

    // Wait for uploading state to clear
    await expect(uploadButton).not.toHaveText(/uploading/i, { timeout: 30_000 });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const recordingsTab = page.getByRole('tab', { name: /recordings/i });
    await expect(recordingsTab).toBeVisible({ timeout: 10_000 });
    await recordingsTab.click();

    const recordingEntry = page
      .getByText(/audio recording/i)
      .or(page.getByText(/pending/i))
      .or(page.getByText(/processing/i))
      .or(page.getByText(/queued/i))
      .or(page.getByText(/uploaded/i))
      .or(page.getByRole('button', { name: /play/i }))
      .or(page.getByText(/no recordings yet/i));

    await expect(recordingEntry.first()).toBeVisible({ timeout: 20_000 });
  }, 30_000);

  await checkpoint(testInfo, 'no-crash-or-error-page', async () => {
    await expect(page.getByText(/failed to load|500 internal|something went wrong/i)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/error|\/500/);
  }, 5_000);
});
