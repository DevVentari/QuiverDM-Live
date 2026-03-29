import { test, expect } from '@playwright/test';
import { loginAsFrontendTestUser } from '../helpers/auth';
import { ensureFrontendFixture } from '../helpers/test-data';

test.describe('Frontend Workflow: Transcription Pipeline', () => {
  test('transcript viewer is visible in session detail', async ({ page }) => {
    const fixture = await ensureFrontendFixture();
    await loginAsFrontendTestUser(page);

    await page.goto(`/campaigns/${fixture.campaignSlug}/sessions/${fixture.sessionId}`);
    await expect(page.getByText('Transcripts')).toBeVisible();
    await expect(page.getByPlaceholder('Search transcripts...')).toBeVisible();
    await expect(page.getByText('Frontend workflow transcript fixture.')).toBeVisible();
  });
});

