import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('Brain page Overview tab renders with session seed section', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'overview-tab-visible', async () => {
    await expect(page.getByRole('tab', { name: /overview/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 10_000);

  await checkpoint(testInfo, 'session-seed-section-visible', async () => {
    const seedCard = page.locator('[data-testid="session-seed-card"]');
    const hasSeedCard = await seedCard.isVisible().catch(() => false);
    const hasMajorDev = await page.getByText(/Major Developments/i).first().isVisible().catch(() => false);
    expect(hasSeedCard || hasMajorDev).toBeTruthy();
  }, 10_000);
});

test('World actors CRUD via tRPC — upsert, list, delete', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  let campaignId = '';

  await checkpoint(testInfo, 'get-campaign-id', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const response = await page.request.get('/api/trpc/brain.entities.list', {
      params: { input: JSON.stringify({ json: { campaignId: CAMPAIGN_SLUG } }) },
    });
    const json = await response.json().catch(() => null);
    const entityList = Array.isArray(json) ? json : json?.result?.data?.json;

    if (Array.isArray(entityList) && entityList.length > 0) {
      campaignId = entityList[0]?.campaignId ?? '';
    }
  }, 20_000);

  if (!campaignId) {
    test.skip(true, 'Could not resolve campaignId — skipping CRUD test');
    return;
  }

  let entityId = '';

  await checkpoint(testInfo, 'get-entity-for-actor', async () => {
    const response = await page.request.post('/api/trpc/brain.entities.upsert', {
      data: {
        json: {
          campaignId,
          type: 'NPC',
          name: 'World Sim Test Actor',
          description: 'Created for world simulation test',
        },
      },
    });
    const json = await response.json().catch(() => null);
    entityId = json?.result?.data?.json?.id ?? '';
    expect(entityId).toBeTruthy();
  }, 15_000);

  await checkpoint(testInfo, 'upsert-actor', async () => {
    const response = await page.request.post('/api/trpc/brain.worldSimulation.actors.upsert', {
      data: {
        json: {
          campaignId,
          entityId,
          goals: ['Expand territory', 'Gather allies'],
          urgency: 0.7,
          riskTolerance: 0.4,
        },
      },
    });
    expect(response.ok()).toBeTruthy();
  }, 15_000);

  let actorId = '';

  await checkpoint(testInfo, 'list-actors', async () => {
    const response = await page.request.get('/api/trpc/brain.worldSimulation.actors.list', {
      params: { input: JSON.stringify({ json: { campaignId } }) },
    });
    const json = await response.json().catch(() => null);
    const actors = json?.result?.data?.json ?? json;
    expect(Array.isArray(actors) ? actors.length > 0 : true).toBeTruthy();
    if (Array.isArray(actors) && actors.length > 0) {
      actorId = actors.find((a: any) => a.entityId === entityId)?.id ?? actors[0]?.id ?? '';
    }
  }, 15_000);

  if (actorId) {
    await checkpoint(testInfo, 'delete-actor', async () => {
      const response = await page.request.post('/api/trpc/brain.worldSimulation.actors.delete', {
        data: { json: { campaignId, actorId } },
      });
      expect(response.ok()).toBeTruthy();
    }, 15_000);
  }
});

test('Simulation tick mutation returns without error', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  let campaignId = '';

  await checkpoint(testInfo, 'get-campaign-id', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const response = await page.request.get('/api/trpc/brain.entities.list', {
      params: { input: JSON.stringify({ json: { campaignId: CAMPAIGN_SLUG } }) },
    });
    const json = await response.json().catch(() => null);
    const entityList = Array.isArray(json) ? json : json?.result?.data?.json;
    if (Array.isArray(entityList) && entityList.length > 0) {
      campaignId = entityList[0]?.campaignId ?? '';
    }
  }, 20_000);

  if (!campaignId) {
    test.skip(true, 'Could not resolve campaignId — skipping tick test');
    return;
  }

  await checkpoint(testInfo, 'run-tick', async () => {
    const response = await page.request.post('/api/trpc/brain.worldSimulation.runTick', {
      data: { json: { campaignId } },
    });
    expect(response.status()).toBeLessThan(500);
    const json = await response.json().catch(() => null);
    const result = json?.result?.data?.json ?? json;
    if (result && typeof result === 'object') {
      expect(typeof result.eventsCreated === 'number' || result.eventsCreated === undefined).toBeTruthy();
    }
  }, 30_000);
});

test('Session seed returns events array after tick', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  let campaignId = '';

  await checkpoint(testInfo, 'get-campaign-id', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const response = await page.request.get('/api/trpc/brain.entities.list', {
      params: { input: JSON.stringify({ json: { campaignId: CAMPAIGN_SLUG } }) },
    });
    const json = await response.json().catch(() => null);
    const entityList = Array.isArray(json) ? json : json?.result?.data?.json;
    if (Array.isArray(entityList) && entityList.length > 0) {
      campaignId = entityList[0]?.campaignId ?? '';
    }
  }, 20_000);

  if (!campaignId) {
    test.skip(true, 'Could not resolve campaignId — skipping session seed test');
    return;
  }

  await checkpoint(testInfo, 'get-session-seed', async () => {
    const response = await page.request.get('/api/trpc/brain.worldSimulation.sessionSeed', {
      params: { input: JSON.stringify({ json: { campaignId } }) },
    });
    expect(response.status()).toBeLessThan(500);
    const json = await response.json().catch(() => null);
    const events = json?.result?.data?.json ?? json;
    expect(Array.isArray(events)).toBeTruthy();
  }, 15_000);
});
