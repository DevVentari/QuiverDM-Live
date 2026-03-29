import { test, expect } from '@playwright/test';
import { loginAsFrontendTestUser } from '../helpers/auth';
import { ensureFrontendFixture } from '../helpers/test-data';

test.describe('Frontend Workflow: Session Management', () => {
  test('session list and detail pages render', async ({ page }) => {
    const fixture = await ensureFrontendFixture();
    await loginAsFrontendTestUser(page);

    await page.goto(`/campaigns/${fixture.campaignSlug}/sessions`);
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(page.getByText('Frontend Certification Session')).toBeVisible();

    await page.goto(`/campaigns/${fixture.campaignSlug}/sessions/${fixture.sessionId}`);
    await expect(page.getByRole('heading', { name: 'Frontend Certification Session' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recordings' })).toBeVisible();
    await expect(page.getByText('Transcripts')).toBeVisible();
  });
});

