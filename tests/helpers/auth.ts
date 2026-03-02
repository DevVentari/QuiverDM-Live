import { Page } from '@playwright/test';

export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'demo@quiverdm.com';
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'demo1234';

export async function signInAsTestUser(page: Page, email?: string, password?: string) {
  const e = email ?? TEST_USER_EMAIL;
  const p = password ?? TEST_USER_PASSWORD;
  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(e);
  await page.getByLabel(/password/i).fill(p);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|onboarding|campaigns|characters|homebrew|settings|members/, { timeout: 15000 });
}
