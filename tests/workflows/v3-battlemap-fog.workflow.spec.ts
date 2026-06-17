import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Battle map — persisted token positions (EncounterParticipant.mapX/mapY) and
// fog of war (FogRegion). Dragging a token writes its coords; the DM covers /
// reveals fog and the regions persist.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-fog-qa';
const ENCOUNTER_NAME = 'Crossroads Skirmish (Fog QA)';

let dragTokenId = '';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — battle map tokens & fog', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Fog QA');

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!campaign) throw new Error('fog QA campaign missing');

    await prisma.gameSession.deleteMany({ where: { campaignId: campaign.id } });
    const session = await prisma.gameSession.create({
      data: { campaignId: campaign.id, sessionNumber: 1, title: 'Fog QA', status: 'active' },
    });
    const enc = await prisma.encounter.create({
      data: { sessionId: session.id, name: ENCOUNTER_NAME, status: 'active', round: 1 },
    });
    const a = await prisma.encounterParticipant.create({
      data: { encounterId: enc.id, name: 'Goblin Sharpshooter', type: 'monster', initiative: 20, hp: 14, maxHp: 14 },
    });
    await prisma.encounterParticipant.create({
      data: { encounterId: enc.id, name: 'Sister Garaele', type: 'pc', initiative: 10, hp: 22, maxHp: 22 },
    });
    dragTokenId = a.id;
  });

  test('battle map: drag persists a token and fog covers/reveals', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'tokens-render', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/battle-map`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByText(ENCOUNTER_NAME).first()).toBeVisible({ timeout: 12_000 });
      await expect(page.getByTestId(`token-${dragTokenId}`)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'drag-persists-position', async () => {
      const token = page.getByTestId(`token-${dragTokenId}`);
      const box = await token.boundingBox();
      if (!box) throw new Error('token has no bounding box');
      // Drag the token a good distance across the canvas.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 220, box.y + 140, { steps: 8 });
      await page.mouse.up();

      // The new position persisted to EncounterParticipant.mapX/mapY.
      await expect
        .poll(async () => {
          const p = await prisma.encounterParticipant.findUnique({
            where: { id: dragTokenId },
            select: { mapX: true },
          });
          return p?.mapX ?? null;
        }, { timeout: 10_000 })
        .not.toBeNull();
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'token-drag-persists', async () => {
      const node = page.locator('.react-flow__node').first();
      await expect(node).toBeVisible({ timeout: 8_000 });
      const box = await node.boundingBox();
      if (!box) throw new Error('no token box');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => {
        const placed = await prisma.encounterParticipant.count({
          where: { encounter: { session: { campaign: { slug: SLUG } } }, mapX: { not: null } },
        });
        return placed;
      }, { timeout: 8_000 }).toBeGreaterThan(0);
    }, 20_000);

    await checkpoint(testInfo, 'fog-cover-and-reveal', async () => {
      // Cover all → a fog region renders.
      await page.getByTestId('fog-cover-all').click();
      await expect(page.locator('[data-testid^="fogregion-"]').first()).toBeVisible({ timeout: 10_000 });

      // Reveal all → no fog regions remain.
      await page.getByTestId('fog-reveal-all').click();
      await expect(page.locator('[data-testid^="fogregion-"]')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
