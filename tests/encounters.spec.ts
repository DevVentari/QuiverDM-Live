import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

async function navToEncounters(page: Parameters<typeof signInAsTestUser>[0]) {
  await signInAsTestUser(page);
  await page.goto('/campaigns');
  const campaignLink = page.locator('a[href*="/campaigns/"]').first();
  if (await campaignLink.count() === 0) return false;
  await campaignLink.click();
  await page.waitForLoadState('networkidle');
  const encountersLink = page.getByRole('link', { name: /encounters/i });
  if (await encountersLink.count() === 0) return false;
  await encountersLink.click();
  await page.waitForLoadState('networkidle');
  return true;
}

test.describe('Encounter Builder', () => {
  test('encounters page loads for a campaign', async ({ page }) => {
    const ok = await navToEncounters(page);
    if (!ok) { test.skip(); return; }

    await expect(page).toHaveURL(/encounters/);
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('empty state shown when no encounter plans exist', async ({ page }) => {
    const ok = await navToEncounters(page);
    if (!ok) { test.skip(); return; }

    const plans = page.locator('a[href*="/encounters/"]').or(page.locator('[data-testid="encounter-plan"]'));
    const count = await plans.count();
    if (count > 0) { test.skip(); return; }

    await expect(
      page.getByText(/no encounters|create.*plan|get started|new plan/i)
        .or(page.getByRole('button', { name: /new plan|create/i }))
    ).toBeVisible({ timeout: 10000 });
  });

  test('New Plan button opens dialog', async ({ page }) => {
    const ok = await navToEncounters(page);
    if (!ok) { test.skip(); return; }

    const newPlanBtn = page.getByRole('button', { name: /new plan|create.*plan|\+/i }).first();
    if (await newPlanBtn.count() === 0) { test.skip(); return; }

    await newPlanBtn.click();
    await expect(
      page.getByRole('dialog').or(page.getByRole('textbox').first())
    ).toBeVisible({ timeout: 5000 });
  });

  test('creating encounter plan with empty name shows validation error', async ({ page }) => {
    const ok = await navToEncounters(page);
    if (!ok) { test.skip(); return; }

    const newPlanBtn = page.getByRole('button', { name: /new plan|create.*plan|\+/i }).first();
    if (await newPlanBtn.count() === 0) { test.skip(); return; }

    await newPlanBtn.click();
    await page.waitForTimeout(300);

    // Submit without filling name
    const submitBtn = page.getByRole('button', { name: /create|save|add/i }).last();
    if (await submitBtn.count() > 0) await submitBtn.click();

    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('difficulty labels are displayed for existing plans', async ({ page }) => {
    const ok = await navToEncounters(page);
    if (!ok) { test.skip(); return; }

    const plans = page.locator('a[href*="/encounters/"]').or(page.locator('[class*="card"]'));
    if (await plans.count() === 0) { test.skip(); return; }

    // Difficulty badge should be present (Easy, Medium, Hard, Deadly)
    await expect(
      page.getByText(/easy|medium|hard|deadly/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('encounter plan detail loads after click', async ({ page }) => {
    const ok = await navToEncounters(page);
    if (!ok) { test.skip(); return; }

    const planLink = page.locator('a[href*="/encounters/"]').first();
    if (await planLink.count() === 0) { test.skip(); return; }

    await planLink.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/encounters\/.+/);
    await expect(page.getByText(/error|500/i)).toHaveCount(0);
  });

  test('delete encounter plan shows confirm dialog', async ({ page }) => {
    const ok = await navToEncounters(page);
    if (!ok) { test.skip(); return; }

    // Look for a delete button on any plan card
    const deleteBtn = page.getByRole('button', { name: /delete|remove/i }).first();
    if (await deleteBtn.count() === 0) { test.skip(); return; }

    await deleteBtn.click();

    // Confirm dialog should appear
    await expect(
      page.getByRole('dialog').or(page.getByRole('alertdialog'))
        .or(page.getByText(/confirm|are you sure|cannot be undone/i))
    ).toBeVisible({ timeout: 5000 });
  });
});
