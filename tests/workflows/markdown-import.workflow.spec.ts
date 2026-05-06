import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

const MOCK_ENTITIES = [
  { type: 'location', name: 'Bonfire Keep', description: 'An ancient fortress overlooking the valley.', data: {}, tags: ['fortress'] },
  { type: 'npc', name: 'Mirela', description: 'A weary innkeeper with secrets.', data: {}, tags: [] },
];

test.describe('markdown world import', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);

    await page.route('**/api/trpc/campaigns.importFromMarkdown**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: MOCK_ENTITIES } }]),
      });
    });

    await page.route('**/api/trpc/campaigns.confirmImport**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { saved: 2 } } }]),
      });
    });
  });

  test('import button opens sheet, upload triggers extraction, review and save works', async ({ page }, testInfo) => {
    await checkpoint(testInfo, 'navigate-to-world', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 20_000);

    await checkpoint(testInfo, 'import-button-visible', async () => {
      await expect(page.getByRole('button', { name: /import/i })).toBeVisible({ timeout: 10_000 });
    }, 10_000);

    await checkpoint(testInfo, 'open-import-sheet', async () => {
      await page.getByRole('button', { name: /import/i }).click();
      await expect(page.getByText(/import from markdown/i)).toBeVisible({ timeout: 5_000 });
    }, 8_000);

    await checkpoint(testInfo, 'upload-file', async () => {
      const input = page.locator('input[type="file"][accept=".md"]');
      await input.setInputFiles({
        name: 'world-notes.md',
        mimeType: 'text/plain',
        buffer: Buffer.from('## Bonfire Keep\nAn ancient fortress.\n\n## Mirela\nA weary innkeeper.'),
      });
      await expect(page.getByText('world-notes.md')).toBeVisible({ timeout: 5_000 });
    }, 8_000);

    await checkpoint(testInfo, 'extract-and-review', async () => {
      await page.getByRole('button', { name: /extract content/i }).click();
      await expect(page.getByText(/extracting entities/i)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Bonfire Keep')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Mirela')).toBeVisible({ timeout: 5_000 });
    }, 15_000);

    await checkpoint(testInfo, 'save-entities', async () => {
      await expect(page.getByRole('button', { name: /save 2 entities/i })).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: /save 2 entities/i }).click();
      await expect(page.getByText(/import from markdown/i)).not.toBeVisible({ timeout: 5_000 });
    }, 10_000);
  });

  test('unchecking an entity updates the save count', async ({ page }, testInfo) => {
    await checkpoint(testInfo, 'open-sheet-with-entities', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      await page.getByRole('button', { name: /import/i }).click();
      await expect(page.getByText(/import from markdown/i)).toBeVisible({ timeout: 5_000 });

      const input = page.locator('input[type="file"][accept=".md"]');
      await input.setInputFiles({
        name: 'locations.md',
        mimeType: 'text/plain',
        buffer: Buffer.from('## Bonfire Keep\nAn ancient fortress.\n\n## Mirela\nA weary innkeeper.'),
      });
      await page.getByRole('button', { name: /extract content/i }).click();
      await expect(page.getByText('Bonfire Keep')).toBeVisible({ timeout: 10_000 });
    }, 30_000);

    await checkpoint(testInfo, 'uncheck-reduces-count', async () => {
      const firstCheckbox = page.locator('label').filter({ hasText: 'Bonfire Keep' }).locator('[role="checkbox"]');
      await firstCheckbox.click();
      await expect(page.getByRole('button', { name: /save 1 entity/i })).toBeVisible({ timeout: 3_000 });
    }, 8_000);
  });

  test('oversized file shows error without extracting', async ({ page }, testInfo) => {
    await checkpoint(testInfo, 'open-sheet', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      await page.getByRole('button', { name: /import/i }).click();
      await expect(page.getByText(/import from markdown/i)).toBeVisible({ timeout: 5_000 });
    }, 25_000);

    await checkpoint(testInfo, 'upload-oversized-file', async () => {
      const input = page.locator('input[type="file"][accept=".md"]');
      await input.setInputFiles({
        name: 'huge.md',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'.repeat(65_000)),
      });
      await expect(page.getByText(/file too large/i)).toBeVisible({ timeout: 3_000 });
    }, 8_000);
  });
});
