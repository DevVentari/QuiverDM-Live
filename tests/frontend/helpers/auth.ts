import { Page, expect } from '@playwright/test';

export const FRONTEND_TEST_EMAIL = 'frontend-cert@quiverdm.test';
export const FRONTEND_TEST_PASSWORD = 'FrontendCert123!';

export async function loginAsFrontendTestUser(page: Page) {
  await page.goto('/auth/signin');
  await page.fill('#email', FRONTEND_TEST_EMAIL);
  await page.fill('#password', FRONTEND_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/signin'));
  await expect(page).not.toHaveURL(/\/auth\/signin/);
}

