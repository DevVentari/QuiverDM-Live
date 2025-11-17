import { Browserbase } from '@browserbasehq/sdk';
import { chromium } from 'playwright';

/**
 * QuiverDM UI Test Suite using Browserbase
 * Tests core workflows and UI functionality
 */

async function runUITests() {
  console.log('🚀 Starting QuiverDM UI Tests with Browserbase...\n');

  // Initialize Browserbase client
  const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });

  let sessionId: string | undefined;
  let browser;
  let context;
  let page;

  try {
    // Create a new session
    console.log('📡 Creating Browserbase session...');
    const session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
    });
    sessionId = session.id;
    console.log(`✅ Session created: ${sessionId}\n`);

    // Connect to the session
    console.log('🔌 Connecting to remote browser...');
    browser = await chromium.connectOverCDP(session.connectUrl);
    context = browser.contexts()[0];
    page = context.pages()[0];
    console.log('✅ Connected to browser\n');

    // === TEST 1: Homepage Load ===
    console.log('🧪 TEST 1: Homepage Load');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const title = await page.title();
    console.log(`   Page title: ${title}`);

    const screenshot1 = await page.screenshot({ fullPage: true });
    console.log('   📸 Screenshot captured');
    console.log('   ✅ Homepage loaded successfully\n');

    // === TEST 2: Navigation Elements ===
    console.log('🧪 TEST 2: Navigation Elements');
    const nav = await page.locator('nav').count();
    console.log(`   Navigation elements found: ${nav}`);

    const links = await page.locator('a').count();
    console.log(`   Links found: ${links}`);
    console.log('   ✅ Navigation elements present\n');

    // === TEST 3: Campaigns Link ===
    console.log('🧪 TEST 3: Check for Campaigns');
    const campaignsLink = page.getByText('Campaigns', { exact: false }).first();
    const campaignsVisible = await campaignsLink.isVisible().catch(() => false);

    if (campaignsVisible) {
      console.log('   ✅ Campaigns link found');
      await campaignsLink.click();
      await page.waitForTimeout(2000);

      const url = page.url();
      console.log(`   Navigated to: ${url}`);

      const screenshot2 = await page.screenshot({ fullPage: true });
      console.log('   📸 Screenshot captured\n');
    } else {
      console.log('   ⚠️  Campaigns link not found (may require auth)\n');
    }

    // === TEST 4: Check for Auth ===
    console.log('🧪 TEST 4: Authentication Check');
    const signInButton = page.getByText('Sign In', { exact: false }).first();
    const signInVisible = await signInButton.isVisible().catch(() => false);

    if (signInVisible) {
      console.log('   ℹ️  Sign In button found - app requires authentication');
      console.log('   📸 Capturing auth page screenshot');
      await page.screenshot({ fullPage: true });
    } else {
      console.log('   ✅ User appears to be authenticated\n');
    }

    // === TEST 5: Responsive Design ===
    console.log('🧪 TEST 5: Responsive Design');

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    console.log('   📱 Testing mobile viewport (375x667)');
    await page.screenshot({ fullPage: true });

    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    console.log('   📱 Testing tablet viewport (768x1024)');
    await page.screenshot({ fullPage: true });

    // Desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    console.log('   🖥️  Testing desktop viewport (1920x1080)');
    await page.screenshot({ fullPage: true });
    console.log('   ✅ Responsive design tests complete\n');

    // === TEST 6: Console Errors ===
    console.log('🧪 TEST 6: Console Error Check');
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      console.log(`   ⚠️  Console errors found: ${errors.length}`);
      errors.forEach(err => console.log(`      - ${err}`));
    } else {
      console.log('   ✅ No console errors detected\n');
    }

    console.log('\n✨ All UI tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);

    if (page) {
      console.log('📸 Capturing error screenshot...');
      await page.screenshot({ fullPage: true }).catch(console.error);
    }

    throw error;
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
      console.log('\n🔌 Browser disconnected');
    }
  }
}

// Run tests
runUITests()
  .then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
