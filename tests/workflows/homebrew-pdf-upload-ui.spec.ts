import path from 'path';
import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('homebrew pdf upload exposes file input and file chooser', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-pdf-processing', async () => {
    await page.goto('/homebrew/pdfs');
    await expect(page.getByRole('heading', { name: 'PDF Processing' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^upload pdf$/i }).first()).toBeEnabled();
  }, 8_000);

  await checkpoint(testInfo, 'open-file-chooser-and-select-pdf', async () => {
    const fileInput = page.locator('input[type="file"][accept=".pdf"]');
    await expect(fileInput).toHaveCount(1);

    const uploadButton = page.getByRole('button', { name: /^upload pdf$/i }).first();
    const chooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const chooser = await chooserPromise;

    const fixture = path.resolve('tests/test-homebrew-small.pdf');
    await chooser.setFiles(fixture);
  }, 6_000);
});
