import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';
import { seedEncounterPlansFromWorldEvents } from '@/lib/encounters/seed-encounter-plans';

// Phase 3b — EncounterPlans are seeded from a campaign's EVENT/encounter entities,
// linking each encounter's free-text monster list to real stat blocks (book-unique
// creature homebrew → SRD → custom). This spec seeds one encounter with a book
// creature + an SRD creature and asserts the resulting plan renders.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'encounter-plan-qa';
const EVENT_NAME = 'QA Crypt Ambush';
const CREATURE_NAME = 'QA Wraithling';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error|404/i;

test.describe('Phase 3b — encounter plan seeding', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'Encounter Plan QA');
    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true, userId: true } });
    if (!campaign?.userId) throw new Error('QA campaign not created');

    // Reset prior run artifacts (idempotent).
    await prisma.encounterPlan.deleteMany({ where: { campaignId: campaign.id, name: EVENT_NAME } });
    await prisma.worldEntity.deleteMany({ where: { campaignId: campaign.id, name: EVENT_NAME } });
    const priorHb = await prisma.homebrewContent.findFirst({ where: { userId: campaign.userId, name: CREATURE_NAME }, select: { id: true } });
    if (priorHb) {
      await prisma.campaignHomebrewContent.deleteMany({ where: { homebrewId: priorHb.id } });
      await prisma.homebrewContent.delete({ where: { id: priorHb.id } });
    }

    // A book-unique creature (homebrew) the encounter references.
    const creature = await prisma.homebrewContent.create({
      data: {
        userId: campaign.userId,
        type: 'creature',
        name: CREATURE_NAME,
        data: { ac: 14, hp: 52, cr: 4, type: 'undead', abilities: { str: 11, dex: 16, con: 14, int: 10, wis: 12, cha: 15 }, actions: [{ name: 'Life Drain', description: '7 (2d6) necrotic damage.' }] },
        images: [],
        tags: ['qa'],
        searchText: CREATURE_NAME,
        sourceType: 'dndbeyond_import',
      },
      select: { id: true },
    });
    await prisma.campaignHomebrewContent.create({ data: { campaignId: campaign.id, homebrewId: creature.id } });

    // An encounter EVENT referencing the book creature + an SRD creature.
    await prisma.worldEntity.create({
      data: {
        campaignId: campaign.id,
        type: 'EVENT',
        name: EVENT_NAME,
        aliases: [],
        description: 'Skeletal hands claw from the crypt floor as a wraithling rises.',
        properties: { subtype: 'encounter', difficulty: 'hard', monsters: [CREATURE_NAME, 'Goblin', 'Goblin'] },
      },
    });

    const result = await seedEncounterPlansFromWorldEvents(campaign.id, { write: true });
    if (result.plansCreated < 1 && result.plansSkipped < 1) throw new Error('no encounter plan seeded');
  });

  test('encounter: a plan seeded from an EVENT renders with its linked creatures', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'plan-appears-on-encounters-page', async () => {
      await page.goto(`/campaigns/${SLUG}/encounters`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByText(EVENT_NAME).first()).toBeVisible({ timeout: 12_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 30_000);
  });
});
