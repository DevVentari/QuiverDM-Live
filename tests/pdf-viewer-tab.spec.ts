import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:3847';
const EMAIL = 'demo@quiverdm.com';
const PASSWORD = 'demo1234';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function signIn(page: Page) {
  await page.goto(`${BASE}/auth/signin`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 15_000 });
}

/** Returns the href of the first completed PDF, or null if none exist. */
async function getFirstCompletedPdfHref(page: Page): Promise<string | null> {
  await page.goto(`${BASE}/homebrew/pdfs`);
  await page.waitForLoadState('networkidle');
  // PDF cards render as links to /homebrew/pdfs/<id>
  const link = page.locator('a[href^="/homebrew/pdfs/"]').first();
  const visible = await link.isVisible({ timeout: 4_000 }).catch(() => false);
  if (!visible) return null;
  return link.getAttribute('href');
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('PDF Viewer Tab', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('1. View PDF tab appears on completed PDF detail page', async ({ page }) => {
    const errors = collectErrors(page);

    const href = await getFirstCompletedPdfHref(page);
    if (!href) {
      console.log('⚠️  No PDFs in account — skipping');
      test.skip();
      return;
    }

    await page.goto(`${BASE}${href}`);
    await page.waitForLoadState('networkidle');

    // Only completed PDFs show tabs — check status first
    const isCompleted = await page.locator('[data-status="completed"], .badge:has-text("completed"), span:has-text("completed")').first().isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isCompleted) {
      console.log('⚠️  PDF not completed — skipping tab assertions');
      test.skip();
      return;
    }

    await expect(page.locator('[role="tab"]:has-text("Extracted Content")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Raw Markdown")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("View PDF")')).toBeVisible();

    console.log('✅ All three tabs visible');
    if (errors.length) console.log('⚠️  Console errors:', errors);
  });

  test('2. Clicking View PDF tab shows viewer controls', async ({ page }) => {
    const errors = collectErrors(page);

    const href = await getFirstCompletedPdfHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(`${BASE}${href}`);
    await page.waitForLoadState('networkidle');

    const tabVisible = await page.locator('[role="tab"]:has-text("View PDF")').isVisible({ timeout: 5_000 }).catch(() => false);
    if (!tabVisible) { test.skip(); return; }

    await page.locator('[role="tab"]:has-text("View PDF")').click();
    await page.waitForTimeout(1500);

    await expect(page.locator('button[aria-label="Previous page"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Next page"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Zoom in"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Zoom out"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Previous page"]')).toBeDisabled();

    console.log('✅ Viewer controls rendered correctly');
    if (errors.length) console.log('⚠️  Console errors:', errors);
  });

  test('3. Page counter shows N/M after PDF loads', async ({ page }) => {
    const href = await getFirstCompletedPdfHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(`${BASE}${href}`);
    await page.waitForLoadState('networkidle');

    const tabVisible = await page.locator('[role="tab"]:has-text("View PDF")').isVisible({ timeout: 5_000 }).catch(() => false);
    if (!tabVisible) { test.skip(); return; }

    await page.locator('[role="tab"]:has-text("View PDF")').click();

    const counter = page.locator('span').filter({ hasText: /^\d+ \/ \d+$/ });
    await expect(counter).toBeVisible({ timeout: 30_000 });
    console.log('✅ Page counter shows:', await counter.textContent());
  });

  test('4. Zoom controls change the percentage display', async ({ page }) => {
    const href = await getFirstCompletedPdfHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(`${BASE}${href}`);
    await page.waitForLoadState('networkidle');

    const tabVisible = await page.locator('[role="tab"]:has-text("View PDF")').isVisible({ timeout: 5_000 }).catch(() => false);
    if (!tabVisible) { test.skip(); return; }

    await page.locator('[role="tab"]:has-text("View PDF")').click();
    await expect(page.locator('button[aria-label="Zoom in"]')).toBeVisible({ timeout: 5_000 });

    await expect(page.locator('span').filter({ hasText: '100%' })).toBeVisible();

    await page.locator('button[aria-label="Zoom in"]').click();
    await expect(page.locator('span').filter({ hasText: '125%' })).toBeVisible();

    await page.locator('button[aria-label="Zoom out"]').click();
    await page.locator('button[aria-label="Zoom out"]').click();
    await expect(page.locator('span').filter({ hasText: '75%' })).toBeVisible();

    console.log('✅ Zoom controls work correctly');
  });
});
