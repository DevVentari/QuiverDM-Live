import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Recordings — Phase 1 batch capture. The "Record session" affordance mounts
// the real AudioRecorder (MediaRecorder → /api/recordings/upload →
// sessionRecordings.create → transcription). Actual mic capture + cloud STT need
// hardware/keys, so this tests the wiring surface: the modal + recorder mount.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-record-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — session recording capture (batch)', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Record QA');

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!campaign) throw new Error('record QA campaign missing');
    // A live session gives the capture button a target to record into.
    const existing = await prisma.gameSession.findFirst({ where: { campaignId: campaign.id, status: 'in_progress' } });
    if (!existing) {
      await prisma.gameSession.create({
        data: { campaignId: campaign.id, sessionNumber: 1, title: 'Record QA Session', status: 'in_progress' },
      });
    }
  });

  test('capture: the record affordance opens the recorder', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'record-modal-opens', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/recordings`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });

      const btn = page.getByTestId('record-session');
      await expect(btn).toBeVisible({ timeout: 12_000 });
      await expect(btn).toBeEnabled({ timeout: 8_000 });
      await btn.click();

      // The modal + the real AudioRecorder mount, with a consent reminder.
      await expect(page.getByTestId('record-modal')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(/consent/i).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('button', { name: /Start Recording/i })).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
