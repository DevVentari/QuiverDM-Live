import { test, expect } from '@playwright/test';

test.describe('Homebrew card components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dev/cards');
  });

  test('spell card fixture renders collapsed and expanded', async ({ page }) => {
    const section = page.getByTestId('spell-cards');
    await expect(section).toBeVisible();
    await expect(section.getByText('Fireball').first()).toBeVisible();
  });

  test('monster stat block renders drawer and full modes', async ({ page }) => {
    const section = page.getByTestId('monster-blocks');
    await expect(section).toBeVisible();
    await expect(section.getByText('Ogre').first()).toBeVisible();
    await expect(section.getByTestId('monster-stat-drawer')).toBeVisible();
  });

  test('magic item card renders with lore section', async ({ page }) => {
    const section = page.getByTestId('magic-item-cards');
    await expect(section).toBeVisible();
    await expect(section.getByText('Vorpal Sword')).toBeVisible();
    await expect(section.getByText('Lore')).toBeVisible();
  });
});
