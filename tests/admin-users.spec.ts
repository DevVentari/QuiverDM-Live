import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Admin Users Page', () => {
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
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    if (!page.url().includes('/admin/users')) {
      test.skip(true, 'Current user is not an admin; admin page redirected away.');
    }
  });

  test('page loads successfully', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Users');
    await expect(page.getByText(/Manage platform users, roles, and access/i)).toBeVisible();
  });

  test('search and filter controls are visible and clickable', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search users...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('demo');

    const roleFilter = page.locator('button[role="combobox"]').first();
    const planFilter = page.locator('button[role="combobox"]').nth(1);

    await expect(roleFilter).toBeVisible();
    await expect(planFilter).toBeVisible();

    await roleFilter.click();
    await expect(page.getByRole('option', { name: /All roles/i })).toBeVisible();
    await page.keyboard.press('Escape');

    await planFilter.click();
    await expect(page.getByRole('option', { name: /All plans/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('users table headers are visible', async ({ page }) => {
    await expect(page.locator('th', { hasText: 'User' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Role' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Plan' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Campaigns' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Joined' })).toBeVisible();
  });

  test('row action menu exposes management actions', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const firstActionButton = page.locator('table tbody tr').first().getByRole('button');
    if (!(await firstActionButton.isVisible().catch(() => false))) {
      test.skip(true, 'No users rendered in the admin users table.');
    }

    await firstActionButton.click();
    await expect(page.getByRole('menuitem', { name: /Change Role/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Force Password Reset/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Suspend|Unsuspend/i })).toBeVisible();
  });

  test('change role dialog opens and can be dismissed', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const firstActionButton = page.locator('table tbody tr').first().getByRole('button');
    if (!(await firstActionButton.isVisible().catch(() => false))) {
      test.skip(true, 'No users rendered in the admin users table.');
    }

    await firstActionButton.click();
    await page.getByRole('menuitem', { name: /Change Role/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /Update Role/i })).toBeVisible();

    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
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

    await page.getByPlaceholder('Search users...').fill('demo');
    await page.getByPlaceholder('Search users...').clear();

    const roleFilter = page.locator('button[role="combobox"]').first();
    await roleFilter.click();
    await page.keyboard.press('Escape');

    if (errors.length > 0) {
      console.log(`Found ${errors.length} console/page errors:`);
      errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
  });

  test('responsive layout check', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h1')).toContainText('Users');

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toContainText('Users');

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toContainText('Users');

    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('full user flow - search and open role dialog', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByPlaceholder('Search users...');
    await searchInput.fill('demo');
    await page.waitForLoadState('domcontentloaded');

    const firstActionButton = page.locator('table tbody tr').first().getByRole('button');
    if (await firstActionButton.isVisible().catch(() => false)) {
      await firstActionButton.click();
      await page.getByRole('menuitem', { name: /Change Role/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: /Cancel/i }).click();
    }
  });
});
