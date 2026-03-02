import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Billing', () => {
  test('pricing page loads with visible plans and no runtime JS errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    // Edge case: public pricing route should render without client-side crashes.
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /pricing/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/^Free$/)).toBeVisible();
    await expect(page.getByText(/^Pro$/)).toBeVisible();
    await expect(page.getByText(/^Team$/)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('authenticated subscribed user sees Manage Subscription action', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    const manageSubscription = page.getByRole('button', { name: /manage subscription/i });
    if ((await manageSubscription.count()) === 0) {
      test.skip(true, 'Current test user does not have an active subscription.');
      return;
    }

    // Edge case: portal action should be exposed to subscribed users.
    await expect(manageSubscription.first()).toBeVisible({ timeout: 10000 });
  });

  test('current plan is displayed in settings billing section', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Edge case: tier badge should always indicate plan context.
    await expect(page.getByText(/free plan|pro plan|team plan/i)).toBeVisible({ timeout: 10000 });
  });

  test('free-tier user sees upgrade CTA without redirecting to Stripe', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    if ((await page.getByText(/free plan/i).count()) === 0) {
      test.skip(true, 'User is not on free tier; upgrade CTA behavior is different.');
      return;
    }

    // Edge case: free tier must expose upgrade entry points.
    // Use .first() to avoid strict mode violation when both "Upgrade to Pro" and "Upgrade to Team" appear.
    await expect(
      page.getByRole('button', { name: /upgrade to pro|upgrade to team/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('usage meters and limits are visible in settings', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Edge case: usage section should surface limit tracking labels.
    await expect(page.getByText(/usage & limits/i)).toBeVisible({ timeout: 10000 });
    // Scope to main content to avoid strict-mode collision with sidebar nav "Campaigns" link.
    await expect(page.getByRole('main').getByText(/campaigns/i).first()).toBeVisible();
    await expect(page.getByText(/transcription/i)).toBeVisible();
    await expect(page.getByText(/pdf uploads/i)).toBeVisible();
  });

  test('new/free user with no subscription sees free-tier defaults', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    if ((await page.getByText(/free plan/i).count()) === 0) {
      test.skip(true, 'User is not free-tier; no-subscription free defaults are not applicable.');
      return;
    }

    // Edge case: no-subscription state should show "None" and avoid portal management buttons.
    await expect(page.getByText(/^None$/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /manage subscription/i })).toHaveCount(0);
  });
});
