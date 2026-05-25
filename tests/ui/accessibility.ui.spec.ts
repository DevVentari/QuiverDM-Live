import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signInAsTestUser, TEST_USER_EMAIL, TEST_USER_PASSWORD } from '../helpers';

const BLAKE_EMAIL = process.env.QA_BLAKE_EMAIL ?? TEST_USER_EMAIL;
const JORDAN_EMAIL = process.env.QA_JORDAN_EMAIL ?? TEST_USER_EMAIL;
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'blakes-test-campaign';

// Only flag critical and serious violations (not moderate/minor noise)
const SEVERITY_FILTER = ['critical', 'serious'] as const;

async function axeScan(page: Parameters<typeof signInAsTestUser>[0], route: string) {
  await page.goto(route);
  await page.waitForLoadState('domcontentloaded');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const violations = results.violations.filter((v) =>
    SEVERITY_FILTER.includes(v.impact as typeof SEVERITY_FILTER[number])
  );
  return violations;
}

test.describe('accessibility — WCAG 2.1 AA (critical + serious only)', () => {
  test('dashboard has no critical/serious violations', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    const violations = await axeScan(page, '/dashboard');
    expect(
      violations,
      `Axe violations on /dashboard:\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('campaign overview has no critical/serious violations', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    const violations = await axeScan(page, `/campaigns/${CAMPAIGN_SLUG}`);
    expect(
      violations,
      `Axe violations on /campaigns/${CAMPAIGN_SLUG}:\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('sessions list has no critical/serious violations', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    const violations = await axeScan(page, `/campaigns/${CAMPAIGN_SLUG}/sessions`);
    expect(
      violations,
      `Axe violations:\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('homebrew library has no critical/serious violations', async ({ page }) => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
    const violations = await axeScan(page, '/homebrew');
    expect(
      violations,
      `Axe violations on /homebrew:\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('characters list has no critical/serious violations', async ({ page }) => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
    const violations = await axeScan(page, '/characters');
    expect(
      violations,
      `Axe violations on /characters:\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('settings page has no critical/serious violations', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    const violations = await axeScan(page, '/settings');
    expect(
      violations,
      `Axe violations on /settings:\n${violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')}`
    ).toHaveLength(0);
  });
});

test.describe('accessibility — interactive element labels', () => {
  test('all buttons in sidebar have accessible names', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible({ timeout: 8_000 });

    // Every button in the nav must have an accessible name
    const navButtons = nav.getByRole('button');
    const count = await navButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = navButtons.nth(i);
      const name = await btn.getAttribute('aria-label') ??
        await btn.getAttribute('title') ??
        await btn.innerText().catch(() => '');
      expect(name.trim(), `Button ${i} in nav has no accessible name`).not.toBe('');
    }
  });

  test('create campaign form fields are labelled', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto('/campaigns/new');
    await page.waitForLoadState('domcontentloaded');
    // Every visible input must have a label or aria-label
    const inputs = page.locator('input:visible, textarea:visible');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const hasLabel = id
        ? (await page.locator(`label[for="${id}"]`).count()) > 0
        : false;
      expect(
        hasLabel || !!ariaLabel || !!ariaLabelledBy,
        `Input ${i} (id="${id}") has no associated label`
      ).toBe(true);
    }
  });
});
