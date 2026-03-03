import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('session list page loads and renders', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
  await expect(page.locator('body')).not.toContainText(/something went wrong|500/i);
  // Either a sessions list or the empty state is visible
  await expect(
    page.locator('h1, h2').filter({ hasText: /session/i }).first()
      .or(page.getByText(/no sessions yet|new session/i).first())
  ).toBeVisible({ timeout: 10000 });
});
