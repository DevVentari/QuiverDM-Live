import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test.fixme('veteran-dm happy path: rapid campaign navigation and advanced npc creation', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 12_000);

  // TODO: hop across campaigns/npcs/sessions quickly and assert page readiness.
  // TODO: create advanced NPC with full stat block.
  // TODO: verify key sections render on detail page.
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
  await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}`));
});

test.fixme('veteran-dm failure path: blocked action surfaces clear actionable error', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'open-advanced-flow', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
  }, 12_000);

  // TODO: induce invalid/blocked state and assert useful remediation text.
  await expect(page.getByRole('heading').first()).toContainText(/session/i);
});
