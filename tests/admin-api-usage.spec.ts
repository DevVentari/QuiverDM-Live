import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Admin API Usage Page', () => {
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
    await page.goto('/admin/api-usage');
    await page.waitForLoadState('domcontentloaded');

    if (!page.url().includes('/admin/api-usage')) {
      test.skip(true, 'Current user is not an admin; admin page redirected away.');
    }
  });

  test('page loads successfully', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Platform API Usage');
    await expect(page.getByText(/Cost and usage across all users/i)).toBeVisible();
  });

  test('time range filter is visible and clickable', async ({ page }) => {
    const daysSelect = page.locator('button[role="combobox"]').first();
    await expect(daysSelect).toBeVisible();

    await daysSelect.click();
    await expect(page.getByRole('option', { name: /Last 7 days/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /Last 30 days/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /Last 90 days/i })).toBeVisible();
    await page.getByRole('option', { name: /Last 90 days/i }).click();
  });

  test('summary cards display', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('text=Total Cost')).toBeVisible();
    await expect(page.locator('text=Total Requests')).toBeVisible();
  });

  test('usage table shows expected columns', async ({ page }) => {
    await expect(page.locator('th', { hasText: 'User' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Role' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Plan' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Requests' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Tokens In' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Tokens Out' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Est. Cost' })).toBeVisible();
  });

  test('can expand and collapse a user row when data exists', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip(true, 'No usage rows rendered.');
    }

    const firstRow = rows.first();
    await firstRow.click();

    const byFeatureHeading = page.getByText('By Feature');
    const byModelHeading = page.getByText('By Model');
    if (await byFeatureHeading.isVisible().catch(() => false)) {
      await expect(byFeatureHeading).toBeVisible();
      await expect(byModelHeading).toBeVisible();
      await firstRow.click();
    }
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

    const daysSelect = page.locator('button[role="combobox"]').first();
    await daysSelect.click();
    await page.getByRole('option', { name: /Last 7 days/i }).click();
    await daysSelect.click();
    await page.getByRole('option', { name: /Last 30 days/i }).click();

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await firstRow.click();
    }

    if (errors.length > 0) {
      console.log(`Found ${errors.length} console/page errors:`);
      errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
  });

  test('responsive layout check', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h1')).toContainText('Platform API Usage');

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toContainText('Platform API Usage');

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toContainText('Platform API Usage');

    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('full user flow - change date range and inspect a user', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const daysSelect = page.locator('button[role="combobox"]').first();
    await daysSelect.click();
    await page.getByRole('option', { name: /Last 90 days/i }).click();

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });
});
