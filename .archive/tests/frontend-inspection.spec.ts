import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const TEST_USER_EMAIL = 'dev@blakewales.au';
const TEST_USER_PASSWORD = 'xaub6Nam7648';

test.describe('Frontend Issues Inspection', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console messages
    page.on('console', (msg) => {
      const type = msg.type();
      console.log(`[CONSOLE ${type.toUpperCase()}] ${msg.text()}`);
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Listen for network failures
    page.on('requestfailed', (request) => {
      console.log(`[NETWORK FAILED] ${request.url()} - ${request.failure()?.errorText}`);
    });
  });

  test('should login and inspect homepage', async ({ page }) => {
    console.log('\n=== Step 1: Navigate to homepage ===');
    await page.goto('http://localhost:3000');
    await page.screenshot({ path: 'test-results/01-homepage.png', fullPage: true });

    // Check if we're redirected to login
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Check for style loading issues
    const styleLinks = await page.$$('link[rel="stylesheet"]');
    console.log(`\nStylesheets found: ${styleLinks.length}`);
    for (const link of styleLinks) {
      const href = await link.getAttribute('href');
      console.log(`  - ${href}`);
    }

    // Check computed styles on body
    const bodyBgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    console.log(`\nBody background color: ${bodyBgColor}`);

    console.log('\n=== Step 2: Attempt login ===');
    // Look for sign-in button
    const signInButton = page.locator('button', { hasText: /sign in|log in/i }).first();
    if (await signInButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signInButton.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/02-after-signin-click.png', fullPage: true });
    }

    // Try to find email/password inputs
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found email/password form');
      await emailInput.fill(TEST_USER_EMAIL);
      await passwordInput.fill(TEST_USER_PASSWORD);
      await page.screenshot({ path: 'test-results/03-credentials-filled.png', fullPage: true });

      // Submit form
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/04-after-login.png', fullPage: true });
    }

    console.log('\n=== Step 3: Navigate to campaigns ===');
    const campaignsUrl = currentUrl.includes('localhost:3000')
      ? 'http://localhost:3000/campaigns'
      : page.url().replace(/\/[^/]*$/, '/campaigns');

    await page.goto(campaignsUrl);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/05-campaigns-page.png', fullPage: true });

    // Check for any visible error messages
    const errorElements = await page.locator('[class*="error"], [role="alert"]').all();
    console.log(`\nError elements found: ${errorElements.length}`);
    for (const el of errorElements) {
      const text = await el.textContent();
      console.log(`  - ${text}`);
    }

    console.log('\n=== Step 4: Check for campaign (if exists) ===');
    // Try to find a campaign link
    const campaignLinks = await page.locator('a[href*="/campaigns/"]').all();
    console.log(`Campaign links found: ${campaignLinks.length}`);

    if (campaignLinks.length > 0) {
      const firstCampaign = campaignLinks[0];
      const href = await firstCampaign.getAttribute('href');
      console.log(`Navigating to campaign: ${href}`);
      await firstCampaign.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/06-campaign-detail.png', fullPage: true });

      console.log('\n=== Step 5: Navigate to Homebrew Library ===');
      const homebrewLink = page.locator('a[href*="/homebrew"]').first();
      if (await homebrewLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await homebrewLink.click();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/07-homebrew-library.png', fullPage: true });

        console.log('\n=== Step 6: Check PDF upload functionality ===');
        // Look for upload button
        const uploadButton = page.locator('button', { hasText: /upload|add pdf/i }).first();
        if (await uploadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await uploadButton.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'test-results/08-upload-dialog.png', fullPage: true });
        }

        // Check for "Manage PDFs" or similar tab
        const managePdfsTab = page.locator('button, a', { hasText: /manage pdfs/i }).first();
        if (await managePdfsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
          await managePdfsTab.click();
          await page.waitForLoadState('networkidle');
          await page.screenshot({ path: 'test-results/09-manage-pdfs.png', fullPage: true });
        }
      }
    }

    // Get all network requests
    console.log('\n=== Network Summary ===');
    // This would require setting up request tracking in beforeEach
  });

  test('should check for style issues in detail', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Check if Radix Themes styles are loaded
    const radixStyles = await page.evaluate(() => {
      const styles = Array.from(document.styleSheets);
      return styles.filter(sheet => {
        try {
          return sheet.href?.includes('radix') ||
                 Array.from(sheet.cssRules || []).some(rule =>
                   rule.cssText?.includes('radix') || rule.cssText?.includes('--')
                 );
        } catch {
          return false;
        }
      }).length;
    });

    console.log(`\nRadix-related stylesheets: ${radixStyles}`);

    // Check for CSS custom properties
    const cssVars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const vars: string[] = [];
      for (let i = 0; i < root.length; i++) {
        const prop = root[i];
        if (prop.startsWith('--')) {
          vars.push(prop);
        }
      }
      return vars.slice(0, 10); // First 10 CSS vars
    });

    console.log('\nCSS Custom Properties (first 10):');
    cssVars.forEach(v => console.log(`  ${v}`));

    await page.screenshot({ path: 'test-results/10-style-inspection.png', fullPage: true });
  });
});
