import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Sessions → "PARTY · live": party HP is now aggregated from the session's
// CharacterSessionState (sessions.getPartyHp), closing the last real data gap.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-partyhp-qa';
const HERO = 'Thorin Hammerfell';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — live party HP', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Party HP QA');

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    const vic = await prisma.user.findUnique({ where: { email: VIC_EMAIL }, select: { id: true } });
    if (!campaign || !vic) throw new Error('party-hp QA fixtures missing');

    await prisma.gameSession.deleteMany({ where: { campaignId: campaign.id } });

    const character = await prisma.character.create({
      data: { userId: vic.id, name: HERO, level: 5, hitPoints: { current: 18, max: 30, temp: 5 } },
    });
    // in_progress so the run sheet selects this session.
    const session = await prisma.gameSession.create({
      data: { campaignId: campaign.id, sessionNumber: 1, title: 'Party HP QA', status: 'in_progress' },
    });
    await prisma.characterSessionState.create({
      data: { sessionId: session.id, characterId: character.id, currentHp: 18, tempHp: 5 },
    });
  });

  test('sessions: party HP aggregates from character session state', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'party-hp-renders', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/sessions`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });

      const panel = page.getByTestId('party-hp');
      await expect(panel).toBeVisible({ timeout: 12_000 });
      await expect(panel.getByText(HERO).first()).toBeVisible({ timeout: 8_000 });
      // 18 current / 30 max, +5 temp.
      await expect(panel.getByText('18/30 +5').first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
