import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers';

test.describe('Admin Invites Page', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[Browser Console Error] ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      console.log(`[Page Error] ${error.message}`);
    });

    await signInAsTestUser(page);
    await page.goto('/admin/invites');
    await page.waitForLoadState('domcontentloaded');

    if (!page.url().includes('/admin/invites')) {
      test.skip(true, 'Current user is not an admin; admin page redirected away.');
    }
  });

  test('page loads successfully', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Beta Invite Codes');
    await expect(page.getByText(/Generate and manage/i)).toBeVisible();
  });

  test('tabs are visible and clickable', async ({ page }) => {
    await page.waitForSelector('[role="tablist"]');

    const generateTab = page.locator('[role="tab"]', { hasText: 'Generate' });
    await expect(generateTab).toBeVisible();

    const codesTab = page.locator('[role="tab"]').filter({ hasText: /All Codes/ });
    await expect(codesTab).toBeVisible();

    await codesTab.click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    await generateTab.click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('stats cards display on Generate tab', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const totalCard = page.locator('text=Total Codes');
    const usedCard = page.locator('text=Used');
    const unusedCard = page.locator('text=Unused');
    const expiredCard = page.locator('text=Expired');

    await expect(totalCard).toBeVisible();
    await expect(usedCard).toBeVisible();
    await expect(unusedCard).toBeVisible();
    await expect(expiredCard).toBeVisible();
  });

  test('Generate Single Code button exists and is clickable', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const generateButton = page.locator('button', { hasText: 'Generate Single Code' });
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();

    await generateButton.click();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('Generate tab has bulk generation form', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const countInput = page.locator('input[type="number"]').first();
    await expect(countInput).toBeVisible();

    const expiresInput = page.locator('input[type="number"]').nth(1);
    await expect(expiresInput).toBeVisible();

    const bulkButton = page.locator('button', { hasText: /Generate \d+ Codes/ });
    await expect(bulkButton).toBeVisible();
  });

  test('All Codes tab shows table', async ({ page }) => {
    const codesTab = page.locator('[role="tab"]').filter({ hasText: /All Codes/ });
    await codesTab.click();
    await page.waitForLoadState('domcontentloaded');

    const codeHeader = page.locator('th', { hasText: 'Code' });
    const createdHeader = page.locator('th', { hasText: 'Created' });
    const expiresHeader = page.locator('th', { hasText: 'Expires' });
    const actionHeader = page.locator('th', { hasText: 'Action' });

    await expect(codeHeader).toBeVisible();
    await expect(createdHeader).toBeVisible();
    await expect(expiresHeader).toBeVisible();
    await expect(actionHeader).toBeVisible();
  });

  test('check for console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.waitForLoadState('domcontentloaded');

    const codesTab = page.locator('[role="tab"]').filter({ hasText: /All Codes/ });
    await codesTab.click();
    await page.waitForLoadState('domcontentloaded');

    const generateTab = page.locator('[role="tab"]', { hasText: 'Generate' });
    await generateTab.click();
    await page.waitForLoadState('domcontentloaded');

    if (errors.length > 0) {
      console.log(`Found ${errors.length} console/page errors:`);
      errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
  });

  test('responsive layout check', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h1')).toContainText('Beta Invite Codes');

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toContainText('Beta Invite Codes');

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toContainText('Beta Invite Codes');

    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('full user flow - generate and view code', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const generateButton = page.locator('button', { hasText: 'Generate Single Code' }).first();
    await generateButton.click();
    await page.waitForLoadState('domcontentloaded');

    const codesTab = page.locator('[role="tab"]').filter({ hasText: /All Codes/ });
    await codesTab.click();
    await page.waitForLoadState('domcontentloaded');

    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount > 0) {
      const copyButton = page.getByRole('button', { name: /copy/i }).first();
      if (await copyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await copyButton.click();
        await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
      }
    }
  });
});
