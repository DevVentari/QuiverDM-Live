import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import { checkpoint, signInAsTestUser, ensureTestUserExists } from '../helpers';

/**
 * Acceptance gate — Campaign Forge / living reveal.
 *
 * Creating a campaign with a linked `cos` sourcebook navigates to
 * `/campaigns/<slug>/sessions?forged=cos`. The sessions page boots a one-shot
 * "forge" experience: a mist overlay, then the CampaignForgeReveal section.
 *
 * The reveal shows:
 *   - A "Your table is empty" invite panel while there are 0 PLAYER-role members
 *     (the OWNER/DM is excluded), so this stays visible for the whole run.
 *   - A settling line "The world is still settling… X of Y ready".
 *   - Seeded surfaces that fade in as the `session0-prep` BullMQ worker finishes:
 *     "Into the Mists" (Session 0 scene), "Madam Eva has spoken" (Tarokka),
 *     "Figures stir in the world" (seeded NPCs).
 *
 * This drives the real create path: it links the `cos` sourcebook from the
 * create sheet (`create-ddb-sb-cos`), which is exactly what enqueues the worker.
 * `beforeAll` makes the test user own a `cos` sourcebook so the link button
 * renders. The surface-reveal assertions depend on a live worker + AI, so they
 * use generous timeouts; the navigation + invite panel are deterministic.
 */

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

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

test.beforeAll(async () => {
  await ensureTestUserExists(VIC_EMAIL, PASSWORD);
  await ensureTestUserOwnsCosSourcebook(VIC_EMAIL);
});

test('campaign-forge: creating a CoS campaign opens the living reveal', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-create-sheet', async () => {
    await page.goto('/campaigns/new');
    await expect(page.getByRole('heading', { name: /new campaign/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('textbox', { name: /campaign name/i }).fill(`Forge QA ${Date.now()}`);
    // Step 2 holds the sourcebook link section.
    await page.getByRole('button', { name: /continue/i }).click();
  }, 12_000);

  await checkpoint(testInfo, 'select-cos-sourcebook', async () => {
    const cosButton = page.getByTestId('create-ddb-sb-cos');
    await expect(cosButton).toBeVisible({ timeout: 10_000 });
    await cosButton.click();
  }, 12_000);

  await checkpoint(testInfo, 'create-and-land-on-reveal', async () => {
    await page.getByRole('button', { name: /create campaign/i }).click();
    // Create redirects to /campaigns/<slug>/sessions?forged=cos. The page strips
    // ?forged after first paint, so assert the reveal UI (which the boot froze on)
    // rather than the transient query param.
    await page.waitForURL(/\/campaigns\/(?!new$)[^/]+\/sessions/, { timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText(/something went wrong|internal server error/i);
  }, 25_000);

  await checkpoint(testInfo, 'invite-panel-visible', async () => {
    // No players are ever invited in this run, so the "table is empty" ask stays up.
    await expect(page.getByText('Your table is empty')).toBeVisible({ timeout: 15_000 });
    // The settling line confirms the reveal is in its in-progress state.
    await expect(page.getByText(/still settling|Your world is ready/i)).toBeVisible({ timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'seeded-surfaces-fade-in', async () => {
    // These surfaces appear only after the async `session0-prep` worker (+ AI)
    // writes the seeded scenes and the UI poll picks them up. The hook polls for
    // ~60s; allow extra slack. If the worker isn't running in this environment,
    // these will time out — the navigation + invite assertions above still hold.
    await expect(page.getByText('Into the Mists')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText('Madam Eva has spoken')).toBeVisible({ timeout: 90_000 });
  }, 95_000);
});
