import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('campaign create requires a name', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await page.goto('/campaigns/new');
  await page.waitForLoadState('networkidle');

  // Step 1: select campaign type
  await page.getByRole('button', { name: /original campaign/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  // Step 2: skip (just proceed)
  await page.getByRole('button', { name: /^next$/i }).click();

  // Step 3: name field — leave blank, click Next to reach step 4
  await page.getByRole('button', { name: /^next$/i }).click();

  // Step 4: attempt to create without a name
  await expect(page.getByRole('button', { name: /create campaign/i })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: /create campaign/i }).click();

  await expect(page.getByText('Campaign name is required')).toBeVisible({ timeout: 5_000 });
});

test('npc create requires a name', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs?create=true`);
  await page.waitForLoadState('networkidle');

  // NpcCreateSheet opens via ?create=true
  const nameInput = page.getByRole('textbox', { name: /^name$/i });
  await expect(nameInput).toBeVisible({ timeout: 10_000 });

  // Submit without a name — find the create/save button inside the sheet
  const createBtn = page.getByRole('button', { name: /create npc/i });
  await expect(createBtn).toBeVisible({ timeout: 5_000 });
  await createBtn.click();

  await expect(page.getByText(/name.*required|required.*name/i)).toBeVisible({ timeout: 5_000 });
});
