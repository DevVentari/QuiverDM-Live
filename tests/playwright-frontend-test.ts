import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const TEST_URL = process.env.TEST_URL || 'http://localhost:3847';
const CREDENTIALS = {
  email: process.env.TEST_EMAIL || 'test@example.com',
  password: process.env.TEST_PASSWORD || 'your-test-password'
};

// Test document path
const PDF_PATH = path.join(process.cwd(), 'test-documents', 'dms-guild-documents', '377346-EchidnaDesign-Honkonomicon_v_1_0.pdf');

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFrontendTest() {
  console.log('🎭 Starting Playwright Frontend Test');
  console.log('=====================================\n');

  // Verify PDF exists
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ Test PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }
  console.log(`✅ Found test PDF: ${path.basename(PDF_PATH)}`);

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch browser
    console.log('\n📦 Step 1: Launching browser...');
    browser = await chromium.launch({
      headless: false, // Show browser for visual testing
      slowMo: 100, // Slow down actions for visibility
    });
    page = await browser.newPage();
    console.log('✅ Browser launched');

    // Navigate to app
    console.log('\n🌐 Step 2: Navigating to app...');
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');
    console.log(`✅ Loaded: ${page.url()}`);

    // Navigate to homebrew page first - it will redirect to signin if needed
    console.log('\n📚 Step 3: Navigating to Homebrew Library...');
    await page.goto(`${TEST_URL}/homebrew`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);

    // Check if we need to login
    const currentUrl = page.url();
    if (currentUrl.includes('auth') || currentUrl.includes('signin')) {
      console.log('\n🔑 Step 4: Logging in...');
      console.log(`   Current URL: ${currentUrl}`);

      // Wait for email input
      await page.waitForSelector('input[type="email"], input[name="email"], input#email', { timeout: 10000 });

      // Fill credentials
      const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]') || await page.$('input#email');
      const passwordInput = await page.$('input[type="password"]') || await page.$('input[name="password"]') || await page.$('input#password');

      if (!emailInput || !passwordInput) {
        throw new Error('Could not find login form fields');
      }

      await emailInput.fill(CREDENTIALS.email);
      await passwordInput.fill(CREDENTIALS.password);
      console.log('   Filled credentials');

      // Click sign in button
      const signInButton = await page.$('button[type="submit"]') || await page.$('button:has-text("Sign")');
      if (!signInButton) {
        throw new Error('Sign in button not found');
      }
      await signInButton.click();
      console.log('   Clicked sign in');

      // Wait for redirect after login
      await page.waitForLoadState('networkidle');
      await sleep(3000);
      console.log(`✅ Logged in, current URL: ${page.url()}`);

      // Check if we're still on signin page (might have failed)
      if (page.url().includes('signin') || page.url().includes('error')) {
        console.log('⚠️ Login might have failed, taking screenshot');
        await page.screenshot({ path: 'tests/screenshots/login-failed.png' });

        // Try to find error message
        const errorText = await page.$('text=/error|invalid|incorrect/i');
        if (errorText) {
          const msg = await errorText.textContent();
          console.log(`   Error message: ${msg}`);
        }
      }

      // Navigate to homebrew again after login
      await page.goto(`${TEST_URL}/homebrew`);
      await page.waitForLoadState('networkidle');
      await sleep(1000);
    } else {
      console.log('\n🔑 Step 4: Already logged in');
    }

    console.log(`✅ On homebrew page: ${page.url()}`);

    // Take screenshot of homebrew page
    await page.screenshot({ path: 'tests/screenshots/01-homebrew-page.png' });
    console.log('📸 Screenshot: 01-homebrew-page.png');

    // Click on PDF Library tab
    console.log('\n📄 Step 5: Navigating to PDF Library tab...');
    const pdfLibraryTab = await page.$('button:has-text("PDF Library"), [role="tab"]:has-text("PDF Library")');
    if (pdfLibraryTab) {
      await pdfLibraryTab.click();
      await sleep(1000);
      console.log('✅ Clicked PDF Library tab');
    } else {
      console.log('⚠️ PDF Library tab not found, trying direct click');
      await page.click('text=PDF Library');
      await sleep(1000);
    }

    // Take screenshot of PDF Library tab
    await page.screenshot({ path: 'tests/screenshots/02-pdf-library-tab.png' });
    console.log('📸 Screenshot: 02-pdf-library-tab.png');

    // Upload PDF
    console.log('\n📤 Step 6: Uploading PDF...');

    // Find file input (it's hidden, but we can still use setInputFiles)
    const fileInput = await page.$('input[type="file"][accept*="pdf"]') || await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('File input not found on page');
    }

    // Upload file
    await fileInput.setInputFiles(PDF_PATH);
    await sleep(1000);
    console.log(`✅ Selected file: ${path.basename(PDF_PATH)}`);

    // Take screenshot after file selection
    await page.screenshot({ path: 'tests/screenshots/03-file-selected.png' });
    console.log('📸 Screenshot: 03-file-selected.png');

    // Select OpenAI provider if extraction is enabled
    console.log('\n⚙️ Step 7: Configuring extraction settings...');

    // Check if AI extraction checkbox exists and is checked
    const extractionCheckbox = await page.$('input[type="checkbox"]');
    if (extractionCheckbox) {
      const isChecked = await extractionCheckbox.isChecked();
      console.log(`   AI Extraction: ${isChecked ? 'enabled' : 'disabled'}`);
    }

    // Select OpenAI provider
    const providerSelect = await page.$('button[role="combobox"]');
    if (providerSelect) {
      await providerSelect.click();
      await sleep(500);

      // Look for OpenAI option
      const openaiOption = await page.$('div[role="option"]:has-text("GPT-4")');
      if (openaiOption) {
        await openaiOption.click();
        console.log('✅ Selected OpenAI provider');
      } else {
        console.log('⚠️ OpenAI option not found, using default provider');
      }
      await sleep(500);
    }

    // Take screenshot of settings
    await page.screenshot({ path: 'tests/screenshots/04-extraction-settings.png' });
    console.log('📸 Screenshot: 04-extraction-settings.png');

    // Click upload button
    console.log('\n🚀 Step 8: Starting upload...');
    const uploadButton = await page.$('button:has-text("Upload")');
    if (!uploadButton) {
      throw new Error('Upload button not found');
    }

    await uploadButton.click();
    console.log('✅ Upload initiated');

    // Wait for upload to complete
    console.log('\n⏳ Step 9: Waiting for processing...');
    await sleep(2000);

    // Take screenshot during processing
    await page.screenshot({ path: 'tests/screenshots/05-processing.png' });
    console.log('📸 Screenshot: 05-processing.png');

    // Wait for success or error message (max 60 seconds)
    let processingComplete = false;
    for (let i = 0; i < 30; i++) {
      // Check for success indicators
      const successMessage = await page.$('text=/Success|Uploaded|Complete/i');
      const errorMessage = await page.$('text=/Error|Failed/i');
      const newPdfEntry = await page.$('text=/Honkonomicon/i');

      if (successMessage || newPdfEntry) {
        console.log('✅ Upload successful!');
        processingComplete = true;
        break;
      }

      if (errorMessage) {
        const errorText = await errorMessage.textContent();
        console.log(`⚠️ Error detected: ${errorText}`);
        processingComplete = true;
        break;
      }

      await sleep(2000);
      process.stdout.write('.');
    }

    if (!processingComplete) {
      console.log('\n⚠️ Processing timeout - checking current state');
    }

    // Take final screenshot
    await page.screenshot({ path: 'tests/screenshots/06-final-state.png' });
    console.log('📸 Screenshot: 06-final-state.png');

    // Check for extracted content
    console.log('\n🔍 Step 10: Checking for extracted content...');

    // Look for content indicators
    const contentList = await page.$$('div[data-content-type], [class*="content-item"]');
    console.log(`   Found ${contentList.length} content items on page`);

    // Check if PDF appears in list
    const pdfList = await page.$$('text=/Honkonomicon/i');
    console.log(`   Found ${pdfList.length} references to uploaded PDF`);

    // Final summary
    console.log('\n=====================================');
    console.log('🎭 Frontend Test Complete');
    console.log('=====================================');
    console.log(`Screenshots saved to: tests/screenshots/`);
    console.log(`Final URL: ${page.url()}`);

    // Keep browser open for manual inspection
    console.log('\n⏸️ Browser will remain open for 30 seconds for inspection...');
    await sleep(30000);

  } catch (error: any) {
    console.error(`\n❌ Test failed: ${error.message}`);
    if (page) {
      await page.screenshot({ path: 'tests/screenshots/error-state.png' });
      console.log('📸 Error screenshot saved');
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n👋 Browser closed');
    }
  }
}

// Create screenshots directory
const screenshotsDir = path.join(process.cwd(), 'tests', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Run test
runFrontendTest().catch(console.error);
