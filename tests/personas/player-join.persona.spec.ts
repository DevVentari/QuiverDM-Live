import { test, expect } from '@playwright/test';

test.fixme('player-join happy path: join from invite link and access allowed surfaces', async ({ page }) => {
  const inviteUrl = process.env.QA_PLAYER_INVITE_URL ?? '';
  test.skip(!inviteUrl, 'QA_PLAYER_INVITE_URL not set');

  await page.goto(inviteUrl);
  // TODO: complete join flow and assert campaign access.
  await expect(page).toHaveURL(/join|campaigns|dashboard/);
});

test.fixme('player-join failure path: invalid or expired invite gives clear error', async ({ page }) => {
  const invalidInviteUrl = process.env.QA_PLAYER_INVALID_INVITE_URL ?? '';
  test.skip(!invalidInviteUrl, 'QA_PLAYER_INVALID_INVITE_URL not set');

  await page.goto(invalidInviteUrl);
  // TODO: assert expired/invalid invite message and retry guidance.
  await expect(page.getByText(/invalid|expired|not found/i)).toBeVisible();
});
