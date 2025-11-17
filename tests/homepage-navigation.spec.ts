import { test, expect } from '@playwright/test';

test.describe('Homepage and Navigation', () => {
  test('should redirect from homepage to campaigns page', async ({ page }) => {
    // Navigate to homepage
    await page.goto('http://localhost:3000/');

    // Should redirect to /campaigns
    await expect(page).toHaveURL('http://localhost:3000/campaigns');
  });

  test('should display campaigns page with header', async ({ page }) => {
    await page.goto('http://localhost:3000/campaigns');

    // Check for "My Campaigns" heading
    const heading = page.getByRole('heading', { name: /my campaigns/i });
    await expect(heading).toBeVisible();

    // Check for "New Campaign" button
    const newCampaignButton = page.getByRole('button', { name: /new campaign/i });
    await expect(newCampaignButton).toBeVisible();
  });

  test('should navigate to homebrew library', async ({ page }) => {
    await page.goto('http://localhost:3000/homebrew');

    // Check for "My Homebrew Library" heading
    const heading = page.getByRole('heading', { name: /my homebrew library/i });
    await expect(heading).toBeVisible();

    // Check for action buttons
    const uploadButton = page.getByRole('button', { name: /upload pdf/i });
    await expect(uploadButton).toBeVisible();

    const createButton = page.getByRole('button', { name: /create homebrew/i });
    await expect(createButton).toBeVisible();
  });

  test('should display empty state when no campaigns exist', async ({ page }) => {
    await page.goto('http://localhost:3000/campaigns');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if either campaigns are shown OR empty state is shown
    const hasCampaigns = await page.getByText(/sessions/i).isVisible().catch(() => false);

    if (!hasCampaigns) {
      // Should show empty state
      const emptyStateHeading = page.getByRole('heading', { name: /welcome to quiverdm/i });
      await expect(emptyStateHeading).toBeVisible();

      const createCampaignButton = page.getByRole('button', { name: /create campaign/i });
      await expect(createCampaignButton).toBeVisible();
    }
  });

  test('should navigate to campaign detail page if campaigns exist', async ({ page }) => {
    await page.goto('http://localhost:3000/campaigns');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Try to find a campaign card (if any exist)
    const campaignCard = page.locator('[class*="cursor-pointer"]').first();
    const campaignExists = await campaignCard.isVisible().catch(() => false);

    if (campaignExists) {
      // Click on first campaign
      await campaignCard.click();

      // Should navigate to campaign detail page
      await expect(page).toHaveURL(/\/campaigns\/[a-z0-9]+/);

      // Should see campaign navigation
      const overviewTab = page.getByText('Overview');
      await expect(overviewTab).toBeVisible();

      // Should see "Back to Campaigns" link
      const backLink = page.getByText(/back to campaigns/i);
      await expect(backLink).toBeVisible();

      // Test navigation tabs
      const playersTab = page.getByRole('link', { name: /players/i });
      await expect(playersTab).toBeVisible();

      const homebrewTab = page.getByRole('link', { name: /homebrew/i });
      await expect(homebrewTab).toBeVisible();
    }
  });

  test('should navigate between campaign sections', async ({ page }) => {
    await page.goto('http://localhost:3000/campaigns');
    await page.waitForLoadState('networkidle');

    // Try to find a campaign card
    const campaignCard = page.locator('[class*="cursor-pointer"]').first();
    const campaignExists = await campaignCard.isVisible().catch(() => false);

    if (campaignExists) {
      await campaignCard.click();
      await page.waitForLoadState('networkidle');

      // Get the campaign ID from URL
      const url = page.url();
      const campaignId = url.match(/\/campaigns\/([a-z0-9]+)/)?.[1];

      if (campaignId) {
        // Navigate to Players
        await page.getByRole('link', { name: /^players$/i }).click();
        await expect(page).toHaveURL(`http://localhost:3000/campaigns/${campaignId}/players`);

        // Navigate to Homebrew
        await page.getByRole('link', { name: /^homebrew$/i }).click();
        await expect(page).toHaveURL(`http://localhost:3000/campaigns/${campaignId}/homebrew`);

        // Check for "My Library" button on homebrew page
        const myLibraryButton = page.getByRole('link', { name: /my library/i });
        await expect(myLibraryButton).toBeVisible();

        // Navigate back to campaigns
        await page.getByText(/back to campaigns/i).click();
        await expect(page).toHaveURL('http://localhost:3000/campaigns');
      }
    }
  });

  test('should navigate from campaign homebrew to user library', async ({ page }) => {
    await page.goto('http://localhost:3000/campaigns');
    await page.waitForLoadState('networkidle');

    const campaignCard = page.locator('[class*="cursor-pointer"]').first();
    const campaignExists = await campaignCard.isVisible().catch(() => false);

    if (campaignExists) {
      await campaignCard.click();
      await page.waitForLoadState('networkidle');

      // Navigate to homebrew
      await page.getByRole('link', { name: /^homebrew$/i }).click();

      // Click "My Library" button
      const myLibraryButton = page.getByRole('link', { name: /my library/i });
      await myLibraryButton.click();

      // Should navigate to /homebrew
      await expect(page).toHaveURL('http://localhost:3000/homebrew');

      // Should see "My Homebrew Library" heading
      const heading = page.getByRole('heading', { name: /my homebrew library/i });
      await expect(heading).toBeVisible();
    }
  });
});
