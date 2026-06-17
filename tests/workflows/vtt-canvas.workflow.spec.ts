import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import { checkpoint, signInAsTestUser, ensureTestUserExists, ensureTestCampaignExists, TEST_USER_PASSWORD } from '../helpers';

const EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'vtt-canvas-qa';
const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('vtt — shared canvas mounts on both maps', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(EMAIL, PASSWORD);
    await ensureTestCampaignExists(EMAIL, SLUG, 'VTT Canvas QA');
    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!campaign) throw new Error('vtt QA campaign missing');
    await prisma.gameSession.deleteMany({ where: { campaignId: campaign.id } });
    const session = await prisma.gameSession.create({ data: { campaignId: campaign.id, sessionNumber: 1, title: 'VTT QA', status: 'active' } });
    const enc = await prisma.encounter.create({ data: { sessionId: session.id, name: 'VTT Ambush', status: 'active', round: 1 } });
    await prisma.encounterParticipant.create({ data: { encounterId: enc.id, name: 'Klarg', type: 'monster', initiative: 20, hp: 27, maxHp: 27 } });
  });

  test('battle-map renders a React Flow canvas with the DM map-art control', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'sign-in', async () => { await signInAsTestUser(page, EMAIL, PASSWORD); }, 15_000);
    await checkpoint(testInfo, 'combat-canvas', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/battle-map`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.locator('.react-flow')).toBeVisible({ timeout: 12_000 });
      await expect(page.getByTestId('combat-map-bg')).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
    await checkpoint(testInfo, 'world-canvas', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/world-map`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.locator('.react-flow')).toBeVisible({ timeout: 12_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
