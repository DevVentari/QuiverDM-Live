import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Compendium — the Monsters / Conditions / Rules tabs are backed by the
// bundled SRD reference (merged with campaign homebrew). SRD content ships in the
// app, so these tabs must populate for ANY campaign with no data seeding — which
// is exactly the "monsters/conditions/rules didn't seed for CoS" regression this
// guards against.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-compendium-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error|404/i;

test.describe('v3 — compendium SRD surface', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Compendium QA');
  });

  test('compendium: monsters, conditions, and rules all populate from bundled SRD', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'monsters-tab-populates', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/compendium`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      // Monsters is the default tab; the SRD bestiary fills the list.
      await expect(page.getByText(/MONSTERS · \d+/).first()).toBeVisible({ timeout: 12_000 });
      // Narrow to a known SRD creature and open its statblock.
      await page.getByPlaceholder(/Search the compendium/i).fill('ghost');
      await page.getByRole('button', { name: /Ghost/i }).first().click();
      await expect(page.getByText('+ Add to combat').first()).toBeVisible({ timeout: 8_000 });
      await expect(page.getByText(/\bAC\b/).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 45_000); // generous: first hit cold-compiles the route + bundles the SRD JSON

    await checkpoint(testInfo, 'conditions-tab-populates', async () => {
      await page.getByRole('button', { name: 'Conditions' }).click();
      await expect(page.getByText(/CONDITIONS · \d+/).first()).toBeVisible({ timeout: 8_000 });
      // Open a condition → prose detail with its rules text.
      await page.getByRole('button', { name: /Blinded/i }).first().click();
      await expect(page.getByText(/can't see/i).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 20_000);

    await checkpoint(testInfo, 'spells-tab-populates', async () => {
      await page.getByRole('button', { name: 'Spells' }).click();
      await expect(page.getByText(/SPELLS · \d+/).first()).toBeVisible({ timeout: 8_000 });
      await page.getByPlaceholder(/Search the compendium/i).fill('fireball');
      await page.getByRole('button', { name: /Fireball/i }).first().click();
      await expect(page.getByText(/Casting Time/i).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 20_000);

    await checkpoint(testInfo, 'rules-tab-populates', async () => {
      await page.getByRole('button', { name: 'Rules' }).click();
      await expect(page.getByText(/RULES · \d+/).first()).toBeVisible({ timeout: 8_000 });
      await page.getByRole('button', { name: /Cover/i }).first().click();
      await expect(page.getByText(/half cover/i).first()).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 20_000);
  });
});
