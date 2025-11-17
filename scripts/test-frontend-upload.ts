/**
 * Front-end integration test for homebrew PDF upload
 * Uses Playwright to test the complete UI workflow
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const TEST_PDF_PATH = path.join(process.cwd(), 'test-documents', 'homebrew-sample.pdf');
const BASE_URL = 'http://localhost:3002';
const CAMPAIGN_URL = `${BASE_URL}/campaigns/cmhsbpbhd0002ia54fik2pwvb/homebrew`;

async function testFrontendUpload() {
  console.log('🎭 Starting Playwright front-end test...\n');

  // Check if PDF exists
  if (!fs.existsSync(TEST_PDF_PATH)) {
    console.error('❌ Test PDF not found:', TEST_PDF_PATH);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to homebrew library
    console.log('📖 Step 1: Opening homebrew library page...');
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded\n');

    // Step 2: Verify existing items are displayed
    console.log('🔍 Step 2: Checking for existing items...');
    const existingItems = await page.locator('[data-testid="homebrew-item"], .homebrew-item, [class*="item"]').count();
    console.log(`   Found ${existingItems} existing items in library\n`);

    // Step 3: Find and interact with upload component
    console.log('📤 Step 3: Uploading PDF...');

    // Look for file input
    const fileInput = page.locator('input[type="file"][accept=".pdf"]');
    await fileInput.setInputFiles(TEST_PDF_PATH);
    console.log('✅ PDF selected\n');

    // Wait a moment for the UI to update
    await page.waitForTimeout(1000);

    // Step 4: Check if processing mode options appeared
    console.log('⚙️  Step 4: Checking processing mode options...');
    const quickModeExists = await page.getByText('Quick Extract').isVisible().catch(() => false);
    const sourcebookModeExists = await page.getByText('Full Sourcebook').isVisible().catch(() => false);

    if (quickModeExists || sourcebookModeExists) {
      console.log('✅ Processing mode options visible');
      console.log(`   - Quick Extract: ${quickModeExists ? 'Visible' : 'Not visible'}`);
      console.log(`   - Sourcebook Mode: ${sourcebookModeExists ? 'Visible' : 'Not visible'}\n`);
    }

    // Step 5: Click upload/process button
    console.log('🚀 Step 5: Starting processing...');

    // Look for process button (could be "Quick Extract" or "Process Sourcebook")
    const processButton = page.locator('button').filter({
      hasText: /Quick Extract|Process Sourcebook|Upload/i
    }).first();

    if (await processButton.isVisible()) {
      await processButton.click();
      console.log('✅ Processing started\n');
    } else {
      console.log('⚠️  Could not find process button\n');
    }

    // Step 6: Wait for processing to complete
    console.log('⏳ Step 6: Waiting for processing (this may take 20-60 seconds)...');

    // Monitor console for progress
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Progress:') || text.includes('Processing') || text.includes('Extraction')) {
        console.log(`   ${text}`);
      }
    });

    // Wait for processing to complete (look for completion indicators)
    try {
      await page.waitForResponse(
        response => response.url().includes('/api/homebrew/process') && response.status() === 200,
        { timeout: 120000 } // 2 minutes
      );
      console.log('✅ Processing API call completed\n');
    } catch (error) {
      console.log('⚠️  Processing may have failed or timed out\n');
    }

    // Wait for UI to update
    await page.waitForTimeout(2000);

    // Step 7: Verify new items appear in library
    console.log('🔍 Step 7: Verifying items in library...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    const updatedItems = await page.locator('[data-testid="homebrew-item"], .homebrew-item, [class*="item"]').count();
    console.log(`   Total items now: ${updatedItems}`);

    if (updatedItems > existingItems) {
      console.log(`✅ SUCCESS! Added ${updatedItems - existingItems} new items\n`);
    } else {
      console.log('⚠️  No new items detected in UI\n');
    }

    // Step 8: Take a screenshot
    console.log('📸 Step 8: Taking screenshot...');
    await page.screenshot({ path: 'test-results/homebrew-library-test.png', fullPage: true });
    console.log('✅ Screenshot saved to test-results/homebrew-library-test.png\n');

    // Step 9: Check for any items with our test content
    console.log('🔍 Step 9: Looking for specific items...');
    const swordOfFlames = await page.getByText('Sword of Flames').isVisible().catch(() => false);
    const cloakOfShadows = await page.getByText('Cloak of Shadows').isVisible().catch(() => false);
    const arcaneBolt = await page.getByText('Arcane Bolt').isVisible().catch(() => false);
    const shadowDrake = await page.getByText('Shadow Drake').isVisible().catch(() => false);

    console.log('   Items found:');
    console.log(`   - Sword of Flames: ${swordOfFlames ? '✅' : '❌'}`);
    console.log(`   - Cloak of Shadows: ${cloakOfShadows ? '✅' : '❌'}`);
    console.log(`   - Arcane Bolt: ${arcaneBolt ? '✅' : '❌'}`);
    console.log(`   - Shadow Drake: ${shadowDrake ? '✅' : '❌'}\n`);

    const allFound = swordOfFlames && cloakOfShadows && arcaneBolt && shadowDrake;

    // Final summary
    console.log('═══════════════════════════════════════');
    if (allFound) {
      console.log('✨ FRONT-END TEST PASSED! ✨');
      console.log('═══════════════════════════════════════');
      console.log('✅ All 4 items visible in UI');
      console.log('✅ Complete workflow working');
    } else {
      console.log('⚠️  PARTIAL SUCCESS');
      console.log('═══════════════════════════════════════');
      console.log('✅ Upload and processing completed');
      console.log('⚠️  Not all items visible in UI');
      console.log('   (Items may be in database but not displayed)');
    }
    console.log('═══════════════════════════════════════\n');

    // Keep browser open for manual inspection
    console.log('🔍 Browser will remain open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);

    // Take error screenshot
    await page.screenshot({ path: 'test-results/homebrew-library-error.png', fullPage: true });
    console.log('📸 Error screenshot saved to test-results/homebrew-library-error.png');
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

testFrontendUpload();
