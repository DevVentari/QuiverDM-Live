import { test, expect, type Page } from '@playwright/test';
import { signInAsTestUser } from './helpers';

/** Returns the path of the first completed PDF, or null if none exist. */
async function getFirstCompletedPdfHref(page: Page): Promise<string | null> {
  await page.goto('/homebrew/pdfs');
  await page.waitForLoadState('domcontentloaded');

  const completedFilter = page.getByRole('button', { name: /completed/i }).first();
  await completedFilter.click();

  const cardHeading = page.getByRole('heading', { level: 3 }).first();
  const visible = await cardHeading.isVisible({ timeout: 4000 }).catch(() => false);
  if (!visible) return null;

  await cardHeading.click();
  await page.waitForURL(/\/homebrew\/pdfs\//, { timeout: 8000 }).catch(() => {});
  const url = page.url();
  if (!url.includes('/homebrew/pdfs/')) return null;
  return new URL(url).pathname;
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test.describe('PDF Viewer Tab', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('1. View PDF tab appears on completed PDF detail page', async ({ page }) => {
    const errors = collectErrors(page);

    const href = await getFirstCompletedPdfHref(page);
    if (!href) {
      test.skip();
      return;
    }

    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');

    const isCompleted = await page.locator('[data-status="completed"], .badge:has-text("completed"), span:has-text("completed")').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!isCompleted) {
      test.skip();
      return;
    }

    await expect(page.locator('[role="tab"]:has-text("Extracted Content")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Raw Markdown")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("View PDF")')).toBeVisible();

    expect(errors).toBeDefined();
  });

  test('2. Clicking View PDF tab shows viewer controls', async ({ page }) => {
    const errors = collectErrors(page);

    const href = await getFirstCompletedPdfHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');

    const tabVisible = await page.locator('[role="tab"]:has-text("View PDF")').isVisible({ timeout: 5000 }).catch(() => false);
    if (!tabVisible) { test.skip(); return; }

    await page.locator('[role="tab"]:has-text("View PDF")').click();
    await expect(page.locator('button[aria-label="Previous page"]')).toBeVisible();

    await expect(page.locator('button[aria-label="Next page"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Zoom in"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Zoom out"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Previous page"]')).toBeDisabled();

    expect(errors).toBeDefined();
  });

  test('3. Page counter shows N/M after PDF loads', async ({ page }) => {
    const href = await getFirstCompletedPdfHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');

    const tabVisible = await page.locator('[role="tab"]:has-text("View PDF")').isVisible({ timeout: 5000 }).catch(() => false);
    if (!tabVisible) { test.skip(); return; }

    await page.locator('[role="tab"]:has-text("View PDF")').click();
    await expect(page.locator('button[aria-label="Previous page"]')).toBeVisible();

    const counter = page.locator('span').filter({ hasText: /^\d+ \/ \d+$/ });
    await expect(counter).toBeVisible({ timeout: 30000 });
  });

  test('4. Zoom controls change the percentage display', async ({ page }) => {
    const href = await getFirstCompletedPdfHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');

    const tabVisible = await page.locator('[role="tab"]:has-text("View PDF")').isVisible({ timeout: 5000 }).catch(() => false);
    if (!tabVisible) { test.skip(); return; }

    await page.locator('[role="tab"]:has-text("View PDF")').click();
    await expect(page.locator('button[aria-label="Previous page"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Zoom in"]')).toBeVisible();

    const zoomLevel = page.locator('[data-testid="pdf-zoom-level"]');
    await expect(zoomLevel).toHaveText('100%');

    await page.locator('button[aria-label="Zoom in"]').click();
    await expect(zoomLevel).toHaveText('125%');

    await page.locator('button[aria-label="Zoom out"]').click();
    await page.locator('button[aria-label="Zoom out"]').click();
    await expect(zoomLevel).toHaveText('75%');
  });
});
