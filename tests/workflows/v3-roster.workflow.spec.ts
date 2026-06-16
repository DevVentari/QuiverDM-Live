import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 settings → Roster: live member management (role change, remove) + invite
// create/revoke. Invites without an email generate a shareable code (no email
// side effect), so this round-trips against the real backend.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PIP_EMAIL = 'pip@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-roster-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — roster & invites', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestUserExists(PIP_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Roster QA'); // vic = OWNER

    const campaign = await prisma.campaign.findUnique({ where: { slug: SLUG }, select: { id: true } });
    const pip = await prisma.user.findUnique({ where: { email: PIP_EMAIL }, select: { id: true } });
    if (!campaign || !pip) throw new Error('roster QA fixtures missing');

    // Pip is a PLAYER member to manage; clear any stale invites for a clean state.
    await prisma.campaignMember.upsert({
      where: { campaignId_userId: { campaignId: campaign.id, userId: pip.id } },
      update: { role: 'PLAYER' },
      create: { campaignId: campaign.id, userId: pip.id, role: 'PLAYER' },
    });
    await prisma.campaignInvite.deleteMany({ where: { campaignId: campaign.id } });
  });

  test('roster: member visible, invite create + revoke round-trips', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'roster-renders', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/settings`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByText(/Roster ·/i).first()).toBeVisible({ timeout: 12_000 });
      // The managed member + a role control are present.
      await expect(page.getByText(PIP_EMAIL).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('button', { name: /^Remove$/ }).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'invite-create-and-revoke', async () => {
      await expect(page.getByText(/Invites ·/i).first()).toBeVisible({ timeout: 8_000 });
      // Create a code invite (no email → no send).
      await page.getByRole('button', { name: /Create invite/i }).click();
      // A pending invite row with a copyable code appears.
      await expect(page.getByText(/code ·/i).first()).toBeVisible({ timeout: 10_000 });

      // Revoke it — the row disappears.
      await page.getByRole('button', { name: /^Revoke$/ }).first().click();
      await expect(page.getByText(/code ·/i)).toHaveCount(0, { timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
