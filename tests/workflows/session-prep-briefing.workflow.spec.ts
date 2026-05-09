import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

const MOCK_CARDS = [
  {
    id: 'card-1',
    type: 'FACTION',
    entityName: 'Shadow Hand',
    urgencyLevel: 5,
    context: 'Three sessions since the party ignored the warning.',
    proposal: 'Open with a hooded figure leaving a marked coin on the table.',
    status: 'proposed',
  },
  {
    id: 'card-2',
    type: 'HOOK',
    entityName: 'The Ember Vault',
    urgencyLevel: 3,
    context: 'Hook first surfaced in Session 8. Decaying fast.',
    proposal: 'Have Valdris mention strange lights below the old quarter.',
    status: 'proposed',
  },
];

test.describe('Session Prep — World Briefing Board', () => {
  test('briefing board renders Brain-generated pressure cards', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/sessions.generateBriefing**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { cards: MOCK_CARDS } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getPrepContext**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { characters: [], npcs: [], recentSessions: [], homebrew: [] } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getById**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { id: 'test-session', title: 'Test Session', prepStatus: 'draft', prepData: null } } }]),
      });
    });

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await expect(page.getByText('World Pressure')).toBeVisible();
    await expect(page.getByText('Shadow Hand')).toBeVisible();
    await expect(page.getByText('The Ember Vault')).toBeVisible();
  });

  test('DM can accept a pressure card', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/sessions.generateBriefing**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { cards: MOCK_CARDS } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getPrepContext**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { characters: [], npcs: [], recentSessions: [], homebrew: [] } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getById**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { id: 'test-session', title: 'Test Session', prepStatus: 'draft', prepData: null } } }]),
      });
    });

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await page.getByRole('button', { name: 'Use this' }).first().click();
    await expect(page.getByText('1 of 2 reviewed')).toBeVisible();
  });

  test('DM can dismiss a pressure card', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/sessions.generateBriefing**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { cards: MOCK_CARDS } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getPrepContext**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { characters: [], npcs: [], recentSessions: [], homebrew: [] } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getById**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { id: 'test-session', title: 'Test Session', prepStatus: 'draft', prepData: null } } }]),
      });
    });

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await page.getByRole('button', { name: 'Dismiss' }).first().click();
    await expect(page.getByText('dismissed')).toBeVisible();
  });

  test('DM can edit a card proposal inline', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/sessions.generateBriefing**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { cards: MOCK_CARDS } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getPrepContext**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { characters: [], npcs: [], recentSessions: [], homebrew: [] } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getById**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { id: 'test-session', title: 'Test Session', prepStatus: 'draft', prepData: null } } }]),
      });
    });

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const textarea = page.locator('textarea').first();
    await textarea.clear();
    await textarea.fill('My custom version of the scene');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('edited')).toBeVisible();
  });

  test('DM can add a card Brain missed', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/sessions.generateBriefing**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { cards: MOCK_CARDS } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getPrepContext**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { characters: [], npcs: [], recentSessions: [], homebrew: [] } } }]),
      });
    });
    await page.route('**/api/trpc/sessions.getById**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { id: 'test-session', title: 'Test Session', prepStatus: 'draft', prepData: null } } }]),
      });
    });

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await page.goto('/campaigns/test-slug/sessions/prep?sessionId=test-session');
    await page.getByRole('button', { name: /Add something Brain missed/ }).click();
    await page.getByPlaceholder(/Describe a scene/).fill('Include the mysterious merchant subplot');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Include the mysterious merchant subplot')).toBeVisible();
  });
});
