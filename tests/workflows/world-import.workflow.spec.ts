import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

const MOCK_JSON_PREVIEWS = [
  {
    filename: 'Factions.json',
    slug: 'factions',
    title: 'Factions',
    valid: true,
    docType: 'factions',
    npcCount: 0,
    homebrewCount: 0,
    entityCount: 3,
  },
];

const MOCK_MD_ENTITIES = [
  { type: 'location', name: 'Bonfire Keep', description: 'An ancient fortress overlooking the valley.', data: {}, tags: ['fortress'] },
  { type: 'npc', name: 'Mirela', description: 'A weary innkeeper with secrets.', data: {}, tags: [] },
];

test.describe('World Import Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  });

  // ── JSON tab ──────────────────────────────────────────────────────────────

  test('JSON tab is default — file input accepts .json with multi-select', async ({ page }, testInfo) => {
    await checkpoint(testInfo, 'navigate-to-world', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 20_000);

    await checkpoint(testInfo, 'open-import-sheet', async () => {
      await page.getByRole('button', { name: /import/i }).first().click();
      await expect(page.getByText('Import World Content')).toBeVisible({ timeout: 5_000 });
    }, 8_000);

    await checkpoint(testInfo, 'json-input-present', async () => {
      const jsonInput = page.locator('input[type="file"][accept=".json"]');
      await expect(jsonInput).toBeAttached({ timeout: 3_000 });
      await expect(jsonInput).toHaveAttribute('multiple', '');
    }, 5_000);
  });

  // ── Markdown tab ──────────────────────────────────────────────────────────

  test('Markdown tab — switches to .md picker and shows Extract Content button', async ({ page }, testInfo) => {
    await checkpoint(testInfo, 'navigate-to-world', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 20_000);

    await checkpoint(testInfo, 'open-import-sheet', async () => {
      await page.getByRole('button', { name: /import/i }).first().click();
      await expect(page.getByText('Import World Content')).toBeVisible({ timeout: 5_000 });
    }, 8_000);

    await checkpoint(testInfo, 'switch-to-markdown', async () => {
      await page.getByRole('button', { name: /markdown/i }).click();
      const mdInput = page.locator('input[type="file"][accept=".md"]');
      await expect(mdInput).toBeAttached({ timeout: 3_000 });
      await expect(page.getByRole('button', { name: /extract content/i })).toBeVisible({ timeout: 3_000 });
    }, 5_000);
  });

  // ── PDF tab ───────────────────────────────────────────────────────────────

  test('PDF tab — switches to .pdf picker and shows Docling hint', async ({ page }, testInfo) => {
    await checkpoint(testInfo, 'navigate-to-world', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 20_000);

    await checkpoint(testInfo, 'open-import-sheet', async () => {
      await page.getByRole('button', { name: /import/i }).first().click();
      await expect(page.getByText('Import World Content')).toBeVisible({ timeout: 5_000 });
    }, 8_000);

    await checkpoint(testInfo, 'switch-to-pdf', async () => {
      await page.getByRole('button', { name: /pdf/i }).click();
      const pdfInput = page.locator('input[type="file"][accept=".pdf"]');
      await expect(pdfInput).toBeAttached({ timeout: 3_000 });
      await expect(page.getByText(/converted via docling/i)).toBeVisible({ timeout: 3_000 });
    }, 5_000);
  });

  // ── JSON import — review + confirm ────────────────────────────────────────

  test('JSON import — upload file shows review screen with file card and enabled Import button', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/campaigns.importFromJson**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { previews: MOCK_JSON_PREVIEWS } } }]),
      });
    });
    await page.route('**/api/trpc/campaigns.confirmJsonImport**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { saved: 1 } } }]),
      });
    });

    await checkpoint(testInfo, 'navigate-to-world', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 20_000);

    await checkpoint(testInfo, 'open-import-sheet', async () => {
      await page.getByRole('button', { name: /import/i }).first().click();
      await expect(page.getByText('Import World Content')).toBeVisible({ timeout: 5_000 });
    }, 8_000);

    await checkpoint(testInfo, 'upload-json-file', async () => {
      const jsonInput = page.locator('input[type="file"][accept=".json"]');
      await jsonInput.setInputFiles({
        name: 'Factions.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ docType: 'factions', factions: [{ name: 'Iron Circle' }] })),
      });
    }, 5_000);

    await checkpoint(testInfo, 'review-screen-shows-file-card', async () => {
      await expect(page.getByText(/files parsed/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('label').filter({ hasText: /factions/i }).first()).toBeVisible({ timeout: 5_000 });
    }, 15_000);

    await checkpoint(testInfo, 'import-button-enabled', async () => {
      const importBtn = page.getByRole('button', { name: /import \d+ file/i });
      await expect(importBtn).toBeEnabled({ timeout: 3_000 });
    }, 5_000);
  });

  // ── JSON import — invalid file ────────────────────────────────────────────

  test('JSON import — invalid JSON file shows invalid badge and Import 0 button disabled', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/campaigns.importFromJson**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{
          result: {
            data: {
              previews: [{
                filename: 'bad.json',
                slug: '',
                title: 'bad.json',
                valid: false,
                docType: 'unknown',
                npcCount: 0,
                homebrewCount: 0,
                entityCount: 0,
              }],
            },
          },
        }]),
      });
    });

    await checkpoint(testInfo, 'navigate-to-world', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 20_000);

    await checkpoint(testInfo, 'open-import-sheet', async () => {
      await page.getByRole('button', { name: /import/i }).first().click();
      await expect(page.getByText('Import World Content')).toBeVisible({ timeout: 5_000 });
    }, 8_000);

    await checkpoint(testInfo, 'upload-invalid-json', async () => {
      const jsonInput = page.locator('input[type="file"][accept=".json"]');
      await jsonInput.setInputFiles({
        name: 'bad.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{ not valid json }'),
      });
    }, 5_000);

    await checkpoint(testInfo, 'invalid-badge-visible', async () => {
      await expect(page.getByText(/files parsed/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 5_000 });
    }, 15_000);

    await checkpoint(testInfo, 'import-button-disabled', async () => {
      const importBtn = page.getByRole('button', { name: /import 0 files/i });
      await expect(importBtn).toBeDisabled({ timeout: 3_000 });
    }, 5_000);
  });

  // ── Markdown import — full flow ───────────────────────────────────────────

  test('Markdown import — upload, extract, review entities, save', async ({ page }, testInfo) => {
    await page.route('**/api/trpc/campaigns.importFromMarkdown**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: MOCK_MD_ENTITIES } }]),
      });
    });
    await page.route('**/api/trpc/campaigns.confirmImport**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ result: { data: { saved: 2 } } }]),
      });
    });

    await checkpoint(testInfo, 'navigate-to-world', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 20_000);

    await checkpoint(testInfo, 'open-import-sheet-and-switch-tab', async () => {
      await page.getByRole('button', { name: /import/i }).first().click();
      await expect(page.getByText('Import World Content')).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: /markdown/i }).click();
    }, 8_000);

    await checkpoint(testInfo, 'upload-md-file', async () => {
      const mdInput = page.locator('input[type="file"][accept=".md"]');
      await mdInput.setInputFiles({
        name: 'world-notes.md',
        mimeType: 'text/plain',
        buffer: Buffer.from('## Bonfire Keep\nAn ancient fortress.\n\n## Mirela\nA weary innkeeper.'),
      });
      await expect(page.getByText('world-notes.md')).toBeVisible({ timeout: 5_000 });
    }, 8_000);

    await checkpoint(testInfo, 'extract-and-review', async () => {
      await page.getByRole('button', { name: /extract content/i }).click();
      await expect(page.getByText(/extracting entities/i)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Bonfire Keep')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Mirela')).toBeVisible({ timeout: 5_000 });
    }, 25_000);

    await checkpoint(testInfo, 'save-entities', async () => {
      await expect(page.getByRole('button', { name: /save 2 entities/i })).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: /save 2 entities/i }).click();
      await expect(page.getByText('Import World Content')).not.toBeVisible({ timeout: 5_000 });
    }, 10_000);
  });

  // ── Markdown — oversized file ─────────────────────────────────────────────

  test('Markdown import — oversized file shows error without extracting', async ({ page }, testInfo) => {
    await checkpoint(testInfo, 'navigate-to-world', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    }, 20_000);

    await checkpoint(testInfo, 'open-import-sheet-and-switch-tab', async () => {
      await page.getByRole('button', { name: /import/i }).first().click();
      await expect(page.getByText('Import World Content')).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: /markdown/i }).click();
    }, 8_000);

    await checkpoint(testInfo, 'upload-oversized-file', async () => {
      const mdInput = page.locator('input[type="file"][accept=".md"]');
      await mdInput.setInputFiles({
        name: 'huge.md',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'.repeat(65_000)),
      });
      await expect(page.getByText(/file too large/i)).toBeVisible({ timeout: 3_000 });
    }, 8_000);
  });
});
