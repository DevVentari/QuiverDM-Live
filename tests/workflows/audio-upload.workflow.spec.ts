import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

function makeWavBuffer(): Buffer {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate; // 1 second
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 36 + dataSize;

  const buf = Buffer.alloc(44 + dataSize, 0);
  let offset = 0;

  buf.write('RIFF', offset); offset += 4;
  buf.writeUInt32LE(fileSize, offset); offset += 4;
  buf.write('WAVE', offset); offset += 4;
  buf.write('fmt ', offset); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4;           // PCM chunk size
  buf.writeUInt16LE(1, offset); offset += 2;            // PCM format
  buf.writeUInt16LE(numChannels, offset); offset += 2;
  buf.writeUInt32LE(sampleRate, offset); offset += 4;
  buf.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), offset); offset += 4; // byteRate
  buf.writeUInt16LE(numChannels * (bitsPerSample / 8), offset); offset += 2;              // blockAlign
  buf.writeUInt16LE(bitsPerSample, offset); offset += 2;
  buf.write('data', offset); offset += 4;
  buf.writeUInt32LE(dataSize, offset);

  return buf;
}

async function navigateToSessionDetail(page: Parameters<typeof signInAsTestUser>[0]): Promise<string | null> {
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

    await fileInput.setInputFiles({
      name: 'test-silence.wav',
      mimeType: 'audio/wav',
      buffer: makeWavBuffer(),
    });
  }, 15_000);

  await checkpoint(testInfo, 'verify-upload-accepted', async () => {
    // After upload: button reverts to non-uploading state, and either a recording
    // entry appears or a status badge (pending/processing/queued/uploaded) is visible.
    const uploadButton = page.getByRole('button', { name: /upload recording/i });

    // Wait for uploading state to clear
    await expect(uploadButton).not.toHaveText(/uploading/i, { timeout: 30_000 });

    const recordingEntry = page
      .getByText(/audio recording/i)
      .or(page.getByText(/pending/i))
      .or(page.getByText(/processing/i))
      .or(page.getByText(/queued/i))
      .or(page.getByText(/uploaded/i))
      .or(page.getByRole('button', { name: /play/i }));

    await expect(recordingEntry.first()).toBeVisible({ timeout: 20_000 });
  }, 30_000);

  await checkpoint(testInfo, 'no-crash-or-error-page', async () => {
    await expect(page.getByText(/failed to load|500 internal|something went wrong/i)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/error|\/500/);
  }, 5_000);
});
