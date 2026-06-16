import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Sessions — Phase 2 live transcript surface. The panel mounts on a live
// (in_progress) session and subscribes to the WebSocket live feed. Real captions
// need the WS server + AssemblyAI streaming; this asserts the surface mounts and
// shows its waiting/connecting state without crashing.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-live-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — live transcript surface', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Live QA');

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!campaign) throw new Error('live QA campaign missing');
    await prisma.gameSession.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.gameSession.create({
      data: { campaignId: campaign.id, sessionNumber: 1, title: 'Live QA Session', status: 'in_progress' },
    });
  });

  test('live transcript: panel mounts on a live session', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'panel-mounts', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/sessions`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });

      const panel = page.getByTestId('live-transcript');
      await expect(panel).toBeVisible({ timeout: 12_000 });
      await expect(panel.getByText(/LIVE TRANSCRIPT/i)).toBeVisible({ timeout: 8_000 });
      // Without a live feed it shows a waiting state — never crashes.
      await expect(panel.getByText(/Waiting for the live feed|Listening/i)).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
