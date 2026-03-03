import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const NORA_EMAIL = process.env.QA_NORA_EMAIL ?? 'nora@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('new-dm happy path: onboarding to first campaign and first npc', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, NORA_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'onboarding-or-dashboard', async () => {
    const url = page.url();
    if (url.includes('/onboarding')) {
      await expect(
        page.getByRole('heading').or(page.locator('[data-step], .step-indicator, [aria-label*="step"]')).first()
      ).toBeVisible({ timeout: 10000 });

      const skipBtn = page.getByRole('button', { name: /skip|get started|continue|next/i }).first();
      if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForURL(/dashboard|campaigns/, { timeout: 15000 });
      } else {
        await page.waitForURL(/dashboard|campaigns/, { timeout: 15000 });
      }
    } else {
      await expect(page).toHaveURL(/dashboard|campaigns/);
    }
  }, 20_000);

  await checkpoint(testInfo, 'reach-campaigns', async () => {
    await page.goto('/campaigns');
    await page.waitForLoadState('domcontentloaded');
    await expect(
      page.getByRole('heading', { name: /campaigns/i })
        .or(page.getByText(/no campaigns|create your first/i))
        .first()
    ).toBeVisible({ timeout: 8000 });
  }, 10_000);

  let slug = '';

  await checkpoint(testInfo, 'create-campaign', async () => {
    await page.goto('/campaigns/new');
    await page.waitForLoadState('domcontentloaded');

    const campaignName = `Nora QA Campaign ${Date.now()}`;
    await page.getByRole('textbox', { name: /^name$/i }).fill(campaignName);

    const descField = page.getByRole('textbox', { name: /description/i });
    if (await descField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descField.fill('A test campaign for QA');
    }

    await page.getByRole('button', { name: /create campaign/i }).click();

    await page.waitForURL(url => {
      return /\/campaigns\//.test(url) && !url.includes('/new');
    }, { timeout: 12000 });

    const currentUrl = page.url();
    slug = currentUrl.split('/campaigns/')[1]?.split('/')[0] ?? '';
    expect(slug).toBeTruthy();
  }, 15_000);

  await checkpoint(testInfo, 'create-first-npc', async () => {
    await page.goto(`/campaigns/${slug}/npcs`);
    await page.waitForLoadState('domcontentloaded');

    const newNpcTrigger = page
      .getByRole('link', { name: /new npc/i })
      .or(page.getByRole('button', { name: /new npc|add npc|create npc/i }))
      .first();

    if (await newNpcTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newNpcTrigger.click();
      await page.waitForURL(/npcs\/new/, { timeout: 8000 });
    } else {
      await page.goto(`/campaigns/${slug}/npcs/new`);
    }

    await page.waitForLoadState('domcontentloaded');

    const npcName = `Nora QA Goblin ${Date.now()}`;
    await page.getByRole('textbox', { name: /^name$/i }).fill(npcName);

    const descField = page.getByRole('textbox', { name: /description/i });
    if (await descField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descField.fill('A test goblin for QA');
    }

    await page.getByRole('button', { name: /create npc|save|submit/i }).click();

    await page.waitForURL(url => {
      return /\/npcs\//.test(url) && !url.includes('/new');
    }, { timeout: 15000 });
  }, 20_000);

  await checkpoint(testInfo, 'npc-created', async () => {
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/npcs\//);
    expect(finalUrl).not.toContain('/new');

    await expect(
      page.getByRole('heading').or(page.locator('h1, h2')).first()
    ).toBeVisible({ timeout: 8000 });

    await expect(page.getByText(/something went wrong|500|error/i)).not.toBeVisible();
  }, 10_000);
});

test('new-dm failure path: invalid first campaign submit shows validation', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, NORA_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-campaign-form', async () => {
    await page.goto('/campaigns/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: /create campaign/i })).toBeVisible({ timeout: 8000 });
  }, 10_000);

  await checkpoint(testInfo, 'submit-empty', async () => {
    await page.getByRole('button', { name: /create campaign/i }).click();

    await expect(
      page.getByText(/required|name is required/i)
        .or(page.locator('[aria-invalid="true"]'))
        .or(page.locator('.text-destructive'))
        .first()
    ).toBeVisible({ timeout: 8000 });

    await expect(page).toHaveURL(/\/campaigns\/new/);
  }, 10_000);

  await checkpoint(testInfo, 'error-helpful', async () => {
    await expect(
      page.getByText(/required|name is required|invalid|field/i)
        .or(page.locator('[aria-invalid="true"]'))
        .first()
    ).toBeVisible({ timeout: 4000 });

    await expect(page.getByText(/something went wrong|500/i)).not.toBeVisible();
  }, 5_000);
});
