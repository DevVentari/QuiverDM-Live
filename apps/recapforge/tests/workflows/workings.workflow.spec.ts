import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EMAIL = `workings-${Date.now()}@recapforge-test.local`;
const PASSWORD = 'strike-and-summon-1';

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    await prisma.campaign.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

test('workings: party management, cobalt seal, campaign switcher', async ({ page }) => {
  // Found the first chronicle
  await page.goto('/auth/signup');
  await page.getByTestId('signup-name').fill('Workings Tester');
  await page.getByTestId('signup-email').fill(EMAIL);
  await page.getByTestId('signup-password').fill(PASSWORD);
  await page.getByTestId('signup-submit').click();
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel(/campaign|chronicle/i).fill('First Chronicle');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /skip/i }).click();
  await page.getByPlaceholder(/player/i).fill('Dana');
  await page.getByPlaceholder(/character/i).fill("Kah'Roak");
  await page.getByRole('button', { name: /^add$/i }).click();
  await expect(page.getByText("Kah'Roak")).toBeVisible();
  await page.getByRole('button', { name: /open the ledger/i }).click();
  await page.waitForURL('/');

  // Into the workings via the masthead
  await page.getByRole('link', { name: 'Workings' }).click();
  await page.waitForURL(/\/workings/);
  await expect(page.getByRole('heading', { name: 'First Chronicle' })).toBeVisible();

  // Party: add a member, then strike them
  await page.getByLabel('Player name').fill('Blake');
  await page.getByLabel('Character name').fill('Listertest');
  await page.getByRole('button', { name: /^add$/i }).click();
  await expect(page.getByText('Listertest')).toBeVisible();
  await page
    .locator('div', { hasText: /^Listertest/ })
    .getByRole('button', { name: /strike from the party/i })
    .first()
    .click();
  await expect(page.getByText(/struck from the party/i)).toBeVisible();

  // The struck name is re-filed as an npc in the lexicon
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  const campaign = await prisma.campaign.findFirst({ where: { userId: user!.id } });
  const term = await prisma.lexiconTerm.findUnique({
    where: { campaignId_term: { campaignId: campaign!.id, term: 'Listertest' } },
  });
  expect(term?.kind).toBe('npc');

  // Cobalt seal: set → hint appears; summoning gate opens; break the seal
  await expect(page.getByText(/no seal on file/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /summon the party again/i })).toBeDisabled();
  await page.getByLabel('Cobalt cookie').fill('a-demo-cobalt-cookie-value-for-spec');
  await page.getByRole('button', { name: /keep the seal/i }).click();
  // "break the seal" only renders when a seal is on file — unambiguous signal
  await expect(page.getByRole('button', { name: /break the seal/i })).toBeVisible();
  await page.getByLabel('D&D Beyond campaign URL').fill('https://www.dndbeyond.com/campaigns/12345');
  await expect(page.getByRole('button', { name: /summon the party again/i })).toBeEnabled();
  await page.getByRole('button', { name: /break the seal/i }).click();
  await expect(page.getByText(/no seal on file/i)).toBeVisible();

  // Second chronicle → ledger switcher
  await page.goto('/onboarding');
  await page.getByLabel(/campaign|chronicle/i).fill('Second Chronicle');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /skip/i }).click();
  await page.getByRole('button', { name: /open the ledger/i }).click();
  await page.waitForURL('/');

  // Newest chronicle is the default; the first is offered in the switcher
  await expect(page.getByRole('heading', { name: 'Second Chronicle' })).toBeVisible();
  await expect(page.getByText(/also in the press/i)).toBeVisible();
  await page.getByRole('link', { name: 'First Chronicle' }).click();
  await expect(page.getByRole('heading', { name: 'First Chronicle' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Second Chronicle' })).toBeVisible();
});
