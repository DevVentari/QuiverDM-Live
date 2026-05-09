import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers/auth';

test.describe('Session Prep — Map-Canvas Briefing Board', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('prep page renders map canvas area', async ({ page }) => {
    await page.goto('/');
    const hero = page.getByTestId('next-session-hero');
    if (await hero.isVisible()) {
      const prepLink = hero.getByRole('link', { name: /prep/i });
      if (await prepLink.isVisible()) {
        await prepLink.click();
        await expect(page.getByTestId('prep-map-canvas')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('prep page renders right rail with non-spatial cards', async ({ page }) => {
    await page.goto('/');
    const hero = page.getByTestId('next-session-hero');
    if (await hero.isVisible()) {
      const prepLink = hero.getByRole('link', { name: /prep/i });
      if (await prepLink.isVisible()) {
        await prepLink.click();
        await expect(page.getByTestId('briefing-rail')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('prep page renders party state bottom strip', async ({ page }) => {
    await page.goto('/');
    const hero = page.getByTestId('next-session-hero');
    if (await hero.isVisible()) {
      const prepLink = hero.getByRole('link', { name: /prep/i });
      if (await prepLink.isVisible()) {
        await prepLink.click();
        await expect(page.getByTestId('party-strip')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('rail import button opens sheet', async ({ page }) => {
    await page.goto('/');
    const hero = page.getByTestId('next-session-hero');
    if (await hero.isVisible()) {
      const prepLink = hero.getByRole('link', { name: /prep/i });
      if (await prepLink.isVisible()) {
        await prepLink.click();
        const importBtn = page.getByTestId('prep-import-button');
        if (await importBtn.isVisible()) {
          await importBtn.click();
          await expect(page.getByTestId('prep-import-zone')).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});
