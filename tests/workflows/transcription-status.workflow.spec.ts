import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

async function navigateToFirstSessionDetail(page: Parameters<typeof signInAsTestUser>[0]): Promise<boolean> {
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
  await page.waitForLoadState('domcontentloaded');

  const sessionHref = await page.locator('a[href*="/sessions/"]').evaluateAll((links) => {
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && /\/campaigns\/[^/]+\/sessions\/(?!prep$|new$)[^/]+$/.test(href)) {
        return href;
      }
    }
    return null;
  });

  if (!sessionHref) return false;

  await page.goto(sessionHref);
  await page.waitForLoadState('domcontentloaded');
  return true;
}

test('transcription status: transcript tab and empty state render without error', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    const found = await navigateToFirstSessionDetail(page);
    if (!found) test.skip(true, 'No sessions exist for transcription status coverage.');
    await expect(page).toHaveURL(/\/campaigns\/[^/]+\/sessions\/[^/]+$/);
  }, 20_000);

  await checkpoint(testInfo, 'transcript-tab-accessible', async () => {
    // Transcript tab is only visible when playerVisibility allows full content
    // (always true for DM / campaign owner Vic).
    const transcriptTab = page.getByRole('tab', { name: /transcript/i });
    await expect(transcriptTab).toBeVisible({ timeout: 10_000 });
    await transcriptTab.click();
    await expect(page.getByRole('tabpanel')).toBeVisible({ timeout: 8_000 });
  }, 15_000);

  await checkpoint(testInfo, 'transcript-content-or-empty-state', async () => {
    // Either transcripts are present, or the empty state is shown — no error.
    const hasTranscripts = (await page.getByText(/\d+ transcript/i).count()) > 0;
    const hasEmptyState = (await page.getByText(/no transcripts yet/i).count()) > 0;
    const hasSearchInput = (await page.getByRole('textbox', { name: /search transcripts/i }).count()) > 0;
    const hasSkeleton = (await page.locator('[class*="skeleton"]').count()) > 0;

    // At least one of: transcripts, empty state, search bar, or skeleton (loading)
    const something = hasTranscripts || hasEmptyState || hasSearchInput || hasSkeleton;
    expect(something).toBe(true);

    await expect(page.getByText(/failed to load|500|something went wrong/i)).toHaveCount(0);
  }, 15_000);
});

test('transcription status: live transcription controls are visible in Live Play tab', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    const found = await navigateToFirstSessionDetail(page);
    if (!found) test.skip(true, 'No sessions exist for live transcription controls coverage.');
    await expect(page).toHaveURL(/\/campaigns\/[^/]+\/sessions\/[^/]+$/);
  }, 20_000);

  await checkpoint(testInfo, 'live-play-tab-accessible', async () => {
    // Live Play tab is DM-only — Vic is owner/DM so it should always be visible.
    const livePlayTab = page.getByRole('tab', { name: /live play/i });
    await expect(livePlayTab).toBeVisible({ timeout: 10_000 });
    await livePlayTab.click();
    await expect(page.getByRole('tabpanel')).toBeVisible({ timeout: 8_000 });
  }, 15_000);

  await checkpoint(testInfo, 'live-transcription-controls-visible', async () => {
    // LiveTranscriptionControls renders "Live Transcription" card heading
    // plus a "Start Live Transcription" button for the DM.
    const liveTranscriptionHeading = page
      .getByText(/live transcription/i)
      .first();
    await expect(liveTranscriptionHeading).toBeVisible({ timeout: 10_000 });

    const startButton = page
      .getByRole('button', { name: /start live transcription/i })
      .or(page.getByRole('button', { name: /starting/i }));

    await expect(startButton.first()).toBeVisible({ timeout: 8_000 });
  }, 12_000);

  await checkpoint(testInfo, 'audio-recorder-visible', async () => {
    // AudioRecorder renders "Ready to record" / "Start Recording"
    const readyText = page
      .getByText(/ready to record/i)
      .or(page.getByRole('button', { name: /start recording/i }));
    await expect(readyText.first()).toBeVisible({ timeout: 8_000 });
  }, 10_000);

  await checkpoint(testInfo, 'no-crash-or-error-page', async () => {
    await expect(page.getByText(/failed to load|500 internal|something went wrong/i)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/error|\/500/);
  }, 5_000);
});

test('transcription status: recordings tab upload button is present for DM', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-session', async () => {
    const found = await navigateToFirstSessionDetail(page);
    if (!found) test.skip(true, 'No sessions exist for recordings tab coverage.');
    await expect(page).toHaveURL(/\/campaigns\/[^/]+\/sessions\/[^/]+$/);
  }, 20_000);

  await checkpoint(testInfo, 'recordings-tab-has-upload-button', async () => {
    const recordingsTab = page.getByRole('tab', { name: /recordings/i });
    await expect(recordingsTab).toBeVisible({ timeout: 10_000 });
    await recordingsTab.click();

    const uploadButton = page.getByRole('button', { name: /upload recording/i });
    await expect(uploadButton).toBeVisible({ timeout: 8_000 });
    await expect(uploadButton).toBeEnabled();

    // Hidden file input accepting audio and video should exist
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
    const accept = await fileInput.getAttribute('accept');
    expect(accept).toMatch(/audio|video/);
  }, 15_000);
});
