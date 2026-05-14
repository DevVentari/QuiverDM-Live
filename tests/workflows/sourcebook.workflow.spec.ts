import { test, expect } from '@playwright/test';
import { loginAsSeededDm, seedCampaignWithSourcebook } from '../helpers/auth';

test.describe('Sourcebook reader', () => {
  test('DM can open the sourcebook page and switch chapters via URL', async ({ page }) => {
    const { campaignSlug, firstChapterSlug, secondChapterSlug } = await seedCampaignWithSourcebook();
    await loginAsSeededDm(page);

    await page.goto(`/campaigns/${campaignSlug}/sourcebook`);

    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.locator('text=' + firstChapterSlug).first()).toBeVisible();

    await page.getByRole('button', { name: new RegExp(secondChapterSlug, 'i') }).click();
    await expect(page).toHaveURL(new RegExp(`chapter=${secondChapterSlug}`));

    await page.goto(`/campaigns/${campaignSlug}/sourcebook?chapter=${firstChapterSlug}`);
    await expect(page.locator('h1')).toContainText(firstChapterSlug, { ignoreCase: true });
  });

  test('entity links render with hover popover', async ({ page }) => {
    const { campaignSlug, chapterWithEntity, entityName } = await seedCampaignWithSourcebook({
      withEntity: true,
    });
    await loginAsSeededDm(page);

    await page.goto(`/campaigns/${campaignSlug}/sourcebook?chapter=${chapterWithEntity}`);
    const link = page.getByRole('link', { name: entityName! }).first();
    await expect(link).toBeVisible();
    await link.hover();
    await expect(page.getByRole('link', { name: /open/i })).toBeVisible();
  });

  test('empty chapter shows resync CTA', async ({ page }) => {
    const { campaignSlug, emptyChapterSlug } = await seedCampaignWithSourcebook({
      withEmptyChapter: true,
    });
    await loginAsSeededDm(page);

    await page.goto(`/campaigns/${campaignSlug}/sourcebook?chapter=${emptyChapterSlug}`);
    await expect(page.getByRole('button', { name: /re-sync sourcebook/i })).toBeVisible();
  });
});
