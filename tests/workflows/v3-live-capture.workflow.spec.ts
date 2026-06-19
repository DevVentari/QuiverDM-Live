import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Sessions — Phase 3 real-time mic capture. The DM "Go live" toggle starts the
// browser capture (mic → PCM16 → WS binary frames → AssemblyAI realtime). A fake
// media device lets getUserMedia resolve in headless; the WS server / cloud STT
// aren't in CI, so this asserts the toggle engages capture without crashing.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-livecap-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

// Fake mic so getUserMedia succeeds without hardware/prompts.
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

test.describe('v3 — live mic capture', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Live Capture QA');

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!campaign) throw new Error('live capture QA campaign missing');
    await prisma.gameSession.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.gameSession.create({
      data: { campaignId: campaign.id, sessionNumber: 1, title: 'Live Capture QA', status: 'in_progress' },
    });
  });

  test('go live: the DM can start and stop live capture', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'toggle-live', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/sessions`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });

      const goLive = page.getByTestId('go-live');
      await expect(goLive).toBeVisible({ timeout: 12_000 });
      await expect(goLive).toHaveText(/Go live/i);

      // Engage capture — button flips to "Stop live"; mic capture starts.
      await goLive.click();
      await expect(goLive).toHaveText(/Stop live/i, { timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);

      // Stop again — returns to idle without crashing.
      await goLive.click();
      await expect(goLive).toHaveText(/Go live/i, { timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
