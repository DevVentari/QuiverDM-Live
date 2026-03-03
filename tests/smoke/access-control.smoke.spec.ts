import { test, expect } from '@playwright/test';

test('protected routes redirect to sign-in when logged out', async ({ page, context }) => {
  await context.clearCookies();

  const protectedRoutes = ['/dashboard', '/campaigns', '/characters', '/homebrew'];
  for (const path of protectedRoutes) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10000 });
  }
});
