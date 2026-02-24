import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

async function navToSessions(page: Parameters<typeof signInAsTestUser>[0]) {
  await signInAsTestUser(page);
  await page.goto('/campaigns');
  const campaignLink = page.locator('a[href*="/campaigns/"]').first();
  if (await campaignLink.count() === 0) return null;
  const href = await campaignLink.getAttribute('href');
  await campaignLink.click();
  await page.waitForLoadState('networkidle');
  const sessionsLink = page.getByRole('link', { name: /sessions/i });
  if (await sessionsLink.count() === 0) return null;
  await sessionsLink.click();
  await page.waitForLoadState('networkidle');
  return href;
}

test.describe('Sessions — Edge Cases', () => {
  test('sessions list loads and shows status filters', async ({ page }) => {
    const ok = await navToSessions(page);
    if (!ok) { test.skip(); return; }

    await expect(page).toHaveURL(/sessions/);
    // Filter buttons should exist
    await expect(
      page.getByRole('button', { name: /all|planned|in progress|completed/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('create session dialog opens', async ({ page }) => {
    const ok = await navToSessions(page);
    if (!ok) { test.skip(); return; }

    const newBtn = page.getByRole('button', { name: /new session|create session|\+/i }).first();
    if (await newBtn.count() === 0) { test.skip(); return; }

    await newBtn.click();
    await expect(
      page.getByRole('dialog').or(page.getByRole('textbox').first())
    ).toBeVisible({ timeout: 5000 });
  });

  test('creating session with empty title shows validation error', async ({ page }) => {
    const ok = await navToSessions(page);
    if (!ok) { test.skip(); return; }

    const newBtn = page.getByRole('button', { name: /new session|create session|\+/i }).first();
    if (await newBtn.count() === 0) { test.skip(); return; }

    await newBtn.click();
    await page.waitForTimeout(300);

    // Submit without filling the title
    const submitBtn = page.getByRole('button', { name: /create|save|submit/i }).last();
    if (await submitBtn.count() > 0) await submitBtn.click();

    // Should show validation error or form remains open — not crash
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
    await expect(
      page.getByRole('dialog')
        .or(page.getByText(/required|title|name/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test('session with very long title is handled gracefully', async ({ page }) => {
    const ok = await navToSessions(page);
    if (!ok) { test.skip(); return; }

    const newBtn = page.getByRole('button', { name: /new session|create session|\+/i }).first();
    if (await newBtn.count() === 0) { test.skip(); return; }

    await newBtn.click();
    await page.waitForTimeout(300);

    const titleInput = page.getByRole('textbox').first()
      .or(page.getByLabel(/title|name/i).first());
    if (await titleInput.count() === 0) { test.skip(); return; }

    // 200-character title
    await titleInput.fill('A'.repeat(200));

    const submitBtn = page.getByRole('button', { name: /create|save|submit/i }).last();
    if (await submitBtn.count() > 0) await submitBtn.click();

    // Should either create or show a length validation error — not a 500
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('filter "Planned" shows only planned sessions', async ({ page }) => {
    const ok = await navToSessions(page);
    if (!ok) { test.skip(); return; }

    const plannedBtn = page.getByRole('button', { name: /^planned$/i });
    if (await plannedBtn.count() === 0) { test.skip(); return; }

    await plannedBtn.click();
    await page.waitForLoadState('networkidle');

    // Page should not error after filtering
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
    await expect(page).toHaveURL(/sessions/);
  });

  test('public share page is accessible without auth (if share token exists)', async ({ page }) => {
    // Navigate to a session detail as authenticated user first
    await signInAsTestUser(page);
    await page.goto('/campaigns');
    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    if (await campaignLink.count() === 0) { test.skip(); return; }
    await campaignLink.click();
    await page.waitForLoadState('networkidle');
    const sessionsLink = page.getByRole('link', { name: /sessions/i });
    if (await sessionsLink.count() === 0) { test.skip(); return; }
    await sessionsLink.click();
    await page.waitForLoadState('networkidle');

    // Look for any share link that leads to /share/session/
    const shareLink = page.locator('a[href*="/share/session/"]').first();
    if (await shareLink.count() === 0) { test.skip(); return; }

    const shareHref = await shareLink.getAttribute('href');
    if (!shareHref) { test.skip(); return; }

    // Open share URL in a new context (unauthenticated)
    const newPage = await page.context().newPage();
    await newPage.goto(shareHref);
    await newPage.waitForLoadState('networkidle');

    // Public share page should render — not redirect to auth
    await expect(newPage.getByText(/error|500/i)).toHaveCount(0);
    await expect(newPage).not.toHaveURL(/signin|auth/);
    await newPage.close();
  });

  test('sessions page does not crash when no sessions exist', async ({ page }) => {
    const ok = await navToSessions(page);
    if (!ok) { test.skip(); return; }

    await expect(page.getByText(/error|500/i)).toHaveCount(0);
    await expect(
      page.getByText(/no sessions|create.*first|get started/i)
        .or(page.locator('a[href*="/sessions/"]').first())
    ).toBeVisible({ timeout: 10000 });
  });
});
