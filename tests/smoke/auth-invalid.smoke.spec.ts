import { test, expect } from '@playwright/test';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('sign-in rejects invalid credentials with inline error', async ({ page }) => {
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(VIC_EMAIL);
  await page.getByLabel(/password/i).fill(`${PASSWORD}-invalid`);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/auth\/signin/);
  await expect(page.getByText('Invalid email or password.')).toBeVisible({ timeout: 10_000 });
});
