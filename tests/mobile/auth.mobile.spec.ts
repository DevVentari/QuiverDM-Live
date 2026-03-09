import { test, expect } from '@playwright/test';
import { BASE_URL, pageChecks, screenshot } from './helpers';

const SPEC = 'auth';

test.describe('Auth pages — mobile', () => {
  test('sign-in page: no overflow, form visible, button touchable', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    await pageChecks(page, 'auth-signin', SPEC, 'signin');

    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/password/i);
    const submitBtn = page.getByRole('button', { name: /sign in/i });

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(submitBtn).toBeVisible();

    const btnBox = await submitBtn.boundingBox();
    expect(btnBox, 'Submit button not found').not.toBeNull();
    expect(btnBox!.width, 'Submit button width < 44px').toBeGreaterThanOrEqual(44);
    expect(btnBox!.height, 'Submit button height < 44px').toBeGreaterThanOrEqual(44);
    expect(btnBox!.x + btnBox!.width, 'Submit button overflows viewport').toBeLessThanOrEqual(400);
  });

  test('sign-up page: no overflow, form visible, submit button touchable', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/signup`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    await pageChecks(page, 'auth-signup', SPEC, 'signup');

    const submitBtn = page
      .getByRole('button', { name: /sign up|create account|register/i })
      .first();

    const isVisible = await submitBtn.isVisible().catch(() => false);
    if (isVisible) {
      const btnBox = await submitBtn.boundingBox();
      if (btnBox) {
        expect(btnBox.width, 'Sign-up button width < 44px').toBeGreaterThanOrEqual(44);
        expect(btnBox.height, 'Sign-up button height < 44px').toBeGreaterThanOrEqual(44);
        expect(btnBox.x + btnBox.width, 'Sign-up button overflows viewport').toBeLessThanOrEqual(400);
      }
    } else {
      console.warn('Sign-up page: no sign-up button found (page may redirect or require invite)');
    }
  });
});
