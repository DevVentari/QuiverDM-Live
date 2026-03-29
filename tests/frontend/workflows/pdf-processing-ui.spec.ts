import { test, expect } from '@playwright/test';
import { loginAsFrontendTestUser } from '../helpers/auth';
import { ensureFrontendFixture } from '../helpers/test-data';

test.describe('Frontend Workflow: PDF Processing', () => {
  test('pdf list page renders with upload controls and entries', async ({ page }) => {
    await ensureFrontendFixture();
    await loginAsFrontendTestUser(page);

    await page.goto('/homebrew/pdfs');
    await expect(page.getByRole('heading', { name: 'PDFs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload PDF' })).toBeVisible();
    await expect(page.getByText('frontend-cert.pdf')).toBeVisible();
  });
});

