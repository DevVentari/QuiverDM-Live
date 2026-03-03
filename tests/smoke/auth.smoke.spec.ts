import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('sign-in redirects into app shell', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  await expect(page).toHaveURL(/dashboard|onboarding|campaigns|characters|homebrew|settings|members/);
});

