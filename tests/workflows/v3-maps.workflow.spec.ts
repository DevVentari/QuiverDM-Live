import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Maps — battle-map now reads the campaign's real active encounter (was the
// demo board); world-map reads real LOCATION world-entities. Token-drag
// persistence and fog-of-war remain net-new models (documented in the pages).

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-maps-qa';
const ENCOUNTER_NAME = 'Goblin Ambush (Maps QA)';
const LOCATION_NAME = 'Cragmaw Hideout';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — maps (real encounter + real locations)', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Maps QA');

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!campaign) throw new Error('maps QA campaign missing');

    // Active encounter for the battle map.
    await prisma.gameSession.deleteMany({ where: { campaignId: campaign.id } });
    const session = await prisma.gameSession.create({
      data: { campaignId: campaign.id, sessionNumber: 1, title: 'Maps QA', status: 'active' },
    });
    const enc = await prisma.encounter.create({
      data: { sessionId: session.id, name: ENCOUNTER_NAME, status: 'active', round: 1 },
    });
    await prisma.encounterParticipant.createMany({
      data: [
        { encounterId: enc.id, name: 'Klarg the Bugbear', type: 'monster', initiative: 20, hp: 27, maxHp: 27 },
        { encounterId: enc.id, name: 'Sildar Hallwinter', type: 'pc', initiative: 12, hp: 19, maxHp: 27 },
      ],
    });

    // A real LOCATION world-entity for the world map (unique on campaign+name+type).
    await prisma.worldEntity.deleteMany({ where: { campaignId: campaign.id, type: 'LOCATION' } });
    const location = await prisma.worldEntity.create({
      data: { campaignId: campaign.id, type: 'LOCATION', name: LOCATION_NAME, description: 'A goblin warren in the Neverwinter Wood.', status: 'active', properties: {} },
    });

    // The location must be PINNED on a root map for a React Flow node to exist
    // (VttCanvas renders pins, not bare entities). Seed the root map + pin so the
    // drag has a target.
    await prisma.campaignMap.deleteMany({ where: { campaignId: campaign.id } });
    const map = await prisma.campaignMap.create({
      data: { campaignId: campaign.id, name: 'Faerûn', backgroundType: 'BLANK' },
    });
    await prisma.mapPin.create({
      data: { mapId: map.id, entityId: location.id, x: 120, y: 90 },
    });
  });

  test('battle-map shows the real encounter; world-map shows real locations', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'battle-map-real-encounter', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/battle-map`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      // The seeded encounter name proves it's the real board, not "Heartflame Demo".
      await expect(page.getByText(ENCOUNTER_NAME).first()).toBeVisible({ timeout: 12_000 });
      await expect(page.getByText(/Klarg the Bugbear/i).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'world-map-real-locations', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/world-map`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByText(LOCATION_NAME).first()).toBeVisible({ timeout: 12_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'world-map-pin-persists', async () => {
      const node = page.locator('.react-flow__node').first();
      await expect(node).toBeVisible({ timeout: 8_000 });
      const box = await node.boundingBox();
      if (!box) throw new Error('no node box');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 140, box.y + 90, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => {
        const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
        const pins = await prisma.mapPin.count({ where: { map: { campaignId: campaign!.id } } });
        return pins;
      }, { timeout: 8_000 }).toBeGreaterThan(0);
    }, 20_000);
  });
});
