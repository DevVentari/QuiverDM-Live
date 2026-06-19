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
// compose form (assert it validates) → select a seeded scene → see its note
// board → edit a note inline. The scene surface is now the NoteBoard (a board of
// typed SceneNote blocks), not the old two-column SceneStage. The present/clear
// flow is deferred to Layer 2 (VTT/map) and is not asserted here.
//
// DETERMINISM: scenes.generate (and the note AI affordances) call a live AI
// provider — non-deterministic and costly — so the spec MUST NOT submit them. We
// open the compose form only to assert validation, then seed a Scene + its
// SceneNotes directly via Prisma and drive SELECT → board → edit against the real
// backend (scenes.list, getStage, notesUpdate).

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vic-s-test-campaign';

const NO_CRASH =
  /something went wrong|internal server error|unhandled error|client-side exception|application error|404 \| this page/i;

const SCENE_TITLE = `QA Scene ${Date.now()}`;
const READ_ALOUD =
  'The castle gates loom out of the dusk, iron teeth wet with fog. No torches burn.';
const TACTIC = 'Strahd watches from the parapet but will not reveal himself this turn.';

test.describe('scenes — AI scene creation', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, "Vic's Test Campaign");

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG } });
    if (!campaign) throw new Error(`Seed failed: campaign ${SLUG} not found.`);

    // A fully generated scene with a board of typed notes — so the NoteBoard
    // renders without calling AI.
    await prisma.scene.create({
      data: {
        campaignId: campaign.id,
        title: SCENE_TITLE,
        type: 'theatre',
        description: READ_ALOUD,
        generatedAt: new Date(),
        promptInput: {
          intent: 'The party reaches the castle gates at dusk.',
          mood: 'theatre',
          linkedEntityIds: [],
          partyPresentIds: [],
        } as Prisma.InputJsonValue,
        notes: {
          create: [
            { type: 'read_aloud', body: READ_ALOUD, orderIndex: 0, source: 'ai' },
            { type: 'tactic', body: TACTIC, orderIndex: 1, source: 'ai' },
            {
              type: 'check',
              body: 'spot the watcher above',
              data: { skill: 'Perception', dc: 15 } as Prisma.InputJsonValue,
              orderIndex: 2,
              source: 'ai',
            },
          ],
        },
      },
    });
  });

  test('scenes: DM composes, selects a scene, and edits its note board', async ({ page }, testInfo) => {
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

    await checkpoint(testInfo, 'select-scene-shows-note-board', async () => {
      // Cancel out of compose, then select the seeded scene from the gallery.
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: SCENE_TITLE }).first().click();

      await expect(page.getByRole('heading', { name: SCENE_TITLE })).toBeVisible({ timeout: 12_000 });
      await expect(page.getByText(READ_ALOUD)).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(TACTIC)).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(/Perception DC 15/)).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('button', { name: /What am I forgetting/i })).toBeVisible();
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'edit-a-note', async () => {
      const card = page.getByText(TACTIC).locator('xpath=ancestor::div[1]');
      await card.getByRole('button', { name: '✎' }).click();
      const edited = `${TACTIC} A bell tolls once.`;
      const textarea = page.locator('textarea').first();
      await textarea.fill(edited);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText(edited)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
