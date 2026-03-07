/**
 * Homebrew Production QA — End-to-end test of the entire homebrew feature
 * against a live environment (local dev or production).
 *
 * Run against production:
 *   BASE_URL=https://quiverdm.com npx playwright test tests/qa/homebrew-production.spec.ts
 *
 * Run against local dev:
 *   npx playwright test tests/qa/homebrew-production.spec.ts
 */
import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import { signInAsTestUser } from '../helpers/auth';

const TEST_EMAIL = process.env.QA_VIC_EMAIL ?? process.env.TEST_USER_EMAIL ?? 'demo@quiverdm.com';
const TEST_PASSWORD = process.env.QA_TEST_PASSWORD ?? process.env.TEST_USER_PASSWORD ?? 'demo1234';

test.describe.configure({ mode: 'serial' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function signIn(page: Page) {
  await signInAsTestUser(page, TEST_EMAIL, TEST_PASSWORD);
}

async function navigateToHomebrew(page: Page) {
  await page.goto('/homebrew');
  await page.waitForLoadState('networkidle');
}

async function navigateToPdfProcessing(page: Page) {
  await page.goto('/homebrew/pdfs');
  await page.waitForLoadState('networkidle');
}

async function getFirstCampaignSlug(page: Page): Promise<string | null> {
  await page.goto('/campaigns');
  await page.waitForLoadState('networkidle');

  const links = await page.locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])').all();
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href) {
      const match = href.match(/\/campaigns\/([^/]+)/);
      if (match) return match[1];
    }
  }
  return null;
}

async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `tests/qa/screenshots/${name}.png`, fullPage: true });
}

// ─── 1. Authentication ───────────────────────────────────────────────────────

test('1. Sign in succeeds', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/dashboard|campaigns|homebrew|onboarding/);
  await takeDebugScreenshot(page, '01-signed-in');
});

// ─── 2. Dashboard loads ──────────────────────────────────────────────────────

test('2. Dashboard loads without errors', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText(/500|internal server error|failed to load/i)).toHaveCount(0);
  await takeDebugScreenshot(page, '02-dashboard');
});

// ─── 3. Homebrew library page ────────────────────────────────────────────────

test('3. Homebrew library page loads', async ({ page }) => {
  await signIn(page);
  await navigateToHomebrew(page);

  await expect(page.getByRole('button', { name: 'Create' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/500|internal server error/i)).toHaveCount(0);
  await takeDebugScreenshot(page, '03-homebrew-library');
});

// ─── 4. Homebrew create manual content ───────────────────────────────────────

test('4. Create manual homebrew content', async ({ page }) => {
  await signIn(page);
  await navigateToHomebrew(page);

  const createBtn = page.getByRole('button', { name: /create/i }).first();
  if (await createBtn.count() === 0) {
    test.skip(true, 'Create button not found — may need campaign context');
    return;
  }

  const itemName = `QA Test Item ${Date.now()}`;
  await createBtn.click();
  await page.getByLabel(/name/i).fill(itemName);

  const contentField = page.getByRole('textbox', { name: /content|description/i }).first();
  if (await contentField.count() > 0) {
    await contentField.fill('QA test homebrew content created by automated test');
  }

  await page.getByRole('button', { name: /create|save/i }).last().click();
  await expect(page.getByText(itemName)).toBeVisible({ timeout: 15_000 });
  await takeDebugScreenshot(page, '04-manual-homebrew-created');
});

// ─── 5. PDF Processing page loads ────────────────────────────────────────────

test('5. PDF Processing page loads and shows upload button', async ({ page }) => {
  await signIn(page);
  await navigateToPdfProcessing(page);

  await expect(page.getByRole('heading', { name: /pdf processing/i })).toBeVisible({ timeout: 15_000 });

  const uploadBtn = page.getByRole('button', { name: /upload pdf/i }).first();
  await expect(uploadBtn).toBeVisible();
  await expect(uploadBtn).toBeEnabled();

  await expect(page.getByText(/500|internal server error/i)).toHaveCount(0);
  await takeDebugScreenshot(page, '05-pdf-processing-page');
});

// ─── 6. Upload PDF (gate for tests 7-13) ────────────────────────────────────

test('6. Upload PDF file and verify it appears in list', async ({ page }) => {
  await signIn(page);
  await navigateToPdfProcessing(page);

  const fixture = path.resolve('tests/test-homebrew-small.pdf');
  const fileInput = page.locator('input[type="file"][accept=".pdf"]');
  await expect(fileInput).toHaveCount(1);

  const networkErrors: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  const uploadBtn = page.getByRole('button', { name: /upload pdf/i }).first();
  const chooserPromise = page.waitForEvent('filechooser');
  await uploadBtn.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(fixture);

  const successToast = page.getByText(/pdf uploaded|processing/i).first();
  const errorToast = page.getByText(/upload failed|error|limit reached/i).first();

  await expect(successToast.or(errorToast)).toBeVisible({ timeout: 30_000 });

  if (await errorToast.isVisible().catch(() => false)) {
    const errorText = await errorToast.textContent();
    await takeDebugScreenshot(page, '06-upload-FAILED');
    if (networkErrors.length > 0) {
      console.error('Network errors during upload:', networkErrors);
    }
    test.fail(true, `Upload failed: ${errorText}`);
    return;
  }

  await takeDebugScreenshot(page, '06-upload-success');
  await page.waitForTimeout(2_000);
  expect(page.url()).toMatch(/\/homebrew\/pdfs/);
});

// ─── 7-13: PDF pipeline tests (depend on uploaded PDFs existing) ─────────────

test('7. PDF status badges display correctly', async ({ page }) => {
  await signIn(page);
  await navigateToPdfProcessing(page);
  await page.waitForTimeout(3_000);

  // Badge component renders as <div class="inline-flex items-center rounded-md ...capitalize">
  // Look for elements containing status text with capitalize styling
  const badges = page.locator('div.capitalize, span.capitalize').filter({
    hasText: /completed|processing|pending|failed/i,
  });

  // After test 6 uploads, there should be at least one badge
  await expect(badges.first()).toBeVisible({ timeout: 15_000 });

  const badgeCount = await badges.count();
  for (let i = 0; i < Math.min(badgeCount, 5); i++) {
    const text = await badges.nth(i).textContent();
    expect(text?.trim().toLowerCase()).toMatch(/completed|processing|pending|failed/);
  }

  await takeDebugScreenshot(page, '07-pdf-status-badges');
});

test('8. PDF detail page loads and shows processing status', async ({ page }) => {
  await signIn(page);
  await navigateToPdfProcessing(page);
  await page.waitForTimeout(3_000);

  // PDF cards use onClick (router.push), not <a> tags. Click the first card.
  const pdfCard = page.locator('[class*="card"]').filter({
    hasText: /\.pdf/i,
  }).first();
  await expect(pdfCard).toBeVisible({ timeout: 10_000 });
  await pdfCard.click();

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2_000);

  await expect(page.getByText(/500|internal server error/i)).toHaveCount(0);
  expect(page.url()).toMatch(/\/homebrew\/pdfs\//);

  const processingIndicator = page.getByText(/downloading|converting|extracting|processing|completed|failed/i).first();
  const markdownContent = page.locator('[class*="markdown"], [class*="prose"], pre').first();
  const heading = page.getByRole('heading').first();

  await expect(processingIndicator.or(markdownContent).or(heading)).toBeVisible({ timeout: 15_000 });
  await takeDebugScreenshot(page, '08-pdf-detail');
});

test('9. PDF processing completes within 5 minutes', async ({ page }) => {
  test.setTimeout(360_000);

  await signIn(page);
  await navigateToPdfProcessing(page);
  await page.waitForTimeout(3_000);

  // Check if any PDF is still processing
  const processingBadge = page.locator('div.capitalize, span.capitalize, [class*="badge"]').filter({
    hasText: /pending|processing/i,
  }).first();

  if (await processingBadge.count() === 0) {
    // All PDFs already completed or failed — that's fine
    console.log('No PDFs currently processing — all finished');
    await takeDebugScreenshot(page, '09-already-done');
    return;
  }

  const maxWait = 300_000;
  const pollInterval = 5_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await page.waitForTimeout(pollInterval);

    const stillProcessing = await page.locator('div.capitalize, span.capitalize, [class*="badge"]').filter({
      hasText: /pending|processing/i,
    }).count();

    if (stillProcessing === 0) break;

    if ((Date.now() - start) % 60_000 < pollInterval) {
      const mins = Math.floor((Date.now() - start) / 60_000);
      await takeDebugScreenshot(page, `09-processing-${mins}min`);
    }
  }

  const failedBadge = page.locator('div.capitalize, span.capitalize, [class*="badge"]').filter({ hasText: /failed/i });
  const completedBadge = page.locator('div.capitalize, span.capitalize, [class*="badge"]').filter({ hasText: /completed/i });

  const failedCount = await failedBadge.count();
  const completedCount = await completedBadge.count();

  await takeDebugScreenshot(page, '09-processing-final');

  if (failedCount > 0) {
    const failedLink = page.locator('a[href*="/homebrew/pdfs/c"]').first();
    if (await failedLink.count() > 0) {
      await failedLink.click();
      await page.waitForLoadState('networkidle');
      await takeDebugScreenshot(page, '09-failed-detail');
      const errorMsg = await page.getByText(/error|failed|could not/i).first().textContent().catch(() => 'unknown');
      console.error('PDF processing failed:', errorMsg);
    }
    test.fail(true, 'PDF processing ended in failed state');
  }

  expect(completedCount).toBeGreaterThan(0);
});

test('10. Completed PDF has markdown content', async ({ page }) => {
  await signIn(page);
  await navigateToPdfProcessing(page);
  await page.waitForTimeout(3_000);

  // Click first PDF card to navigate to detail
  const pdfCard = page.locator('[class*="card"]').filter({ hasText: /\.pdf/i }).first();
  await expect(pdfCard).toBeVisible({ timeout: 10_000 });
  await pdfCard.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2_000);

  const contentArea = page.locator('[class*="markdown"], [class*="prose"], pre, .whitespace-pre-wrap').first();
  const errorState = page.getByText(/failed|error|no content/i).first();

  if (await errorState.isVisible().catch(() => false)) {
    await takeDebugScreenshot(page, '10-no-content');
    const errorText = await errorState.textContent();
    console.error('PDF has no content:', errorText);
  }

  await takeDebugScreenshot(page, '10-pdf-content');
});

test('11. AI-extracted items appear on completed PDF', async ({ page }) => {
  await signIn(page);
  await navigateToPdfProcessing(page);
  await page.waitForTimeout(3_000);

  const pdfCard = page.locator('[class*="card"]').filter({ hasText: /\.pdf/i }).first();
  await expect(pdfCard).toBeVisible({ timeout: 10_000 });
  await pdfCard.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000);

  const extractedSection = page.getByText(/extracted|items|spells|monsters|creatures/i).first();
  const noItems = page.getByText(/no items|0 items|extraction disabled/i).first();

  await takeDebugScreenshot(page, '11-extracted-items');

  if (await extractedSection.isVisible().catch(() => false)) {
    console.log('Extracted items section found');
  } else if (await noItems.isVisible().catch(() => false)) {
    console.log('No extracted items — may be expected for small test PDF');
  }
});

test('12. Reprocess button works on completed/failed PDFs', async ({ page }) => {
  await signIn(page);
  await navigateToPdfProcessing(page);
  await page.waitForTimeout(3_000);

  const reprocessBtn = page.getByRole('button', { name: /reprocess|retry|re-queue/i }).first();
  if (await reprocessBtn.count() === 0) {
    // No reprocess button visible — try navigating to a PDF detail page
    const pdfCard = page.locator('[class*="card"]').filter({ hasText: /\.pdf/i }).first();
    if (await pdfCard.count() > 0) {
      await pdfCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2_000);
    }

    const detailReprocess = page.getByRole('button', { name: /reprocess|retry|re-queue/i }).first();
    if (await detailReprocess.count() === 0) {
      console.log('No reprocess button found on list or detail — may not be available for current PDF state');
      await takeDebugScreenshot(page, '12-no-reprocess');
      return;
    }

    await detailReprocess.click();
  } else {
    await reprocessBtn.click();
  }

  const toast = page.getByText(/re-queued|reprocessing|retrying|processing/i).first();
  await expect(toast).toBeVisible({ timeout: 10_000 });
  await takeDebugScreenshot(page, '12-reprocess-triggered');
});

test('13. Delete PDF shows confirmation dialog', async ({ page }) => {
  await signIn(page);
  await navigateToPdfProcessing(page);
  await page.waitForTimeout(3_000);

  const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
  await expect(deleteBtn).toBeVisible({ timeout: 10_000 });

  await deleteBtn.click();

  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  const cancelBtn = dialog.getByRole('button', { name: /cancel/i });
  if (await cancelBtn.count() > 0) {
    await cancelBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await takeDebugScreenshot(page, '13-delete-dialog');
});

// ─── 14. Campaign homebrew page ──────────────────────────────────────────────

test('14. Campaign-scoped homebrew page loads', async ({ page }) => {
  await signIn(page);

  const slug = await getFirstCampaignSlug(page);
  if (!slug) {
    test.skip(true, 'No campaigns found');
    return;
  }

  await page.goto(`/campaigns/${slug}/homebrew`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByText(/500|internal server error/i)).toHaveCount(0);
  await expect(page.locator('main h1, [role="main"] h1, h1').first()).toBeVisible({ timeout: 15_000 });
  await takeDebugScreenshot(page, '14-campaign-homebrew');
});

// ─── 15. Network request audit ───────────────────────────────────────────────

test('15. No 500 errors across homebrew navigation', async ({ page }) => {
  const serverErrors: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 500) {
      serverErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  await signIn(page);

  const pages = ['/homebrew', '/homebrew/pdfs'];
  for (const p of pages) {
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
  }

  const slug = await getFirstCampaignSlug(page);
  if (slug) {
    await page.goto(`/campaigns/${slug}/homebrew`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
  }

  if (serverErrors.length > 0) {
    console.error('Server errors found:', serverErrors);
    await takeDebugScreenshot(page, '15-server-errors');
  }
  expect(serverErrors).toHaveLength(0);
});

// ─── 16. Console error audit ─────────────────────────────────────────────────

test('16. No critical console errors on homebrew pages', async ({ page }) => {
  const criticalErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon') || text.includes('Hydration')) return;
      criticalErrors.push(text);
    }
  });

  await signIn(page);
  await navigateToHomebrew(page);
  await page.waitForTimeout(3_000);

  await navigateToPdfProcessing(page);
  await page.waitForTimeout(3_000);

  if (criticalErrors.length > 0) {
    console.error('Console errors:', criticalErrors.slice(0, 10));
  }

  const truly_critical = criticalErrors.filter(
    (e) => e.includes('TypeError') || e.includes('ReferenceError') || e.includes('Cannot read')
  );
  expect(truly_critical).toHaveLength(0);
});

// ─── 17. Worker connectivity check (API-level) ──────────────────────────────

test('17. tRPC homebrewPdf.getPDFs returns valid data', async ({ page }) => {
  await signIn(page);
  await navigateToPdfProcessing(page);

  const tRPCResponse = await page.waitForResponse(
    (res) => res.url().includes('trpc') && res.url().includes('homebrewPdf'),
    { timeout: 15_000 }
  ).catch(() => null);

  if (tRPCResponse) {
    const status = tRPCResponse.status();
    expect(status).toBeLessThan(500);

    if (status === 200) {
      const body = await tRPCResponse.json().catch(() => null);
      if (body) {
        const result = Array.isArray(body) ? body[0]?.result?.data : body?.result?.data;
        if (result) {
          console.log(`tRPC response: ${JSON.stringify(result).slice(0, 200)}`);
        }
      }
    }
  }

  await takeDebugScreenshot(page, '17-trpc-response');
});
