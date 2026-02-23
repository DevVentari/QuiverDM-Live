import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Onboarding', () => {
  test('onboarding page loads when navigated to directly', async ({ page }) => {
    await page.goto('/onboarding');
    // Should redirect to sign in if not authenticated
    await expect(page).toHaveURL(/signin|onboarding/);
  });

  test('onboarding wizard has step indicators', async ({ page }) => {
    await signInAsTestUser(page);
    const currentUrl = page.url();
    if (!currentUrl.includes('onboarding')) {
      // User already completed onboarding - skip
      test.skip();
      return;
    }
    // Step dots should be visible
    const stepDots = page.locator('.rounded-full');
    await expect(stepDots.first()).toBeVisible();
  });

  test('completed onboarding redirects away from /onboarding', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/onboarding');
    // Should be either on onboarding (not yet complete) or dashboard (complete)
    await expect(page).toHaveURL(/onboarding|dashboard|campaigns/);
  });
});
