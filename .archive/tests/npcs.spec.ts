import { test, expect } from '@playwright/test';

test.describe('NPC Management', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture console errors and warnings
    consoleErrors = [];
    consoleWarnings = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });
  });

  test('should load NPCs page without console errors', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs');
    await page.waitForLoadState('networkidle');

    // Filter out expected warnings (favicon, icons)
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    console.log('Console Errors:', realErrors);
    console.log('Console Warnings:', consoleWarnings);

    expect(realErrors).toHaveLength(0);

    // Take screenshot
    await page.screenshot({ path: 'test-results/npcs-page.png', fullPage: true });
  });

  test('should display NPC list with test data', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs');
    await page.waitForLoadState('networkidle');

    // Should see NPCs heading
    await expect(page.getByRole('heading', { name: 'NPCs' })).toBeVisible();

    // Should see Add NPC button
    await expect(page.getByRole('button', { name: /Add NPC/ })).toBeVisible();

    // Should see search box
    await expect(page.getByPlaceholder(/Search NPCs/)).toBeVisible();

    // Should see NPC cards
    await expect(page.getByRole('heading', { name: 'Strahd von Zarovich' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ireena Kolyana' })).toBeVisible();

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should display NPC cards with all info', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs');
    await page.waitForLoadState('networkidle');

    // Check Strahd's card
    const strahdCard = page.getByRole('heading', { name: 'Strahd von Zarovich' }).locator('..');

    // Should show faction
    await expect(strahdCard.getByText('Undead')).toBeVisible();

    // Should show description snippet
    await expect(strahdCard.getByText(/ancient vampire lord/)).toBeVisible();

    // Should show secrets indicator
    await expect(strahdCard.getByText('Has secrets')).toBeVisible();

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should search NPCs by name', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs');
    await page.waitForLoadState('networkidle');

    // Search for "vampire" - wait for the tRPC API call to complete
    const responsePromise = page.waitForResponse(response =>
      response.url().includes('/trpc/npcs.getAll') && response.status() === 200
    );
    await page.getByPlaceholder(/Search NPCs/).fill('vampire');
    await responsePromise;

    // Should see Strahd (who has "vampire" in description)
    await expect(page.getByRole('heading', { name: 'Strahd von Zarovich' })).toBeVisible();

    // Ireena should not be in the DOM - use toHaveCount for auto-waiting
    await expect(page.getByRole('heading', { name: 'Ireena Kolyana' })).toHaveCount(0);

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should search NPCs by faction', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs');
    await page.waitForLoadState('networkidle');

    // Search for Barovian Refugees - wait for the tRPC API call to complete
    const responsePromise = page.waitForResponse(response =>
      response.url().includes('/trpc/npcs.getAll') && response.status() === 200
    );
    await page.getByPlaceholder(/Search NPCs/).fill('Barovian');
    await responsePromise;

    // Should see Ireena
    await expect(page.getByRole('heading', { name: 'Ireena Kolyana' })).toBeVisible();

    // Strahd should not be in the DOM - use toHaveCount for auto-waiting
    await expect(page.getByRole('heading', { name: 'Strahd von Zarovich' })).toHaveCount(0);

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should navigate to NPC detail page', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs');
    await page.waitForLoadState('networkidle');

    // Click on Strahd card
    await page.getByRole('heading', { name: 'Strahd von Zarovich' }).click();
    await page.waitForLoadState('networkidle');

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/campaigns\/test-campaign-1\/npcs\/test-npc-1/);

    // Should see NPC name
    await expect(page.getByRole('heading', { name: 'Strahd von Zarovich' })).toBeVisible();

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should handle campaign with no NPCs', async ({ page }) => {
    // Use Dragon Heist campaign which has no NPCs
    await page.goto('/campaigns/test-campaign-2/npcs');
    await page.waitForLoadState('networkidle');

    // Should see empty state
    await expect(page.getByRole('heading', { name: 'No NPCs Yet' })).toBeVisible();
    await expect(page.getByText('Add NPCs to track characters')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create First NPC/ })).toBeVisible();

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should show no results when search finds nothing', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs');
    await page.waitForLoadState('networkidle');

    // Search for non-existent NPC
    await page.getByPlaceholder(/Search NPCs/).fill('NonExistentNPC123');
    await page.waitForLoadState('networkidle');

    // Should see no results message
    await expect(page.getByRole('heading', { name: 'No NPCs Found' })).toBeVisible();
    await expect(page.getByText('Try adjusting your search query')).toBeVisible();

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });
});

test.describe('NPC Detail Page', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture console errors and warnings
    consoleErrors = [];
    consoleWarnings = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });
  });

  test('should load NPC detail page without console errors', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs/test-npc-1');
    await page.waitForLoadState('networkidle');

    // Filter out expected warnings
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    console.log('Console Errors:', realErrors);
    console.log('Console Warnings:', consoleWarnings);

    expect(realErrors).toHaveLength(0);

    // Take screenshot
    await page.screenshot({ path: 'test-results/npc-detail.png', fullPage: true });
  });

  test('should display NPC details correctly', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs/test-npc-1');
    await page.waitForLoadState('networkidle');

    // Should see NPC name
    await expect(page.getByRole('heading', { name: 'Strahd von Zarovich' })).toBeVisible();

    // Should see NPC label
    await expect(page.getByText('NPC', { exact: true })).toBeVisible();

    // Should see faction in text field
    const factionField = page.getByPlaceholder(/Harpers, Zhentarim/);
    await expect(factionField).toHaveValue('Undead');

    // Should see description
    const descriptionField = page.getByPlaceholder(/Physical appearance/);
    await expect(descriptionField).toContainText('ancient vampire lord');

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should show secrets section with toggle', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs/test-npc-1');
    await page.waitForLoadState('networkidle');

    // Should see DM Secrets heading
    await expect(page.getByRole('heading', { name: 'DM Secrets' })).toBeVisible();

    // Should see DM Only badge
    await expect(page.getByText('DM Only')).toBeVisible();

    // Secrets should be hidden by default
    await expect(page.getByText('Secrets hidden')).toBeVisible();

    // Click eye icon to reveal secrets
    const eyeButton = page.locator('button').filter({ has: page.locator('[class*="lucide-eye"]') });
    await eyeButton.click();

    // Should see secrets textarea
    const secretsField = page.getByPlaceholder(/Secret motivations/);
    await expect(secretsField).toBeVisible();
    await expect(secretsField).toContainText('Obsessed with Ireena');

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should have back button navigation', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs/test-npc-1');
    await page.waitForLoadState('networkidle');

    // Click back button
    const backButton = page.locator('button').filter({ has: page.locator('[class*="lucide-arrow-left"]') });
    await backButton.click();
    await page.waitForLoadState('networkidle');

    // Should navigate back to NPCs list
    await expect(page).toHaveURL('/campaigns/test-campaign-1/npcs');

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should display all form fields for editing', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/npcs/test-npc-1');
    await page.waitForLoadState('networkidle');

    // Should see name field
    const nameField = page.getByPlaceholder('NPC name');
    await expect(nameField).toBeVisible();
    await expect(nameField).toHaveValue('Strahd von Zarovich');

    // Should see faction field
    const factionField = page.getByPlaceholder(/Harpers, Zhentarim/);
    await expect(factionField).toBeVisible();

    // Should see description field
    const descriptionField = page.getByPlaceholder(/Physical appearance/);
    await expect(descriptionField).toBeVisible();

    // Should see image URL field
    const imageField = page.getByPlaceholder('Image URL');
    await expect(imageField).toBeVisible();

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });
});
