import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('core navigation routes load without error', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);

  const routes = ['/dashboard', '/campaigns', '/characters', '/homebrew'];
  for (const path of routes) {
    await page.goto(path);
    // No error page (500/404 text or "something went wrong")
    await expect(page.locator('body')).not.toContainText(/something went wrong|500|page not found/i);
    // Page has at least one heading
    await expect(page.locator('h1, h2, [class*="font-bold"]').first()).toBeVisible();
  }
});
