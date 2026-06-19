import { test, expect } from '@playwright/test';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkpoint, signInAsTestUser, ensureTestUserExists } from '../helpers';

/**
 * Acceptance gate — CoS Session 0 seeding.
 *
 * When a Curse of Strahd sourcebook (slug `cos`) is linked to a fresh campaign,
 * the `session0-prep` BullMQ worker calls `seedSession0(...)`, which seeds the
 * campaign's Session 0 with:
 *   - 3 player-facing Scenes: "Into the Mists", "The Village of Barovia",
 *     "The Crying Children" (each with AI-generated SceneNotes).
 *   - 1 DM-facing Scene "Madam Eva's Reading" with 5 secret SceneNotes
 *     (the Tarokka draws) + matching PrepSecret rows for the campaign spine.
 *
 * Scenes belong to the campaign (Scene.campaignId) and surface on the campaign's
 * scenes route (`/v3/campaigns/<slug>/scenes`). The 3 opening scenes depend on a
 * live worker + AI (non-deterministic); the Tarokka scene is deterministic.
 *
 * This spec drives the real UI: it creates a campaign via the create sheet and
 * links the `cos` sourcebook from that sheet (button `create-ddb-sb-cos`), which
 * is exactly the path that enqueues the worker. `beforeAll` makes the test user
 * an owner of a `cos` sourcebook so the link button renders for them — the
 * opening config is resolved by the `cos` slug, so this drives the real CoS path.
 */

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

const OPENING_SCENE_TITLES = [
  'Into the Mists',
  'The Village of Barovia',
  'The Crying Children',
] as const;
const TAROKKA_SCENE_TITLE = "Madam Eva's Reading";

/**
 * Ensure the signed-in test user owns a `cos` sourcebook so the create sheet
 * renders the `create-ddb-sb-cos` link button. Idempotent — safe to re-run.
 * `DdbEntitlement` and `DdbSourcebook` are both unique on [userId, slug], so this
 * coexists with any production-owned `cos` sourcebook without collision.
 */
async function ensureTestUserOwnsCosSourcebook(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Test user ${email} not found — seed it first.`);

  const entitlement = await prisma.ddbEntitlement.upsert({
    where: { userId_slug: { userId: user.id, slug: 'cos' } },
    update: { title: 'Curse of Strahd', accessType: 'owned' },
    create: {
      userId: user.id,
      slug: 'cos',
      title: 'Curse of Strahd',
      accessType: 'owned',
      sourceUrl: 'https://www.dndbeyond.com/sources/cos',
    },
  });

  const existingBook = await prisma.ddbSourcebook.findFirst({
    where: { userId: user.id, slug: 'cos' },
    select: { id: true },
  });
  if (existingBook) {
    await prisma.ddbSourcebook.update({
      where: { id: existingBook.id },
      data: { title: 'Curse of Strahd', syncStatus: 'idle', entitlementId: entitlement.id },
    });
    return;
  }
  await prisma.ddbSourcebook.create({
    data: {
      userId: user.id,
      entitlementId: entitlement.id,
      slug: 'cos',
      title: 'Curse of Strahd',
      campaignIds: [],
      syncStatus: 'idle',
    },
  });
}

/** Read the seeded scenes for a campaign straight from the DB (worker output). */
async function readSeededScenes(slug: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!campaign) return null;
  const scenes = await prisma.scene.findMany({
    where: {
      campaignId: campaign.id,
      promptInput: { path: ['seededBy'], equals: 'session0' } as Prisma.JsonFilter,
    },
    select: {
      title: true,
      type: true,
      notes: { select: { type: true, title: true } },
    },
  });
  return { campaignId: campaign.id, scenes };
}

test.beforeAll(async () => {
  await ensureTestUserExists(VIC_EMAIL, PASSWORD);
  await ensureTestUserOwnsCosSourcebook(VIC_EMAIL);
});

test('session0-seed: linking CoS seeds opening scenes + Madam Eva tarokka reading', async ({ page }, testInfo) => {
  test.slow();

  let campaignSlug = '';

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-create-sheet', async () => {
    await page.goto('/campaigns/new');
    await expect(page.getByRole('heading', { name: /new campaign/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('textbox', { name: /campaign name/i }).fill(`Strahd Seed QA ${Date.now()}`);
    // Step 2 holds the sourcebook link section + story anchors.
    await page.getByRole('button', { name: /continue/i }).click();
  }, 12_000);

  await checkpoint(testInfo, 'select-cos-sourcebook', async () => {
    // The link button only renders for a user who owns a `cos` sourcebook
    // (seeded in beforeAll). Selecting it wires the link mutation on create.
    const cosButton = page.getByTestId('create-ddb-sb-cos');
    await expect(cosButton).toBeVisible({ timeout: 10_000 });
    await cosButton.click();
  }, 12_000);

  await checkpoint(testInfo, 'create-campaign', async () => {
    await page.getByRole('button', { name: /create campaign/i }).click();
    // Create redirects to /campaigns/<slug>/sessions (sourcebook link fires en route).
    await page.waitForURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText(/something went wrong|internal server error/i);
    campaignSlug = new URL(page.url()).pathname.split('/')[2] ?? '';
    expect(campaignSlug).not.toBe('');
    expect(campaignSlug).not.toBe('new');
  }, 25_000);

  // The worker is async (BullMQ on homelab + AI for the 3 opening scenes).
  // Poll the DB for the deterministic Tarokka scene, which seedSession0 always
  // writes when the `cos` opening config resolves.
  await checkpoint(testInfo, 'wait-for-tarokka-scene', async () => {
    await expect
      .poll(
        async () => {
          const seeded = await readSeededScenes(campaignSlug);
          return seeded?.scenes.some((s) => s.title === TAROKKA_SCENE_TITLE) ?? false;
        },
        { timeout: 110_000, intervals: [2_000, 3_000, 5_000] },
      )
      .toBe(true);
  }, 115_000);

  await checkpoint(testInfo, 'assert-tarokka-secrets', async () => {
    const seeded = await readSeededScenes(campaignSlug);
    expect(seeded).not.toBeNull();
    const tarokka = seeded!.scenes.find((s) => s.title === TAROKKA_SCENE_TITLE);
    expect(tarokka, 'Madam Eva DM scene must exist').toBeTruthy();

    // 5 secret SceneNotes — the Tarokka spine (Tome, Holy Symbol, Sunsword, ally, final stand).
    const secretNotes = (tarokka!.notes ?? []).filter((n) => n.type === 'secret');
    expect(secretNotes.length).toBe(5);

    // Durable campaign-spine PrepSecret rows written alongside the scene.
    const prepSecretCount = await prisma.prepSecret.count({ where: { campaignId: seeded!.campaignId } });
    expect(prepSecretCount).toBeGreaterThanOrEqual(5);
  }, 15_000);

  await checkpoint(testInfo, 'wait-for-opening-scenes', async () => {
    // The 3 opening scenes come from the AI scene-note pipeline. If the AI is
    // fully down, seedSession0 skips individual scenes — accept any subset but
    // require at least one opening scene to have landed alongside the Tarokka scene.
    await expect
      .poll(
        async () => {
          const seeded = await readSeededScenes(campaignSlug);
          if (!seeded) return 0;
          const titles = new Set(seeded.scenes.map((s) => s.title));
          return OPENING_SCENE_TITLES.filter((t) => titles.has(t)).length;
        },
        { timeout: 110_000, intervals: [3_000, 5_000] },
      )
      .toBeGreaterThanOrEqual(1);
  }, 115_000);

  await checkpoint(testInfo, 'scenes-surface-renders-seeded-scenes', async () => {
    await page.goto(`/v3/campaigns/${campaignSlug}/scenes`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);

    // Scene cards live in the left aside; the Tarokka scene title must be listed.
    await expect(page.getByText(TAROKKA_SCENE_TITLE).first()).toBeVisible({ timeout: 15_000 });

    // Selecting the Tarokka scene opens the NoteBoard, which renders its title heading.
    await page.getByText(TAROKKA_SCENE_TITLE).first().click();
    await expect(
      page.getByRole('heading', { name: TAROKKA_SCENE_TITLE }),
    ).toBeVisible({ timeout: 15_000 });

    // At least one seeded opening scene title is visible on the surface too.
    const openingVisible = await Promise.all(
      OPENING_SCENE_TITLES.map((t) =>
        page.getByText(t).first().isVisible({ timeout: 8_000 }).catch(() => false),
      ),
    );
    expect(openingVisible.some(Boolean)).toBeTruthy();
  }, 30_000);
});
