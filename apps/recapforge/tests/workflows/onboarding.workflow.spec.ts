import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EMAIL = `onboard-${Date.now()}@recapforge-test.local`;
const PASSWORD = 'proof-and-press-1';

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    await prisma.campaign.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

test('fresh account onboards: campaign → skip cobalt → manual party → ledger', async ({ page }) => {
  // Sign up
  await page.goto('/auth/signup');
  await page.getByTestId('signup-name').fill('Onboard Tester');
  await page.getByTestId('signup-email').fill(EMAIL);
  await page.getByTestId('signup-password').fill(PASSWORD);
  await page.getByTestId('signup-submit').click();

  // A user with no forge campaign is sent to onboarding
  await page.waitForURL(/\/onboarding/);

  // Step 1 — name the campaign
  const wizard = page.locator('main.rf-page');
  await wizard.getByLabel(/campaign|chronicle/i).fill('Spec Test Chronicle');
  await wizard.getByRole('button', { name: /continue|next/i }).click();

  // Step 2 — skip cobalt
  await wizard.getByRole('button', { name: /skip/i }).click();

  // Step 3 — manual party
  await wizard.getByPlaceholder(/player/i).fill('Dana');
  await wizard.getByPlaceholder(/character/i).fill("Kah'Roak");
  await wizard.getByRole('button', { name: /add/i }).click();
  await expect(wizard.getByText("Kah'Roak")).toBeVisible();
  await wizard.getByRole('button', { name: /open the ledger|finish/i }).click();

  // Lands on the ledger and STAYS there (a campaign now exists, no bounce back)
  await page.waitForURL('/');
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL('/');
  // NOTE: Task 11 extends this spec to also assert the campaign name renders —
  // at this task's point in time '/' still shows the mock ledger.
});
