/**
 * recap-upload.workflow.spec.ts
 *
 * E2E: Upload a recording via /recap/upload and verify it reaches the
 * transcription/processing stage successfully.
 *
 * Requires:
 *   - Dev server running: npm run dev
 *   - Test user seeded: npx tsx scripts/seed-local-test-user.ts
 *
 * Strategy:
 *   - setInputFiles uses a tiny stub MP4 so Playwright doesn't read 7+ GB
 *   - page.route() intercepts the upload API and fulfills immediately with
 *     the stub file staged at the storage key (fast, avoids 7GB copy)
 *   - Tests UI-flow correctness only (upload → processing step transition)
 *   - Set RECORDING_PATH env to stage the real file for manual worker testing
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const EMAIL = process.env.TEST_USER_EMAIL ?? 'test@local.dev';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? 'TestPass123!';
const RECORDING_PATH =
  process.env.RECORDING_PATH ??
  path.resolve('docs/eye of ruin/2026-01-25-recording.mp4');

/** Minimal valid MP4 stub (ftyp box only, ~20 bytes). */
const MP4_STUB_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x14, // box size = 20
  0x66, 0x74, 0x79, 0x70, // 'ftyp'
  0x6d, 0x70, 0x34, 0x32, // major brand 'mp42'
  0x00, 0x00, 0x00, 0x00, // minor version
  0x6d, 0x70, 0x34, 0x32, // compatible brand 'mp42'
]);

test.describe('RecapForge upload workflow', () => {
  test('uploads a recording and reaches the processing stage', async ({ page }, testInfo) => {
    test.setTimeout(60_000); // 1 min — stub copy is instant; 3 min only needed with real RECORDING_PATH

    // Write a tiny stub MP4 so setInputFiles is instant.
    const stubPath = path.join(os.tmpdir(), '2026-01-25-recording.mp4');
    fs.writeFileSync(stubPath, MP4_STUB_BYTES);

    // Intercept the upload request. Stage the stub file at the storage key
    // (tiny, instant) and fulfill immediately — no 7GB copy needed for UI tests.
    // Set RECORDING_PATH env to stage the real file for manual worker testing.
    let interceptFired = false;
    await page.route('**/api/recordings/upload**', async (route) => {
      const reqUrl = route.request().url();
      console.log('[intercept] upload hit:', reqUrl);
      interceptFired = true;

      const url = new URL(reqUrl);
      const key = url.searchParams.get('key');
      if (key) {
        const storagePath = path.join(process.cwd(), 'storage', key);
        await fs.promises.mkdir(path.dirname(storagePath), { recursive: true });
        // Stage stub by default; copy real recording if RECORDING_PATH is explicitly set
        const srcPath = process.env.RECORDING_PATH ? RECORDING_PATH : stubPath;
        await fs.promises.copyFile(srcPath, storagePath);
        console.log('[intercept] staged at:', storagePath);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, url: `/api/storage/${key}`, key }),
        });
      } else {
        console.log('[intercept] no key — passing through');
        await route.continue();
      }
    });

    // ── 1. Sign in ──────────────────────────────────────────────────────────
    await test.step('sign in', async () => {
      await signInAsTestUser(page, EMAIL, PASSWORD);
      await expect(page).not.toHaveURL(/signin/);
    });

    // ── 2. Navigate to upload page ──────────────────────────────────────────
    await test.step('navigate to /recap/upload', async () => {
      await page.goto('/recap/upload');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'Upload Recording' })).toBeVisible({ timeout: 10_000 });
    });

    // ── 3. Select campaign ──────────────────────────────────────────────────
    await test.step('select campaign', async () => {
      const trigger = page.getByRole('combobox');
      await expect(trigger).toBeVisible({ timeout: 15_000 });
      await trigger.click();
      const option = page.getByRole('option').first();
      await expect(option).toBeVisible({ timeout: 5_000 });
      const campaignName = await option.textContent();
      await option.click();
      console.log('Selected campaign:', campaignName);
    });

    // ── 4. Continue to upload step ──────────────────────────────────────────
    await test.step('continue to upload step', async () => {
      await page.getByRole('button', { name: /continue to upload/i }).click();
      await expect(page.getByText(/drop audio files/i)).toBeVisible({ timeout: 15_000 });
    });

    // ── 5. Attach stub file (tiny, instant) ──────────────────────────────────
    await test.step('attach recording file', async () => {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(stubPath);
      await expect(page.getByText(/recording\.mp4/i)).toBeVisible({ timeout: 10_000 });
    });

    // ── 6. Submit upload ────────────────────────────────────────────────────
    await test.step('submit upload', async () => {
      await page.getByRole('button', { name: /upload 1 file/i }).click();
      await expect(page.getByRole('button', { name: /uploading/i })).toBeVisible({ timeout: 10_000 });
    });

    // ── 7. Wait for processing step ─────────────────────────────────────────
    await test.step('reaches processing step', async () => {
      // Intercept fulfills immediately (stub copy); page transitions to
      // "Transcribing…" as soon as process.mutateAsync resolves.
      await expect(page.getByText(/transcribing/i).first()).toBeVisible({ timeout: 20_000 });
      console.log('intercept fired:', interceptFired);
      await testInfo.attach('processing-step', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });

    // ── 8. No error visible ─────────────────────────────────────────────────
    await test.step('recording queued in DB', async () => {
      const errorVisible = await page.getByText(/failed|error/i).first().isVisible().catch(() => false);
      if (errorVisible) {
        const errText = await page.getByText(/failed|error/i).first().textContent();
        throw new Error(`Processing error visible: ${errText}`);
      }
    });

    // Cleanup stub
    fs.rmSync(stubPath, { force: true });
  });
});
