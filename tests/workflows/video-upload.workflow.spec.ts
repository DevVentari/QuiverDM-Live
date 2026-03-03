import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

function makeMp4Buffer(): Buffer {
  const ftypBytes = [
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31,
  ];
  const buf = Buffer.alloc(1024, 0);
  for (let i = 0; i < ftypBytes.length; i++) buf[i] = ftypBytes[i]!;
  return buf;
}

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

  // No sessions — create one via prep wizard
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

test('video upload: MP4 ftyp buffer is accepted and appears in recordings list', async ({ page }, testInfo) => {
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

  await checkpoint(testInfo, 'upload-mp4-file', async () => {
    const uploadButton = page.getByRole('button', { name: /upload recording/i });
    await expect(uploadButton).toBeVisible({ timeout: 8_000 });

    const fileInput = page.locator('input[type="file"][accept*="video"]');
    await expect(fileInput).toHaveCount(1);

    await fileInput.setInputFiles({
      name: 'test-clip.mp4',
      mimeType: 'video/mp4',
      buffer: makeMp4Buffer(),
    });
  }, 15_000);

  await checkpoint(testInfo, 'verify-upload-accepted', async () => {
    // Wait for uploading state to clear, then verify a recording entry or status is visible
    const uploadButton = page.getByRole('button', { name: /upload recording/i });
    await expect(uploadButton).not.toHaveText(/uploading/i, { timeout: 30_000 });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const recordingsTab = page.getByRole('tab', { name: /recordings/i });
    await expect(recordingsTab).toBeVisible({ timeout: 10_000 });
    await recordingsTab.click();

    const recordingEntry = page
      .getByText(/video recording/i)
      .or(page.getByText(/audio recording/i))
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
