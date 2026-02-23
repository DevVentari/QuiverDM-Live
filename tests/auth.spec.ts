import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('sign in page loads', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/signin/);
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByLabel(/email/i).fill('notreal@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(
      page.getByText(/invalid|error|incorrect|credentials/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('sign up page loads', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.getByRole('heading', { name: /sign up|create account|register/i })).toBeVisible();
  });
});
