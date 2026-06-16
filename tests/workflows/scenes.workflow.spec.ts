import { test, expect } from '@playwright/test';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// AI scene creation — acceptance gate.
//
// The DM journey: sign in → open the v3 Scenes page → open the "+ New Scene"
// compose form → fill the "describe the scene" textarea → see the two-column
// reveal (title + read-aloud + DM notes) → present to players (Live appears).
//
// DETERMINISM: scenes.generate calls a real AI provider (Claude) — it is
// non-deterministic and costs money, so the spec MUST NOT submit it. Instead we
// seed a fully-generated Scene row directly via Prisma (the same mechanism the
// auth helpers use) and drive the SELECT → reveal → edit → present flow against
// the real backend. This exercises scenes.list, getStage, update and present
// end-to-end. We still open the compose form and assert it validates
// (submit disabled until a description is typed) without invoking AI.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vic-s-test-campaign';

const NO_CRASH =
  /something went wrong|internal server error|unhandled error|client-side exception|application error|404 \| this page/i;

const SCENE_TITLE = `QA Scene ${Date.now()}`;
const READ_ALOUD =
  'The castle gates loom out of the dusk, iron teeth wet with fog. No torches burn.';
const DM_NOTES = 'Strahd watches from the parapet but will not reveal himself this turn.';

test.describe('scenes — AI scene creation', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, "Vic's Test Campaign");

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG } });
    if (!campaign) throw new Error(`Seed failed: campaign ${SLUG} not found.`);

    // Clear any presented flags so this run's assertions are deterministic.
    await prisma.scene.updateMany({
      where: { campaignId: campaign.id },
      data: { isPresented: false },
    });

    // A fully AI-generated scene row — generatedAt set, all reveal fields
    // populated — so the two-column SceneStage renders without calling AI.
    await prisma.scene.create({
      data: {
        campaignId: campaign.id,
        title: SCENE_TITLE,
        type: 'theatre',
        description: READ_ALOUD,
        dmNotes: DM_NOTES,
        musicCue: 'low strings, distant wind',
        isPresented: false,
        linkedEntityIds: [] as unknown as Prisma.InputJsonValue,
        partyPresentIds: [] as unknown as Prisma.InputJsonValue,
        suggestedChecks: [
          { skill: 'Perception', dc: 15, note: 'spot the watcher above' },
        ] as unknown as Prisma.InputJsonValue,
        entityBeats: {} as Prisma.InputJsonValue,
        generatedAt: new Date(),
        promptInput: {
          intent: 'The party reaches the castle gates at dusk.',
          mood: 'theatre',
          linkedEntityIds: [],
          partyPresentIds: [],
        } as Prisma.InputJsonValue,
      },
    });
  });

  test('scenes: DM composes, reveals, edits, and presents a scene', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 20_000);

    await checkpoint(testInfo, 'open-scenes-page', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/scenes`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByText(/Theatre of the Mind/i).first()).toBeVisible({ timeout: 12_000 });
      // The seeded scene shows in the gallery sidebar.
      await expect(page.getByRole('button', { name: SCENE_TITLE }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'open-compose-form-validates', async () => {
      await page.getByRole('button', { name: '+ New Scene' }).click();
      await expect(page.getByText('New scene')).toBeVisible({ timeout: 8_000 });

      const create = page.getByRole('button', { name: /Create scene/i });
      // Submit is disabled until a description is entered — no live AI call made.
      await expect(create).toBeDisabled();

      const describe = page.getByPlaceholder(/The party reaches the castle gates/i);
      await describe.fill('A torchlit war council in the keep, voices low.');
      await expect(create).toBeEnabled();

      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 20_000);

    await checkpoint(testInfo, 'select-scene-shows-two-column-reveal', async () => {
      // Cancel out of compose, then select the seeded scene from the gallery.
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: SCENE_TITLE }).first().click();

      // LEFT column — player-facing: title + read-aloud.
      await expect(page.getByRole('heading', { name: SCENE_TITLE })).toBeVisible({ timeout: 12_000 });
      await expect(page.getByText('Read aloud')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(READ_ALOUD)).toBeVisible({ timeout: 8_000 });

      // RIGHT column — DM only: secret beats / DM notes.
      await expect(page.getByText(/DM only — the board/i)).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText('Secret beats')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(DM_NOTES)).toBeVisible({ timeout: 8_000 });

      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'edit-read-aloud', async () => {
      // The Read aloud block's edit button (first ✎ edit on the page is the left column).
      await page.getByRole('button', { name: /✎ edit/ }).first().click();
      const edited = `${READ_ALOUD} A bell tolls once.`;
      const textarea = page.locator('textarea').first();
      await textarea.fill(edited);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText(edited)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'present-to-players-goes-live', async () => {
      await page.getByRole('button', { name: /Present to players/i }).click();
      // After presenting, the CTA flips to the live/clear state.
      await expect(page.getByRole('button', { name: /Live — clear/i })).toBeVisible({ timeout: 12_000 });
      // And the gallery row gains a live badge.
      await expect(page.getByText(/● live/i).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
