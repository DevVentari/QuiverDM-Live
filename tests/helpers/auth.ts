import { Page } from '@playwright/test';

export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'demo@quiverdm.com';
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'demo1234';

export async function signInAsTestUser(page: Page) {
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|onboarding/, { timeout: 15000 });
}
