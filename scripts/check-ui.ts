/**
 * Simple UI check to verify items are displayed
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3002';
const CAMPAIGN_URL = `${BASE_URL}/campaigns/cmhsbpbhd0002ia54fik2pwvb/homebrew`;

async function checkUI() {
  console.log('🎭 Checking UI...\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded\n');

    // Take a screenshot
    await page.screenshot({ path: 'test-results/homebrew-page.png', fullPage: true });
    console.log('📸 Screenshot saved\n');

    // Check for our specific items
    console.log('🔍 Looking for test items...\n');

    const items = [
      'Sword of Flames',
      'Cloak of Shadows',
      'Arcane Bolt',
      'Shadow Drake'
    ];

    for (const item of items) {
      const isVisible = await page.getByText(item, { exact: false }).isVisible().catch(() => false);
      console.log(`   ${isVisible ? '✅' : '❌'} ${item}`);
    }

    console.log('\n🔍 Checking page structure...');

    // Log all text content containing our items
    const allText = await page.textContent('body');
    const hasItems = items.some(item => allText?.includes(item));

    if (hasItems) {
      console.log('✅ Items found in page content!');
    } else {
      console.log('❌ Items NOT found in page content');
    }

    // Get HTML structure for debugging
    const html = await page.content();
    console.log('\n📄 Page contains:', html.length, 'characters');

    // Look for file input
    const fileInputs = await page.locator('input[type="file"]').count();
    console.log(`📁 File inputs found: ${fileInputs}`);

    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will remain open for 60 seconds for inspection...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

checkUI();
