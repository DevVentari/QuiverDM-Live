import { chromium } from 'playwright';

async function inspectFormattedPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the player page
    await page.goto('http://localhost:3005/campaigns/cmhsbpbhd0002ia54fik2pwvb/players/cmht26tcv0003tv2z136eec2s');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot
    await page.screenshot({ path: 'player-page-formatted.png', fullPage: true });

    // Get the Features & Traits section
    const featuresSection = await page.locator('h1:has-text("Features & Traits")').locator('..').locator('..');
    const featuresText = await featuresSection.textContent();

    console.log('\n=== FEATURES & TRAITS SECTION ===');
    console.log(featuresText);

    // Get the first feature specifically (Expanded Spell List)
    const firstFeature = await page.locator('text="Expanded Spell List"').locator('..').locator('..');
    const firstFeatureHTML = await firstFeature.innerHTML();
    const firstFeatureText = await firstFeature.textContent();

    console.log('\n=== EXPANDED SPELL LIST HTML ===');
    console.log(firstFeatureHTML.substring(0, 1000));

    console.log('\n=== EXPANDED SPELL LIST TEXT ===');
    console.log(firstFeatureText);

    // Keep browser open for manual inspection
    console.log('\n=== Browser kept open for manual inspection. Press Ctrl+C to close ===');
    await page.waitForTimeout(300000); // Wait 5 minutes

  } catch (error) {
    console.error('Error inspecting page:', error);
  } finally {
    await browser.close();
  }
}

inspectFormattedPage();
