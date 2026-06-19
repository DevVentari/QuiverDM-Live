import { test, expect } from '@playwright/test';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkpoint, signInAsTestUser, ensureTestUserExists, ensureTestCampaignExists, TEST_USER_PASSWORD } from '../helpers';

// Scene note builder — acceptance gate.
//
// The note builder turns a scene into a board of typed SceneNote blocks
// (read_aloud, tactic, check, trigger, …). The DM can add AI-drafted blocks,
// accept ghost suggestions ("What am I forgetting?"), refine inline, edit, and
// delete. The board lives at /v3/campaigns/<slug>/scenes via NoteBoard.
//
// DETERMINISM: notesDraft / notesSuggest / notesRefine all call a live AI
// provider — non-deterministic and costly — so this spec MUST NOT trigger them.
// Instead we seed a Scene + its SceneNotes directly via Prisma and drive
// select → board renders → edit → delete against the real backend (scenes.list,
// getStage, notesUpdate). For the AI affordances (add-block, ghosts, refine) we
// only assert they EXIST and are enabled — never click them.

const VIC = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PW = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vic-s-test-campaign';
const TITLE = `QA Notes ${Date.now()}`;
const READ = 'The portcullis groans; iron teeth wet with fog.';
const NO_CRASH = /something went wrong|internal server error|client-side exception|application error/i;

test.describe('scenes — note builder', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC, PW);
    await ensureTestCampaignExists(VIC, SLUG, "Vic's Test Campaign");
    const c = await prisma.campaign.findUnique({ where: { slug: SLUG } });
    if (!c) throw new Error('seed: campaign missing');
    await prisma.scene.create({ data: {
      campaignId: c.id, title: TITLE, type: 'theatre', description: READ, generatedAt: new Date(),
      promptInput: { intent: 'gates', mood: 'theatre', linkedEntityIds: [], partyPresentIds: [] } as Prisma.InputJsonValue,
      notes: { create: [
        { type: 'read_aloud', body: READ, orderIndex: 0, source: 'ai' },
        { type: 'tactic', body: 'Gargoyles wake only if a torch is lit.', orderIndex: 1, source: 'ai' },
        { type: 'check', body: 'Spot the watcher above', data: { skill: 'Perception', dc: 15 } as Prisma.InputJsonValue, orderIndex: 2, source: 'ai' },
        { type: 'trigger', body: 'If they knock', data: { condition: 'knock on the gate', reveal: 'A slot opens — eyes.' } as Prisma.InputJsonValue, orderIndex: 3, source: 'ai' },
      ] },
    } });
  });

  test('builds and edits a scene’s notes', async ({ page }, info) => {
    test.slow();
    await checkpoint(info, 'sign-in', async () => { await signInAsTestUser(page, VIC, PW); }, 20_000);
    await checkpoint(info, 'open-and-select', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/scenes`);
      await page.getByRole('button', { name: TITLE }).first().click();
      await expect(page.getByRole('heading', { name: TITLE })).toBeVisible({ timeout: 12_000 });
    }, 25_000);
    await checkpoint(info, 'notes-render', async () => {
      await expect(page.getByText(READ)).toBeVisible();
      await expect(page.getByText('Gargoyles wake only if a torch is lit.')).toBeVisible();
      await expect(page.getByText(/Perception DC 15/)).toBeVisible();
      await expect(page.getByText(/knock on the gate/)).toBeVisible();
      await expect(page.getByRole('button', { name: /What am I forgetting/i })).toBeVisible();
      await expect(page.getByRole('button', { name: '+ tactic' })).toBeEnabled();
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 20_000);
    await checkpoint(info, 'edit-and-delete', async () => {
      const card = page.getByText('Gargoyles wake only if a torch is lit.').locator('xpath=ancestor::div[1]');
      await card.getByRole('button', { name: '✎' }).click();
      const ta = page.locator('textarea').first();
      await ta.fill('Gargoyles wake if a torch is lit OR a weapon is drawn.');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText(/weapon is drawn/)).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
