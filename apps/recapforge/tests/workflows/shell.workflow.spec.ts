import { test, expect } from '@playwright/test';

const uniq = `wf-${Date.now()}`;
const email = `${uniq}@recapforge-test.local`;
const password = 'workflow-pass-123';

test.describe('RecapForge shell', () => {
  test('unauthenticated visit redirects to signin', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('signin-page')).toBeVisible();
  });

  test('health endpoint is public', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, app: 'recapforge' });
  });

  test('signup → lands authenticated on home', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.getByTestId('signup-name').fill('Workflow Tester');
    await page.getByTestId('signup-email').fill(email);
    await page.getByTestId('signup-password').fill(password);
    await page.getByTestId('signup-submit').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'RecapForge' })).toBeVisible();
  });

  test('signin with the created account works', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByTestId('signin-email').fill(email);
    await page.getByTestId('signin-password').fill(password);
    await page.getByTestId('signin-submit').click();
    await expect(page).toHaveURL('/');
  });

  test('signin with wrong password shows the error', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByTestId('signin-email').fill(email);
    await page.getByTestId('signin-password').fill('wrong-password-1');
    await page.getByTestId('signin-submit').click();
    await expect(page.getByTestId('signin-error')).toBeVisible();
  });

  test.afterAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.user.deleteMany({ where: { email: { endsWith: '@recapforge-test.local' } } });
    await prisma.$disconnect();
  });
});
