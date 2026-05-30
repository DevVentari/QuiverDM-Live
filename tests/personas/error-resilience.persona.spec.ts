import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const REX_EMAIL = process.env.QA_REX_EMAIL ?? 'rex@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'rexs-test-campaign';

test('error-resilience happy path: pages render content when API succeeds', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, REX_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'campaigns-load-normally', async () => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const content = page.getByRole('heading', { name: /campaigns/i })
      .or(page.getByText(/no campaigns/i))
      .or(page.locator('a[href*="/campaigns/"]').first());
    await expect(content.first()).toBeVisible({ timeout: 10_000 });

    // No blank screen
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(50);
  }, 15_000);

  await checkpoint(testInfo, 'sessions-page-not-blank', async () => {
    // Intercept sessions tRPC call and return a server error
    await page.route('**/api/trpc/**', async route => {
      if (route.request().url().includes('sessions.getAll')) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Page must show something — either cached data, error state, or empty state
    // Not a blank white crash
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(50);

    // Campaign chrome (nav/header) should still render
    const campaignChrome = page.getByText(/rex.s test campaign/i)
      .or(page.getByText(/rexs test campaign/i))
      .or(page.getByRole('navigation'));
    await expect(campaignChrome.first()).toBeVisible({ timeout: 10_000 });

    await page.unroute('**/api/trpc/**');
  }, 20_000);
});

test('error-resilience failure path: hard API failure surfaces a user-facing error, not a blank crash', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, REX_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-campaign-create-form', async () => {
    await page.goto('/campaigns/new');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('button', { name: /create campaign/i })).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'api-failure-shows-error-not-crash', async () => {
    // Intercept campaign create mutation to return a tRPC-formatted error
    await page.route('**/api/trpc/**', async route => {
      if (route.request().url().includes('campaigns.create')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            error: {
              json: {
                message: 'Service unavailable',
                code: -32603,
                data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
              },
            },
          }]),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('textbox', { name: /^name$/i }).fill('Error Test Campaign');
    await page.getByRole('button', { name: /create campaign/i }).click();

    // App must surface an error message — not go blank
    await expect(
      page.locator('[role="alert"]')
        .or(page.locator('.text-destructive'))
        .or(page.getByText(/something went wrong|error|failed|service unavailable/i))
        .first()
    ).toBeVisible({ timeout: 15_000 });

    // Body still has content — not a blank white screen
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(50);

    await page.unroute('**/api/trpc/**');
  }, 20_000);
});
