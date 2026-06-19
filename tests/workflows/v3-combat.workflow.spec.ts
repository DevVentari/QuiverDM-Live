import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 combat tracker — wired to the campaign's *real* active encounter (not the
// demo board), and proves the live Heartflame path: editing a combatant surfaces
// a nudge in the "In the Margins" perch.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-combat-qa';
const ENCOUNTER_NAME = 'Ambush at the Crossroads';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — combat tracker (real encounter + live nudge)', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Combat QA');

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!campaign) throw new Error('combat QA campaign was not created');

    // A session to hang the encounter off (encounters belong to sessions).
    let session = await prisma.gameSession.findFirst({ where: { campaignId: campaign.id }, select: { id: true } });
    if (!session) {
      session = await prisma.gameSession.create({
        data: { campaignId: campaign.id, sessionNumber: 1, title: 'Combat QA', status: 'active' },
        select: { id: true },
      });
    }

    // Idempotent: clear prior encounters on this campaign's sessions, then seed one.
    const sessionIds = (await prisma.gameSession.findMany({ where: { campaignId: campaign.id }, select: { id: true } })).map((s) => s.id);
    await prisma.encounter.deleteMany({ where: { sessionId: { in: sessionIds } } });

    const enc = await prisma.encounter.create({
      data: { sessionId: session.id, name: ENCOUNTER_NAME, status: 'active', round: 2 },
    });
    await prisma.encounterParticipant.createMany({
      data: [
        // Bloodied + concentrating → deterministically fires the `concentration-at-risk` (risk) nudge.
        { encounterId: enc.id, name: 'Lyra the Bold', type: 'pc', initiative: 18, hp: 9, maxHp: 30, concentration: true },
        { encounterId: enc.id, name: 'Goblin Boss', type: 'monster', initiative: 14, hp: 21, maxHp: 21 },
        { encounterId: enc.id, name: 'Goblin', type: 'monster', initiative: 9, hp: 7, maxHp: 7, conditions: ['prone'] },
      ],
    });
  });

  test('combat: renders the live encounter and surfaces a Heartflame nudge', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'real-encounter-renders', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/combat`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      // Real data from the seeded encounter — not the demo board.
      await expect(page.getByText(ENCOUNTER_NAME).first()).toBeVisible({ timeout: 12_000 });
      await expect(page.getByText('Lyra the Bold').first()).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText('Goblin Boss').first()).toBeVisible({ timeout: 8_000 });
      // Round controls are wired to the real encounter service.
      await expect(page.getByRole('button', { name: /End round/i }).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'live-nudge-surfaces', async () => {
      // Editing any combatant re-evaluates the encounter; the bloodied concentrator
      // guarantees a risk nudge, which surfaces in the "In the Margins" perch.
      await page.getByRole('button', { name: /^Bonus$/ }).first().click();
      await expect(page.getByText(/In the Margins/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 20_000);
  });
});
