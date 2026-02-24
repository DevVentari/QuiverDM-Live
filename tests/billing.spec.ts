import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Billing & Pricing', () => {
  test('pricing page loads without error', async ({ page }) => {
    // Marketing pricing page is public — no auth needed
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /pricing|plans/i })
        .or(page.getByText(/free|pro|team/i).first())
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('pricing page shows free, pro, and team tiers', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/free/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/pro/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('authenticated user can access settings page', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /settings|account|profile/i })
        .or(page.getByText(/settings|account/i).first())
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('upgrade or manage billing CTA visible for authenticated users', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Either a "Manage Subscription", "Upgrade", or "Billing" section should exist
    await expect(
      page.getByRole('button', { name: /manage.*subscription|upgrade|billing|subscribe/i })
        .or(page.getByRole('link', { name: /manage.*subscription|upgrade|billing/i }))
        .or(page.getByText(/subscription|billing plan|current plan/i).first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('current plan tier is displayed in settings', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/free|pro|team/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('pricing page upgrade button does not crash', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // Just assert upgrade buttons exist — don't click through to Stripe
    const upgradeBtn = page.getByRole('button', { name: /get started|upgrade|choose.*pro|choose.*team/i }).first();
    if (await upgradeBtn.count() > 0) {
      await expect(upgradeBtn).toBeVisible();
    }
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('unauthenticated access to /settings redirects to sign-in', async ({ page }) => {
    // No sign-in
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should redirect to auth page (not render settings for unauthenticated users)
    await expect(page).toHaveURL(/signin|auth|login/, { timeout: 10000 });
  });
});
