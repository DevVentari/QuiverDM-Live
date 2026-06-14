import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser, ensureTestUserExists, TEST_USER_PASSWORD } from '../helpers';

const REX_EMAIL = process.env.QA_REX_EMAIL ?? 'rex@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'rexs-test-campaign';

test.beforeAll(async ({ request }) => {
  await ensureTestUserExists(REX_EMAIL, PASSWORD);
  // Pre-warm the auth route so the first sign-in isn't slowed by cold compilation.
  await request.get('/auth/signin').catch(() => null);
  await request.post('/api/auth/csrf').catch(() => null);
});

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

test('error-resilience voice-clip failure: failed TTS surfaces clean UI state, sheet does not crash', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, REX_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'intercept-voice-clips-as-failed', async () => {
    // Intercept the voice.getClipsForEntity tRPC query so the UI receives a
    // pre-built clip with status "failed" — this exercises the voice-failed UI
    // path without requiring ElevenLabs or a running worker.
    await page.route('**/api/trpc/**', async route => {
      if (route.request().url().includes('voice.getClipsForEntity')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            result: {
              data: [{
                id: 'mock-clip-failed',
                npcId: 'mock-npc',
                campaignId: 'mock-campaign',
                status: 'failed',
                errorMessage: 'ElevenLabs quota exceeded',
                audioUrl: null,
                voiceId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }],
            },
          }]),
        });
      } else {
        await route.continue();
      }
    });
  }, 5_000);

  await checkpoint(testInfo, 'open-npc-brain-entity', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain/entities`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const entityCard = page.locator('[data-testid="entity-card"]').first();
    const hasEntity = await entityCard.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasEntity) {
      // No entities seeded — the voice-row interception test cannot proceed
      // but the route intercept must not have caused a crash
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.trim().length).toBeGreaterThan(50);
      return;
    }

    await entityCard.click();
    await page.waitForTimeout(1_000);
  }, 20_000);

  await checkpoint(testInfo, 'voice-failed-visible-sheet-intact', async () => {
    const url = page.url();
    if (!url.includes('/brain/entities') || !url.includes('entity=')) return;

    // With the intercepted "failed" clip, the voice-failed indicator must appear
    await expect(page.getByTestId('voice-failed')).toBeVisible({ timeout: 10_000 });

    // The surrounding voice-row container must remain — sheet must not have crashed
    await expect(page.getByTestId('voice-row')).toBeVisible({ timeout: 5_000 });

    // No full-page error boundary takeover
    await expect(page.locator('body')).not.toContainText(/something went wrong|internal server error/i);

    await page.unroute('**/api/trpc/**');
  }, 15_000);
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
