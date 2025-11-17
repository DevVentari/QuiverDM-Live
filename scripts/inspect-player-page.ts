import { chromium } from 'playwright';

async function inspectPlayerPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the player page
    await page.goto('http://localhost:3003/campaigns/cmhsbpbhd0002ia54fik2pwvb/players/cmht26tcv0003tv2z136eec2s');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot
    await page.screenshot({ path: 'player-page-screenshot.png', fullPage: true });

    // Get the page content
    const content = await page.content();
    console.log('=== PAGE HTML ===');
    console.log(content);

    // Get text content
    const bodyText = await page.locator('body').textContent();
    console.log('\n=== PAGE TEXT CONTENT ===');
    console.log(bodyText);

    // Look for specific sections that might have formatting issues
    const sections = await page.locator('[class*="section"], [class*="card"], [class*="content"]').all();
    console.log(`\n=== FOUND ${sections.length} SECTIONS ===`);

    for (let i = 0; i < sections.length; i++) {
      const text = await sections[i].textContent();
      const html = await sections[i].innerHTML();
      console.log(`\n--- Section ${i + 1} ---`);
      console.log('Text:', text?.substring(0, 200));
      console.log('HTML:', html.substring(0, 300));
    }

    // Keep browser open for manual inspection
    console.log('\n=== Browser kept open for manual inspection. Press Ctrl+C to close ===');
    await page.waitForTimeout(300000); // Wait 5 minutes

  } catch (error) {
    console.error('Error inspecting page:', error);
  } finally {
    await browser.close();
  }
}

inspectPlayerPage();
