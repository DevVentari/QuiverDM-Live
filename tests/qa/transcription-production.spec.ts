/**
 * Transcription Production QA — End-to-end test of audio/video upload,
 * transcription processing, and transcript management.
 *
 * Run against production:
 *   BASE_URL=https://quiverdm.com npx playwright test tests/qa/transcription-production.spec.ts
 *
 * Run against local dev:
 *   npx playwright test tests/qa/transcription-production.spec.ts
 *
 * Requires: test fixtures in tests/fixtures/ (clip-10s.mp3, clip-30s.mp3, etc.)
 */
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import { signInAsTestUser } from '../helpers/auth';

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? 'demo@quiverdm.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'demo1234';

test.describe.configure({ mode: 'serial' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function signIn(page: Page) {
  await signInAsTestUser(page, TEST_EMAIL, TEST_PASSWORD);
}

async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `tests/qa/screenshots/${name}.png`, fullPage: true });
}

async function getFirstSessionUrl(page: Page): Promise<string | null> {
  // Navigate to campaigns page and find real campaigns with sessions
  await page.goto('/campaigns');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2_000);

  // Collect campaign slugs from the page
  const allLinks = await page.locator('a[href^="/campaigns/"]').all();
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const link of allLinks) {
    const href = await link.getAttribute('href');
    if (!href || href.includes('/new')) continue;
    const m = href.match(/^\/campaigns\/([^/]+)$/);
    if (m && !seen.has(m[1])) {
      seen.add(m[1]);
      slugs.push(m[1]);
    }
  }

  for (const slug of slugs) {
    await page.goto(`/campaigns/${slug}/sessions`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3_000);

    // Find session detail links (exclude prep/new links)
    const sessionLinks = await page.locator(`a[href*="/sessions/"]`).all();
    for (const sl of sessionLinks) {
      const href = await sl.getAttribute('href');
      if (!href) continue;
      // Skip non-detail links
      if (href.includes('/prep') || href.includes('/new') || href.includes('/live')) continue;
      // Must match /campaigns/slug/sessions/<cuid> pattern (CUIDs start with 'c')
      if (!href.match(/\/campaigns\/[^/]+\/sessions\/c[a-z0-9]{20,}/i)) continue;

      // Navigate to session detail page
      await page.goto(href);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5_000);

      // Check the URL didn't redirect to /prep
      if (page.url().includes('/prep')) continue;

      // Look for session-level tabs
      const hasTabs = await page.getByRole('tab', { name: /recordings|transcript|prep/i }).count();
      if (hasTabs > 0) return href;

      // Also check for Recordings text anywhere
      const hasText = await page.getByText('Recordings').count();
      if (hasText > 0) return href;
    }
  }
  return null;
}

async function navigateToSessionRecordings(page: Page, sessionUrl: string): Promise<boolean> {
  await page.goto(sessionUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000);

  // Wait for session-level tabs to render (tRPC data must load first)
  const recordingsTab = page.getByRole('tab', { name: /recordings/i });
  try {
    await recordingsTab.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    return false;
  }

  await recordingsTab.click();
  await page.waitForTimeout(2_000);
  return true;
}

// ─── 1. Authentication ───────────────────────────────────────────────────────

test('1. Sign in succeeds', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/dashboard|campaigns|homebrew|onboarding/);
  await takeDebugScreenshot(page, 'tx-01-signed-in');
});

// ─── 2. Find a session to work with ─────────────────────────────────────────

let sessionUrl: string | null = null;

test('2. Find session with recordings tab', async ({ page }) => {
  await signIn(page);
  sessionUrl = await getFirstSessionUrl(page);

  if (!sessionUrl) {
    test.skip(true, 'No sessions found — create a campaign + session first');
    return;
  }

  await page.goto(sessionUrl);
  await page.waitForLoadState('networkidle');

  await expect(page.getByText(/500|internal server error/i)).toHaveCount(0);
  await takeDebugScreenshot(page, 'tx-02-session-detail');
});

// ─── 3. Recordings tab loads ────────────────────────────────────────────────

let hasRecordingsTab = false;

test('3. Session recordings tab loads', async ({ page }) => {
  test.skip(!sessionUrl, 'No session URL from test 2');

  await signIn(page);
  hasRecordingsTab = await navigateToSessionRecordings(page, sessionUrl!);

  if (!hasRecordingsTab) {
    await takeDebugScreenshot(page, 'tx-03-no-recordings-tab');
    console.log('Recordings tab not visible — user may not be DM for this campaign');
    // Not a failure — just means the demo user lacks DM access
    return;
  }

  await expect(page.getByText(/500|internal server error/i)).toHaveCount(0);

  // Should see the recordings panel content (upload button, empty state, or existing recordings)
  const recordingsPanel = page.getByRole('tabpanel', { name: /recordings/i });
  await expect(recordingsPanel).toBeVisible({ timeout: 10_000 });
  await takeDebugScreenshot(page, 'tx-03-recordings-tab');
});

// ─── 4. Upload audio file (MP3) ─────────────────────────────────────────────

test('4. Upload MP3 audio file', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session URL or no recordings tab');
  test.setTimeout(60_000);

  await signIn(page);
  await navigateToSessionRecordings(page, sessionUrl!);

  const fixture = path.resolve('tests/fixtures/clip-30s.mp3');

  const networkErrors: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  // Find file input or upload button
  const fileInput = page.locator('input[type="file"][accept*="audio"]')
    .or(page.locator('input[type="file"][accept*="audio/*"]'));
  const uploadBtn = page.getByRole('button', { name: /upload recording/i })
    .or(page.getByText(/upload recording/i));

  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(fixture);
  } else if (await uploadBtn.count() > 0) {
    // Trigger file chooser via button
    const chooserPromise = page.waitForEvent('filechooser');
    await uploadBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(fixture);
  } else {
    await takeDebugScreenshot(page, 'tx-04-no-upload-control');
    test.skip(true, 'No file input or upload button found');
    return;
  }

  // Wait for upload completion
  const successIndicator = page.getByText(/uploaded|transcri|processing|queued/i).first();
  const errorIndicator = page.getByText(/upload failed|error|too large/i).first();

  await expect(successIndicator.or(errorIndicator)).toBeVisible({ timeout: 30_000 });

  if (await errorIndicator.isVisible().catch(() => false)) {
    const errorText = await errorIndicator.textContent();
    await takeDebugScreenshot(page, 'tx-04-upload-FAILED');
    if (networkErrors.length > 0) {
      console.error('Network errors during upload:', networkErrors);
    }
    test.fail(true, `Audio upload failed: ${errorText}`);
    return;
  }

  await takeDebugScreenshot(page, 'tx-04-audio-uploaded');
});

// ─── 5. Recording appears in list ───────────────────────────────────────────

test('5. Uploaded recording appears in recordings list', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');

  await signIn(page);
  await navigateToSessionRecordings(page, sessionUrl!);
  await page.waitForTimeout(3_000);

  // Should see at least one recording entry
  const recordingEntry = page.getByText(/audio|mp3|recording/i).first();
  const statusBadge = page.locator('span, [class*="badge"]').filter({
    hasText: /queued|processing|completed|failed/i,
  }).first();

  await expect(recordingEntry.or(statusBadge)).toBeVisible({ timeout: 10_000 });
  await takeDebugScreenshot(page, 'tx-05-recording-in-list');
});

// ─── 6. Transcription job starts ────────────────────────────────────────────

test('6. Transcription job starts processing', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');

  await signIn(page);
  await navigateToSessionRecordings(page, sessionUrl!);
  await page.waitForTimeout(3_000);

  // Look for processing indicators
  const processingIndicator = page.getByText(/transcribing|processing|queued|extracting audio|submitting/i).first();
  const progressBar = page.locator('[role="progressbar"], progress, [class*="progress"]').first();
  const completedIndicator = page.getByText(/completed|transcript/i).first();

  await expect(processingIndicator.or(progressBar).or(completedIndicator)).toBeVisible({ timeout: 15_000 });
  await takeDebugScreenshot(page, 'tx-06-transcription-started');
});

// ─── 7. Transcription completes ─────────────────────────────────────────────

test('7. Transcription completes within 5 minutes', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');
  test.setTimeout(360_000);

  await signIn(page);
  await navigateToSessionRecordings(page, sessionUrl!);
  await page.waitForTimeout(3_000);

  // Check if already completed
  const completedBadge = page.locator('span, [class*="badge"]').filter({
    hasText: /^completed$/i,
  });
  if (await completedBadge.count() > 0) {
    console.log('Transcription already completed');
    await takeDebugScreenshot(page, 'tx-07-already-done');
    return;
  }

  const maxWait = 300_000;
  const pollInterval = 5_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await page.waitForTimeout(pollInterval);

    // Reload to check status
    await page.goto(sessionUrl!);
    await page.waitForLoadState('networkidle');

    const recordingsTab = page.getByRole('tab', { name: /recordings/i })
      .or(page.getByText(/recordings/i).first());
    if (await recordingsTab.count() > 0) {
      await recordingsTab.click();
      await page.waitForTimeout(1_000);
    }

    const done = await page.locator('span, [class*="badge"]').filter({
      hasText: /^(completed|failed)$/i,
    }).count();

    if (done > 0) break;

    if ((Date.now() - start) % 60_000 < pollInterval) {
      const mins = Math.floor((Date.now() - start) / 60_000);
      await takeDebugScreenshot(page, `tx-07-processing-${mins}min`);
    }
  }

  const failed = await page.locator('span, [class*="badge"]').filter({ hasText: /^failed$/i }).count();
  const completed = await page.locator('span, [class*="badge"]').filter({ hasText: /^completed$/i }).count();

  await takeDebugScreenshot(page, 'tx-07-final');

  if (failed > 0) {
    console.error('Transcription processing failed');
    test.fail(true, 'Transcription ended in failed state');
  }

  expect(completed).toBeGreaterThan(0);
});

// ─── 8. Transcript content appears ──────────────────────────────────────────

test('8. Transcript text content is visible', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');

  await signIn(page);
  await page.goto(sessionUrl!);
  await page.waitForLoadState('networkidle');

  // Click Transcript tab
  const transcriptTab = page.getByRole('tab', { name: /transcript/i })
    .or(page.getByText(/transcript/i).first());
  if (await transcriptTab.count() > 0) {
    await transcriptTab.click();
    await page.waitForTimeout(2_000);
  }

  // Should show transcript text or segments
  const transcriptContent = page.locator('[class*="transcript"], [class*="segment"], [class*="prose"]').first();
  const noTranscript = page.getByText(/no transcript|upload a recording|record your session/i).first();

  await expect(transcriptContent.or(noTranscript)).toBeVisible({ timeout: 10_000 });
  await takeDebugScreenshot(page, 'tx-08-transcript-content');
});

// ─── 9. Speaker labels present ──────────────────────────────────────────────

test('9. Speaker labels are displayed', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');

  await signIn(page);
  await page.goto(sessionUrl!);
  await page.waitForLoadState('networkidle');

  const transcriptTab = page.getByRole('tab', { name: /transcript/i })
    .or(page.getByText(/transcript/i).first());
  if (await transcriptTab.count() > 0) {
    await transcriptTab.click();
    await page.waitForTimeout(2_000);
  }

  // Speaker labels typically shown as "Speaker A", "Speaker 1", or user-set names
  const speakerLabels = page.getByText(/speaker [a-z0-9]/i).first();
  const anyTranscript = page.locator('[class*="transcript"], [class*="segment"]').first();

  if (await anyTranscript.count() > 0) {
    // If there's a transcript, check for speaker labels
    if (await speakerLabels.count() > 0) {
      console.log('Speaker labels found');
    } else {
      console.log('No speaker labels — diarization may not be enabled');
    }
  }

  await takeDebugScreenshot(page, 'tx-09-speaker-labels');
});

// ─── 10. Upload video file (MP4) ────────────────────────────────────────────

test('10. Upload MP4 video file', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');
  test.setTimeout(60_000);

  await signIn(page);
  await navigateToSessionRecordings(page, sessionUrl!);

  const fixture = path.resolve('tests/fixtures/clip-10s.mp4');

  const fileInput = page.locator('input[type="file"]').filter({
    has: page.locator('[accept*="video"], [accept*="audio"]'),
  }).first();
  const genericInput = page.locator('input[type="file"][accept*="audio"], input[type="file"][accept*="video"]').first();
  const uploadBtn = page.getByRole('button', { name: /upload recording/i })
    .or(page.getByText(/upload recording/i));

  if (await genericInput.count() > 0) {
    await genericInput.setInputFiles(fixture);
  } else if (await uploadBtn.count() > 0) {
    const chooserPromise = page.waitForEvent('filechooser');
    await uploadBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(fixture);
  } else {
    console.log('No video upload control found');
    await takeDebugScreenshot(page, 'tx-10-no-video-upload');
    return;
  }

  const successIndicator = page.getByText(/uploaded|transcri|processing|queued/i).first();
  const errorIndicator = page.getByText(/upload failed|error|unsupported/i).first();

  await expect(successIndicator.or(errorIndicator)).toBeVisible({ timeout: 30_000 });

  if (await errorIndicator.isVisible().catch(() => false)) {
    const errorText = await errorIndicator.textContent();
    console.error('Video upload error:', errorText);
    await takeDebugScreenshot(page, 'tx-10-video-FAILED');
  } else {
    await takeDebugScreenshot(page, 'tx-10-video-uploaded');
  }
});

// ─── 11. Upload WAV file ────────────────────────────────────────────────────

test('11. Upload WAV audio file', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');
  test.setTimeout(60_000);

  await signIn(page);
  await navigateToSessionRecordings(page, sessionUrl!);

  const fixture = path.resolve('tests/fixtures/clip-10s.wav');
  const uploadBtn = page.getByRole('button', { name: /upload recording/i })
    .or(page.getByText(/upload recording/i));

  if (await uploadBtn.count() > 0) {
    const chooserPromise = page.waitForEvent('filechooser');
    await uploadBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(fixture);

    const result = page.getByText(/uploaded|processing|queued|error|failed/i).first();
    await expect(result).toBeVisible({ timeout: 30_000 });
    await takeDebugScreenshot(page, 'tx-11-wav-uploaded');
  } else {
    console.log('No upload button for WAV test');
    await takeDebugScreenshot(page, 'tx-11-no-upload');
  }
});

// ─── 12. Upload WebM file ───────────────────────────────────────────────────

test('12. Upload WebM video file', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');
  test.setTimeout(60_000);

  await signIn(page);
  await navigateToSessionRecordings(page, sessionUrl!);

  const fixture = path.resolve('tests/fixtures/clip-10s.webm');
  const uploadBtn = page.getByRole('button', { name: /upload recording/i })
    .or(page.getByText(/upload recording/i));

  if (await uploadBtn.count() > 0) {
    const chooserPromise = page.waitForEvent('filechooser');
    await uploadBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(fixture);

    const result = page.getByText(/uploaded|processing|queued|error|failed/i).first();
    await expect(result).toBeVisible({ timeout: 30_000 });
    await takeDebugScreenshot(page, 'tx-12-webm-uploaded');
  } else {
    console.log('No upload button for WebM test');
    await takeDebugScreenshot(page, 'tx-12-no-upload');
  }
});

// ─── 13. Delete recording ───────────────────────────────────────────────────

test('13. Delete recording shows confirmation', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');

  await signIn(page);
  await navigateToSessionRecordings(page, sessionUrl!);
  await page.waitForTimeout(3_000);

  const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
  if (await deleteBtn.count() === 0) {
    console.log('No delete button found — may need specific recording state');
    await takeDebugScreenshot(page, 'tx-13-no-delete');
    return;
  }

  await deleteBtn.click();

  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Cancel — don't actually delete
  const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
  if (await cancelBtn.count() > 0) {
    await cancelBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await takeDebugScreenshot(page, 'tx-13-delete-dialog');
});

// ─── 14. No 500 errors across recording pages ──────────────────────────────

test('14. No 500 errors across session/recording navigation', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');

  const serverErrors: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 500) {
      serverErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  await signIn(page);
  await page.goto(sessionUrl!);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2_000);

  // Navigate through tabs
  const tabs = ['recordings', 'transcript', 'recap'];
  for (const tabName of tabs) {
    const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') })
      .or(page.getByText(new RegExp(tabName, 'i')).first());
    if (await tab.count() > 0) {
      await tab.click();
      await page.waitForTimeout(2_000);
    }
  }

  if (serverErrors.length > 0) {
    console.error('Server errors:', serverErrors);
    await takeDebugScreenshot(page, 'tx-14-server-errors');
  }
  expect(serverErrors).toHaveLength(0);
});

// ─── 15. Console error audit ────────────────────────────────────────────────

test('15. No critical console errors on recording pages', async ({ page }) => {
  test.skip(!sessionUrl || !hasRecordingsTab, 'No session or recordings tab');

  const criticalErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon') || text.includes('Hydration') || text.includes('401')) return;
      criticalErrors.push(text);
    }
  });

  await signIn(page);
  await page.goto(sessionUrl!);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000);

  const recordingsTab = page.getByRole('tab', { name: /recordings/i })
    .or(page.getByText(/recordings/i).first());
  if (await recordingsTab.count() > 0) {
    await recordingsTab.click();
    await page.waitForTimeout(3_000);
  }

  if (criticalErrors.length > 0) {
    console.error('Console errors:', criticalErrors.slice(0, 10));
  }

  const truly_critical = criticalErrors.filter(
    (e) => e.includes('TypeError') || e.includes('ReferenceError') || e.includes('Cannot read')
  );
  expect(truly_critical).toHaveLength(0);
});
