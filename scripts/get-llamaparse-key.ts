import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await page.goto('https://cloud.llamaindex.ai', { timeout: 60000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Click Continue with GitHub
  const githubLink = page.locator('a, button').filter({ hasText: /github/i }).first();
  await githubLink.click();
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());

  // GitHub login
  if (page.url().includes('github.com/login')) {
    await page.locator('#login_field').fill('dev@blakewales.au');
    await page.locator('#password').fill('c8XQ05~10');
    await page.locator('input[type="submit"]').click();
    await page.waitForTimeout(5000);
    console.log('After login:', page.url());
  }

  // Authorize page — click the green "Authorize run-llama" button
  if (page.url().includes('github.com') && page.url().includes('authorize')) {
    const authBtn = page.getByRole('button', { name: /authorize/i }).first();
    await authBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Clicking Authorize button...');
    await authBtn.click();
    await page.waitForTimeout(10000);
    console.log('After authorize:', page.url());
    await page.screenshot({ path: 'reports/llama-authorized.png' });
  }

  // Wait for redirect to LlamaCloud
  await page.waitForTimeout(5000);
  console.log('Final URL:', page.url());
  await page.screenshot({ path: 'reports/llama-dashboard.png' });

  // Navigate to API keys
  if (page.url().includes('cloud.llamaindex.ai') && !page.url().includes('login')) {
    console.log('LOGGED IN!');
    await page.goto('https://cloud.llamaindex.ai/api-key', { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'reports/llama-keys.png' });
    console.log('Keys page URL:', page.url());

    // Generate key
    const genBtn = page.locator('button').filter({ hasText: /generate|create|new/i }).first();
    if (await genBtn.count() > 0) {
      await genBtn.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'reports/llama-keys-created.png' });
    }

    // Extract key
    const text = await page.locator('body').textContent() || '';
    const m = text.match(/llx-[A-Za-z0-9_-]{20,}/);
    if (m) {
      console.log('\n=== API KEY ===');
      console.log(m[0]);
      console.log('===============');
    } else {
      // Try clipboard or input values
      const inputs = await page.locator('input').all();
      for (const inp of inputs) {
        const val = await inp.inputValue();
        if (val && val.length > 15) console.log('Input value:', val);
      }
    }
  }

  console.log('\nDone. Ctrl+C to close.');
  await page.waitForTimeout(300000);
  await browser.close();
})();
