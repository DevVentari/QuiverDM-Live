import { chromium } from 'playwright';

async function viewPlayerPage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    console.log('Navigating to player page...');
    await page.goto('http://localhost:3005/campaigns/cmhsbpbhd0002ia54fik2pwvb/players/cmht26tcv0003tv2z136eec2s', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'player-page-current.png', fullPage: true });

    console.log('Screenshot saved to player-page-current.png');
    console.log('Done!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

viewPlayerPage();
