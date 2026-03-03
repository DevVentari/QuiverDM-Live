import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('homebrew PDF list page loads', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await page.goto('/homebrew/pdfs');
  await expect(page.locator('body')).not.toContainText(/something went wrong|500/i);
  // Either a PDF row, empty state, or the upload button is visible
  await expect(
    page.getByRole('button', { name: /upload/i })
      .or(page.getByText(/no pdfs yet|pdf processing/i))
      .or(page.locator('table, [role="table"]'))
      .first()
  ).toBeVisible({ timeout: 10000 });
});
