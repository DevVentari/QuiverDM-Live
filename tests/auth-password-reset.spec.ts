import { test, expect } from '@playwright/test';

test.describe('Password Reset', () => {
  test('forgot password route loads from sign-in link', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByRole('link', { name: /forgot password\?/i }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible({ timeout: 10000 });
  });

  test('request reset shows non-enumerating success state', async ({ page }) => {
    const email = `qa-reset-${Date.now()}@example.com`;

    await page.goto('/auth/forgot-password');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(new RegExp(`if an account exists for ${email}`, 'i'))).toBeVisible();

    await page.getByRole('link', { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(/\/auth\/signin$/);
  });

  test('reset password route shows invalid or expired state for bad token', async ({ page }) => {
    await page.goto('/auth/reset-password/not-a-real-token');
    await expect(page.getByText(/link expired/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /request a new reset link/i })).toBeVisible();
  });

  test('reset form shows password mismatch validation before submit', async ({ page }) => {
    await page.route(/passwordReset\.validateToken/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { json: { valid: true } } } }]),
      });
    });

    await page.goto('/auth/reset-password/fake-token-for-ui-test');
    await expect(page.getByText(/set new password/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/new password/i).fill('password-1234');
    await page.getByLabel(/confirm password/i).fill('password-5678');
    await page.getByRole('button', { name: /set new password/i }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/auth\/reset-password\/fake-token-for-ui-test$/);
  });
});
