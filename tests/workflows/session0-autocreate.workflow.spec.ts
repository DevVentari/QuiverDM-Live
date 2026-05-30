import { test, expect } from '@playwright/test';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { checkpoint, signInAsTestUser } from '../helpers';

const DM_EMAIL = 'session0-qa@test.local';
const DM_PASSWORD = 'TestPass123!';

async function seedCampaignWithSession0(prepStatus: 'draft' | 'complete' = 'complete') {
  const suffix = nanoid(6).toLowerCase();

  const passwordHash = await bcrypt.hash(DM_PASSWORD, 10);

  const dm = await prisma.user.upsert({
    where: { email: DM_EMAIL },
    update: { name: 'Session0 QA DM', onboardingCompleted: true },
    create: { email: DM_EMAIL, name: 'Session0 QA DM', onboardingCompleted: true },
  });

  const account = await prisma.account.findFirst({
    where: { userId: dm.id, provider: 'credentials' },
  });
  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: { providerAccountId: DM_EMAIL, type: 'credentials', password: passwordHash },
    });
  } else {
    await prisma.account.create({
      data: {
        userId: dm.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: DM_EMAIL,
        password: passwordHash,
      },
    });
  }

  const slug = `session0-qa-${suffix}`;
  const campaign = await prisma.campaign.create({
    data: {
      userId: dm.id,
      slug,
      name: `Session0 QA ${suffix}`,
      description: 'Workflow fixture for Session 0 auto-create.',
      status: 'active',
    },
  });

  await prisma.campaignMember.create({
    data: { campaignId: campaign.id, userId: dm.id, role: 'OWNER' },
  });

  const prepData: Prisma.InputJsonValue = {
    strongStart: 'The mists of Barovia close in around the party.',
    npcs: [],
    scenes: [],
    secrets: [],
    hooks: [],
    locations: [],
    items: [],
    notes: '',
  };

  const session0 = await prisma.gameSession.create({
    data: {
      campaignId: campaign.id,
      title: 'Session 0',
      sessionNumber: 0,
      status: 'planning',
      prepData,
      prepStatus,
    },
  });

  return { slug, session0Id: session0.id, dmId: dm.id };
}

test.describe('Session 0 auto-create — Sheet overlay', () => {
  test('Sheet opens automatically when session0 prepStatus is complete', async ({ page }, testInfo) => {
    const { slug, session0Id } = await seedCampaignWithSession0('complete');

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, DM_EMAIL, DM_PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'navigate-to-sessions', async () => {
      await page.goto(`/campaigns/${slug}/sessions`);
      await expect(page).toHaveURL(`/campaigns/${slug}/sessions`, { timeout: 10_000 });
    }, 12_000);

    await checkpoint(testInfo, 'sheet-opens-automatically', async () => {
      // Sheet should be visible — auto-opens on mount when not dismissed
      const sheet = page.locator('[role="dialog"]');
      await expect(sheet).toBeVisible({ timeout: 8_000 });
    }, 10_000);

    await checkpoint(testInfo, 'ready-state-content', async () => {
      await expect(page.getByText('Session 0 is ready')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText('Your campaign has been created')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('link', { name: /Review Session 0 Prep/i })).toBeVisible({ timeout: 5_000 });
    }, 10_000);

    await checkpoint(testInfo, 'cta-points-to-session', async () => {
      const ctaHref = await page.getByRole('link', { name: /Review Session 0 Prep/i }).getAttribute('href');
      expect(ctaHref).toContain(`/campaigns/${slug}/sessions/${session0Id}`);
    }, 5_000);

    // Cleanup — cascade via campaign delete (members + sessions cascade in FK)
    await prisma.gameSession.deleteMany({ where: { id: session0Id } });
    await prisma.campaignMember.deleteMany({ where: { campaign: { slug } } });
    await prisma.campaign.deleteMany({ where: { slug } });
  });

  test('Sheet shows shimmer while prepStatus is draft, then transitions to ready', async ({ page }, testInfo) => {
    const { slug, session0Id } = await seedCampaignWithSession0('draft');

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, DM_EMAIL, DM_PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'navigate-to-sessions', async () => {
      await page.goto(`/campaigns/${slug}/sessions`);
      await expect(page).toHaveURL(`/campaigns/${slug}/sessions`, { timeout: 10_000 });
    }, 12_000);

    await checkpoint(testInfo, 'sheet-opens-with-shimmer', async () => {
      const sheet = page.locator('[role="dialog"]');
      await expect(sheet).toBeVisible({ timeout: 8_000 });
      // Draft state shows "Preparing your prep…" heading
      await expect(page.getByText('Preparing your prep')).toBeVisible({ timeout: 5_000 });
      // Skeletons (animate-pulse divs) are present
      await expect(page.locator('.animate-pulse').first()).toBeVisible({ timeout: 3_000 });
    }, 10_000);

    // Transition the session to complete in the DB to simulate worker finishing
    await prisma.gameSession.update({
      where: { id: session0Id },
      data: { prepStatus: 'complete' },
    });

    await checkpoint(testInfo, 'transitions-to-ready', async () => {
      // HeroCard polls every 3s — wait for it to pick up the change
      await expect(page.getByText('Session 0 is ready')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('link', { name: /Review Session 0 Prep/i })).toBeVisible({ timeout: 5_000 });
    }, 20_000);

    // Cleanup
    await prisma.gameSession.deleteMany({ where: { id: session0Id } });
    await prisma.campaign.deleteMany({ where: { slug } });
  });

  test('Sheet does not reopen after dismiss', async ({ page }, testInfo) => {
    const { slug } = await seedCampaignWithSession0('complete');

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, DM_EMAIL, DM_PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'navigate-and-dismiss', async () => {
      await page.goto(`/campaigns/${slug}/sessions`);
      const sheet = page.locator('[role="dialog"]');
      await expect(sheet).toBeVisible({ timeout: 8_000 });
      await page.getByRole('button', { name: /skip for now/i }).click();
      await expect(sheet).not.toBeVisible({ timeout: 3_000 });
    }, 15_000);

    await checkpoint(testInfo, 'sheet-stays-closed-after-reload', async () => {
      await page.reload();
      // sessionStorage persists through reload in same page context
      const sheet = page.locator('[role="dialog"]');
      await expect(sheet).not.toBeVisible({ timeout: 5_000 });
    }, 10_000);

    // Cleanup
    await prisma.campaign.deleteMany({ where: { slug } });
  });
});
