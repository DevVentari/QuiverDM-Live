import { test, expect } from '@playwright/test';

test.describe('UI Elements Audit', () => {
  const baseUrl = 'http://localhost:3001';

  test.describe('Form Elements', () => {
    test('should audit all form inputs on sign in page', async ({ page }) => {
      console.log('📍 Auditing sign in form elements...');

      await page.goto(`${baseUrl}/auth/signin`);
      await page.waitForLoadState('networkidle');

      // Check all input fields
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      console.log(`Found ${inputCount} input field(s)`);

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const type = await input.getAttribute('type');
        const id = await input.getAttribute('id');
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        const required = await input.getAttribute('required');

        console.log(`  Input ${i + 1}:`);
        console.log(`    Type: ${type}`);
        console.log(`    ID: ${id || 'MISSING'}`);
        console.log(`    Name: ${name || 'MISSING'}`);
        console.log(`    Placeholder: ${placeholder || 'none'}`);
        console.log(`    Required: ${required !== null}`);

        // Check for associated label
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          console.log(`    Has Label: ${hasLabel ? 'YES' : 'MISSING ⚠️'}`);
        }
      }

      // Check all buttons
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      console.log(`\nFound ${buttonCount} button(s)`);

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const type = await button.getAttribute('type');
        const text = await button.textContent();
        const disabled = await button.getAttribute('disabled');
        const ariaLabel = await button.getAttribute('aria-label');

        console.log(`  Button ${i + 1}:`);
        console.log(`    Text: ${text?.trim()}`);
        console.log(`    Type: ${type || 'button (default)'}`);
        console.log(`    Disabled: ${disabled !== null}`);
        console.log(`    ARIA Label: ${ariaLabel || 'none'}`);
      }

      await page.screenshot({ path: 'test-results/form-elements-audit.png', fullPage: true });
      console.log('✅ Form elements audit complete');
    });

    test('should check for proper input autocomplete attributes', async ({ page }) => {
      console.log('📍 Checking autocomplete attributes...');

      await page.goto(`${baseUrl}/auth/signin`);
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"]');
      const emailAutocomplete = await emailInput.getAttribute('autocomplete');
      console.log(`Email autocomplete: ${emailAutocomplete || 'MISSING ⚠️'}`);

      const passwordInput = page.locator('input[type="password"]');
      const passwordAutocomplete = await passwordInput.getAttribute('autocomplete');
      console.log(`Password autocomplete: ${passwordAutocomplete || 'MISSING ⚠️'}`);

      if (!emailAutocomplete) {
        console.log('⚠️  Email field should have autocomplete="email"');
      }
      if (!passwordAutocomplete) {
        console.log('⚠️  Password field should have autocomplete="current-password"');
      }

      console.log('✅ Autocomplete check complete');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy on marketing page', async ({ page }) => {
      console.log('📍 Checking heading hierarchy...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Get all headings
      const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements =>
        elements.map(el => ({
          tag: el.tagName,
          text: el.textContent?.substring(0, 50),
          visible: el.offsetParent !== null
        }))
      );

      console.log(`Found ${headings.length} heading(s):`);
      headings.forEach((h, i) => {
        console.log(`  ${i + 1}. ${h.tag}: "${h.text}" ${h.visible ? '' : '(hidden)'}`);
      });

      // Check for h1
      const h1Count = headings.filter(h => h.tag === 'H1' && h.visible).length;
      if (h1Count === 0) {
        console.log('❌ No visible H1 found - should have exactly one');
      } else if (h1Count === 1) {
        console.log('✓ Exactly one H1 found');
      } else {
        console.log(`⚠️  Multiple H1s found (${h1Count}) - should only have one`);
      }

      console.log('✅ Heading hierarchy check complete');
    });

    test('should have proper ARIA attributes on interactive elements', async ({ page }) => {
      console.log('📍 Checking ARIA attributes...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Check buttons
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      let buttonsWithoutText = 0;
      let buttonsWithoutLabel = 0;

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');

        if (!text?.trim() && !ariaLabel) {
          buttonsWithoutText++;
          buttonsWithoutLabel++;
        }
      }

      if (buttonsWithoutLabel > 0) {
        console.log(`⚠️  ${buttonsWithoutLabel} button(s) without text or aria-label`);
      } else {
        console.log('✓ All buttons have accessible labels');
      }

      // Check links
      const links = page.locator('a');
      const linkCount = await links.count();
      let linksWithoutText = 0;

      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i);
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');

        if (!text?.trim() && !ariaLabel) {
          linksWithoutText++;
        }
      }

      if (linksWithoutText > 0) {
        console.log(`⚠️  ${linksWithoutText} link(s) without text or aria-label`);
      } else {
        console.log('✓ All links have accessible labels');
      }

      console.log('✅ ARIA attributes check complete');
    });

    test('should have proper alt text on images', async ({ page }) => {
      console.log('📍 Checking image alt text...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      const images = page.locator('img');
      const imageCount = await images.count();
      console.log(`Found ${imageCount} image(s)`);

      let imagesWithoutAlt = 0;
      let decorativeImages = 0;

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const src = await img.getAttribute('src');

        if (alt === null) {
          imagesWithoutAlt++;
          console.log(`  ⚠️  Image ${i + 1} missing alt: ${src?.substring(0, 50)}`);
        } else if (alt === '') {
          decorativeImages++;
          console.log(`  ℹ️  Decorative image ${i + 1}: ${src?.substring(0, 50)}`);
        } else {
          console.log(`  ✓ Image ${i + 1}: "${alt}"`);
        }
      }

      if (imagesWithoutAlt > 0) {
        console.log(`❌ ${imagesWithoutAlt} image(s) missing alt attribute`);
      } else {
        console.log('✓ All images have alt attribute');
      }

      console.log('✅ Image alt text check complete');
    });

    test('should have sufficient color contrast', async ({ page }) => {
      console.log('📍 Checking color contrast (visual inspection)...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Take screenshots for manual contrast checking
      await page.screenshot({ path: 'test-results/contrast-check-full.png', fullPage: true });

      // Screenshot specific sections
      const hero = page.locator('section').first();
      if (await hero.count() > 0) {
        await hero.screenshot({ path: 'test-results/contrast-check-hero.png' });
      }

      console.log('ℹ️  Manual contrast check required - screenshots saved');
      console.log('   - Text should have at least 4.5:1 contrast ratio');
      console.log('   - Large text should have at least 3:1 contrast ratio');
      console.log('✅ Contrast screenshots saved');
    });

    test('should be keyboard navigable', async ({ page }) => {
      console.log('📍 Testing keyboard navigation...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Tab through the page
      const focusableElements = [];
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el?.tagName,
            text: el?.textContent?.substring(0, 30),
            role: el?.getAttribute('role'),
            type: el?.getAttribute('type')
          };
        });

        focusableElements.push(focusedElement);
        console.log(`  Tab ${i + 1}: ${focusedElement.tag} - "${focusedElement.text}"`);
      }

      await page.screenshot({ path: 'test-results/keyboard-navigation.png' });
      console.log('✅ Keyboard navigation test complete');
    });
  });

  test.describe('Responsive Design Issues', () => {
    test('should check for horizontal scrollbars on mobile', async ({ page }) => {
      console.log('📍 Checking for horizontal overflow on mobile...');

      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      const hasHorizontalScrollbar = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (hasHorizontalScrollbar) {
        console.log('⚠️  Horizontal scrollbar detected on mobile viewport');

        // Find elements causing overflow
        const overflowElements = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          return elements
            .filter(el => el.scrollWidth > el.clientWidth)
            .map(el => ({
              tag: el.tagName,
              class: el.className,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth
            }))
            .slice(0, 5);
        });

        console.log('  Elements causing overflow:');
        overflowElements.forEach((el, i) => {
          console.log(`    ${i + 1}. ${el.tag}.${el.class}: ${el.scrollWidth}px > ${el.clientWidth}px`);
        });
      } else {
        console.log('✓ No horizontal overflow on mobile');
      }

      await page.screenshot({ path: 'test-results/mobile-overflow-check.png', fullPage: true });
      console.log('✅ Mobile overflow check complete');
    });

    test('should check touch target sizes on mobile', async ({ page }) => {
      console.log('📍 Checking touch target sizes...');

      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      const smallTargets = await page.evaluate(() => {
        const MIN_SIZE = 44; // Recommended minimum touch target size
        const clickable = Array.from(document.querySelectorAll('button, a, input, select, textarea'));

        return clickable
          .map(el => {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              text: el.textContent?.substring(0, 30),
              width: rect.width,
              height: rect.height,
              isTooSmall: rect.width < MIN_SIZE || rect.height < MIN_SIZE,
              visible: rect.width > 0 && rect.height > 0
            };
          })
          .filter(item => item.visible && item.isTooSmall);
      });

      if (smallTargets.length > 0) {
        console.log(`⚠️  ${smallTargets.length} touch target(s) smaller than 44x44px:`);
        smallTargets.slice(0, 10).forEach((target, i) => {
          console.log(`    ${i + 1}. ${target.tag}: ${Math.round(target.width)}x${Math.round(target.height)}px - "${target.text}"`);
        });
      } else {
        console.log('✓ All touch targets are adequately sized');
      }

      console.log('✅ Touch target size check complete');
    });
  });

  test.describe('Error States', () => {
    test('should display form validation errors', async ({ page }) => {
      console.log('📍 Testing form error display...');

      await page.goto(`${baseUrl}/auth/signin`);
      await page.waitForLoadState('networkidle');

      // Fill invalid email
      await page.locator('input[type="email"]').fill('invalid-email');
      await page.locator('input[type="password"]').fill('pass');
      await page.locator('button[type="submit"]').click();

      await page.waitForTimeout(500);

      // Take screenshot of error state
      await page.screenshot({ path: 'test-results/form-error-state.png' });

      console.log('✅ Form error state captured');
    });

    test('should have visible focus states', async ({ page }) => {
      console.log('📍 Checking focus states...');

      await page.goto(`${baseUrl}/auth/signin`);
      await page.waitForLoadState('networkidle');

      // Focus on email input
      await page.locator('input[type="email"]').focus();
      await page.screenshot({ path: 'test-results/focus-state-input.png' });

      // Focus on button
      await page.locator('button[type="submit"]').focus();
      await page.screenshot({ path: 'test-results/focus-state-button.png' });

      console.log('✅ Focus states captured for manual review');
      console.log('   - Check that focused elements have visible outline or border');
    });
  });

  test.describe('Content Issues', () => {
    test('should check for empty links', async ({ page }) => {
      console.log('📍 Checking for empty links...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      const emptyLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .filter(link => !link.textContent?.trim() && !link.querySelector('img'))
          .map(link => ({
            href: link.getAttribute('href'),
            aria: link.getAttribute('aria-label')
          }));
      });

      if (emptyLinks.length > 0) {
        console.log(`⚠️  Found ${emptyLinks.length} empty link(s):`);
        emptyLinks.forEach((link, i) => {
          console.log(`    ${i + 1}. href="${link.href}" aria-label="${link.aria || 'none'}"`);
        });
      } else {
        console.log('✓ No empty links found');
      }

      console.log('✅ Empty links check complete');
    });

    test('should check for broken internal links', async ({ page }) => {
      console.log('📍 Checking internal links...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      const internalLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href^="/"]'))
          .map(link => link.getAttribute('href'))
          .filter((href, index, self) => href && self.indexOf(href) === index)
          .slice(0, 20); // Limit to first 20 unique links
      });

      console.log(`Found ${internalLinks.length} unique internal link(s) to test:`);

      for (const href of internalLinks) {
        const response = await page.goto(`${baseUrl}${href}`);
        const status = response?.status() || 0;

        if (status >= 400) {
          console.log(`  ❌ ${href} - HTTP ${status}`);
        } else if (status >= 300) {
          console.log(`  ⚠️  ${href} - Redirect (${status})`);
        } else {
          console.log(`  ✓ ${href} - OK (${status})`);
        }
      }

      console.log('✅ Internal links check complete');
    });
  });

  test.describe('Performance', () => {
    test('should measure Core Web Vitals', async ({ page }) => {
      console.log('📍 Measuring Core Web Vitals...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const perfEntries = performance.getEntriesByType('navigation')[0] as any;

          // Get basic timing metrics
          const timing = {
            domContentLoaded: perfEntries.domContentLoadedEventEnd - perfEntries.domContentLoadedEventStart,
            loadComplete: perfEntries.loadEventEnd - perfEntries.loadEventStart,
            domInteractive: perfEntries.domInteractive - perfEntries.fetchStart,
            firstPaint: 0,
            firstContentfulPaint: 0
          };

          // Try to get paint metrics
          const paintEntries = performance.getEntriesByType('paint');
          paintEntries.forEach(entry => {
            if (entry.name === 'first-paint') {
              timing.firstPaint = entry.startTime;
            }
            if (entry.name === 'first-contentful-paint') {
              timing.firstContentfulPaint = entry.startTime;
            }
          });

          resolve(timing);
        });
      });

      console.log('Performance Metrics:');
      console.log(`  DOM Interactive: ${Math.round(metrics.domInteractive)}ms`);
      console.log(`  DOM Content Loaded: ${Math.round(metrics.domContentLoaded)}ms`);
      console.log(`  First Paint: ${Math.round(metrics.firstPaint)}ms`);
      console.log(`  First Contentful Paint: ${Math.round(metrics.firstContentfulPaint)}ms`);
      console.log(`  Load Complete: ${Math.round(metrics.loadComplete)}ms`);

      // Recommendations
      if (metrics.firstContentfulPaint > 2500) {
        console.log('⚠️  First Contentful Paint is slow (>2.5s)');
      } else if (metrics.firstContentfulPaint > 1800) {
        console.log('ℹ️  First Contentful Paint could be improved (>1.8s)');
      } else {
        console.log('✓ First Contentful Paint is good (<1.8s)');
      }

      console.log('✅ Performance metrics captured');
    });

    test('should check for large images', async ({ page }) => {
      console.log('📍 Checking image sizes...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      const images = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img'))
          .map(img => ({
            src: img.src.substring(0, 80),
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            displayWidth: img.width,
            displayHeight: img.height,
            oversized: img.naturalWidth > img.width * 2 || img.naturalHeight > img.height * 2
          }));
      });

      const oversizedImages = images.filter(img => img.oversized);

      if (oversizedImages.length > 0) {
        console.log(`⚠️  ${oversizedImages.length} oversized image(s) found:`);
        oversizedImages.forEach((img, i) => {
          console.log(`    ${i + 1}. ${img.naturalWidth}x${img.naturalHeight} displayed at ${img.displayWidth}x${img.displayHeight}`);
          console.log(`       ${img.src}`);
        });
      } else {
        console.log('✓ No oversized images found');
      }

      console.log('✅ Image size check complete');
    });
  });
});
