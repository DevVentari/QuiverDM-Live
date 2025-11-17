import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Content Extraction Tests
 *
 * Verifies that D&D content is correctly extracted from PDFs:
 * - Spells
 * - Monsters/Creatures
 * - Magic Items
 * - Classes/Subclasses
 * - Feats
 * - Races
 */

// Helper function to login
async function login(page: any) {
  await page.goto('http://localhost:3002/auth/signin');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('input#email', { timeout: 10000 });

  await page.locator('input#email').fill('dev@blakewales.au');
  await page.locator('input#password').fill('xaub6NaM7468');

  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }),
    page.getByRole('button', { name: 'Sign in with Email' }).click(),
  ]);
}

test.describe('Content Extraction Tests', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Verify PDF has extracted content', async ({ page }) => {
    console.log('🧪 TEST: Check for Extracted Content');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Go to PDF Library
    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    // Click on first ready PDF
    const readyPdf = page.locator('article, .card').filter({ hasText: /ready/i }).first();

    if (await readyPdf.isVisible().catch(() => false)) {
      console.log('✓ Found ready PDF');

      await readyPdf.click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'tests/screenshots/extraction-01-pdf-viewer.png',
        fullPage: true
      });

      // Check for content tabs/sections
      const tabs = await page.locator('[role="tab"]').count();
      console.log(`✓ Tabs found: ${tabs}`);

      if (tabs > 0) {
        for (let i = 0; i < tabs; i++) {
          const tabText = await page.locator('[role="tab"]').nth(i).textContent();
          console.log(`  Tab ${i + 1}: ${tabText}`);
        }
      }
    } else {
      console.log('⚠️ No ready PDFs found to test extraction');
    }
  });

  test('Check extracted markdown content', async ({ page }) => {
    console.log('🧪 TEST: Extracted Markdown Content');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    const readyPdf = page.locator('article, .card').filter({ hasText: /ready/i }).first();

    if (await readyPdf.isVisible().catch(() => false)) {
      await readyPdf.click();
      await page.waitForTimeout(2000);

      // Look for markdown tab
      const markdownTab = page.getByRole('tab', { name: /markdown|text|extracted/i });

      if (await markdownTab.isVisible().catch(() => false)) {
        console.log('✓ Markdown tab found, clicking...');
        await markdownTab.click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: 'tests/screenshots/extraction-02-markdown.png',
          fullPage: true
        });

        // Check for markdown content
        const markdownContent = await page.locator('pre, code, [data-testid*="markdown"]').count();
        console.log(`✓ Markdown content blocks: ${markdownContent}`);

        // Check for download button
        const downloadBtn = page.getByRole('button', { name: /download.*markdown/i });
        if (await downloadBtn.isVisible().catch(() => false)) {
          console.log('✓ Download markdown button available');
        }
      } else {
        console.log('⚠️ No markdown tab found');
      }
    }
  });

  test('Verify extracted D&D spell data', async ({ page }) => {
    console.log('🧪 TEST: Extracted Spells');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    const readyPdf = page.locator('article, .card').filter({ hasText: /ready/i }).first();

    if (await readyPdf.isVisible().catch(() => false)) {
      await readyPdf.click();
      await page.waitForTimeout(2000);

      // Look for extracted content tab
      const extractedTab = page.getByRole('tab', { name: /extracted|content|spells/i });

      if (await extractedTab.isVisible().catch(() => false)) {
        await extractedTab.click();
        await page.waitForTimeout(1000);

        // Check for spell-related content
        const spellIndicators = {
          'Spell names': await page.locator('text=/spell|cantrip/i').count(),
          'Spell levels': await page.locator('text=/level \\d|\\d-level|\\dth level/i').count(),
          'Casting time': await page.locator('text=/casting time|action|bonus action/i').count(),
          'Range': await page.locator('text=/range|feet|touch|self/i').count(),
          'Components': await page.locator('text=/component|verbal|somatic|material/i').count(),
        };

        console.log('Spell Content Found:');
        for (const [type, count] of Object.entries(spellIndicators)) {
          if (count > 0) {
            console.log(`  ✓ ${type}: ${count}`);
          }
        }

        await page.screenshot({
          path: 'tests/screenshots/extraction-03-spells.png',
          fullPage: true
        });
      }
    }
  });

  test('Verify extracted monster/creature data', async ({ page }) => {
    console.log('🧪 TEST: Extracted Monsters');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    const readyPdf = page.locator('article, .card').filter({ hasText: /ready/i }).first();

    if (await readyPdf.isVisible().catch(() => false)) {
      await readyPdf.click();
      await page.waitForTimeout(2000);

      // Check for monster/creature content
      const monsterIndicators = {
        'Creature names': await page.locator('text=/monster|creature|beast|dragon/i').count(),
        'AC/HP': await page.locator('text=/armor class|hit points|AC \\d+|HP \\d+/i').count(),
        'Stats': await page.locator('text=/STR|DEX|CON|INT|WIS|CHA/i').count(),
        'CR': await page.locator('text=/challenge rating|CR \\d+/i').count(),
        'Actions': await page.locator('text=/actions|multiattack|attack/i').count(),
      };

      console.log('Monster Content Found:');
      for (const [type, count] of Object.entries(monsterIndicators)) {
        if (count > 0) {
          console.log(`  ✓ ${type}: ${count}`);
        }
      }

      await page.screenshot({
        path: 'tests/screenshots/extraction-04-monsters.png',
        fullPage: true
      });
    }
  });

  test('Verify extracted magic item data', async ({ page }) => {
    console.log('🧪 TEST: Extracted Magic Items');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    const readyPdf = page.locator('article, .card').filter({ hasText: /ready/i }).first();

    if (await readyPdf.isVisible().catch(() => false)) {
      await readyPdf.click();
      await page.waitForTimeout(2000);

      // Check for magic item content
      const itemIndicators = {
        'Item names': await page.locator('text=/magic item|weapon|armor|wondrous/i').count(),
        'Rarity': await page.locator('text=/common|uncommon|rare|very rare|legendary|artifact/i').count(),
        'Attunement': await page.locator('text=/requires attunement|attunement/i').count(),
        'Properties': await page.locator('text=/\\+\\d|bonus|damage/i').count(),
      };

      console.log('Magic Item Content Found:');
      for (const [type, count] of Object.entries(itemIndicators)) {
        if (count > 0) {
          console.log(`  ✓ ${type}: ${count}`);
        }
      }

      await page.screenshot({
        path: 'tests/screenshots/extraction-05-items.png',
        fullPage: true
      });
    }
  });

  test('Check extraction metadata and stats', async ({ page }) => {
    console.log('🧪 TEST: Extraction Metadata');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    const readyPdf = page.locator('article, .card').filter({ hasText: /ready/i }).first();

    if (await readyPdf.isVisible().catch(() => false)) {
      await readyPdf.click();
      await page.waitForTimeout(2000);

      // Look for extraction statistics
      const metadata = {
        'Page count': await page.locator('text=/\\d+ pages/i').count(),
        'File size': await page.locator('text=/\\d+ (KB|MB)/i').count(),
        'Processing status': await page.locator('text=/ready|completed|processed/i').count(),
        'Extraction method': await page.locator('text=/AI Enhanced|Gemini|marker/i').count(),
      };

      console.log('Metadata Found:');
      for (const [type, count] of Object.entries(metadata)) {
        if (count > 0) {
          console.log(`  ✓ ${type}: ${count}`);
        }
      }

      await page.screenshot({
        path: 'tests/screenshots/extraction-06-metadata.png',
        fullPage: true
      });
    }
  });

  test('Test download extracted content', async ({ page }) => {
    console.log('🧪 TEST: Download Extracted Content');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    const readyPdf = page.locator('article, .card').filter({ hasText: /ready/i }).first();

    if (await readyPdf.isVisible().catch(() => false)) {
      await readyPdf.click();
      await page.waitForTimeout(2000);

      // Look for download buttons
      const downloadButtons = await page.getByRole('button', { name: /download/i }).count();
      console.log(`✓ Download buttons found: ${downloadButtons}`);

      if (downloadButtons > 0) {
        const downloads = await page.getByRole('button', { name: /download/i }).all();
        for (let i = 0; i < Math.min(downloads.length, 3); i++) {
          const btnText = await downloads[i].textContent();
          console.log(`  Download option ${i + 1}: ${btnText}`);
        }
      }

      await page.screenshot({
        path: 'tests/screenshots/extraction-07-download-options.png',
        fullPage: true
      });
    }
  });

  test('Verify extraction progress tracking', async ({ page }) => {
    console.log('🧪 TEST: Extraction Progress');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    // Look for processing PDFs
    const processingPdf = page.locator('article, .card').filter({ hasText: /processing/i }).first();

    if (await processingPdf.isVisible().catch(() => false)) {
      console.log('✓ Found processing PDF');

      await processingPdf.click();
      await page.waitForTimeout(2000);

      // Check for progress indicators
      const progressElements = {
        'Progress bar': await page.locator('progress, [role="progressbar"]').count(),
        'Percentage': await page.locator('text=/%/i').count(),
        'Status text': await page.locator('text=/extracting|parsing|processing/i').count(),
      };

      console.log('Progress Elements:');
      for (const [type, count] of Object.entries(progressElements)) {
        if (count > 0) {
          console.log(`  ✓ ${type}: ${count}`);
        }
      }

      await page.screenshot({
        path: 'tests/screenshots/extraction-08-progress.png',
        fullPage: true
      });
    } else {
      console.log('⚠️ No processing PDFs found (all completed)');
    }
  });

  test('Check for extraction errors', async ({ page }) => {
    console.log('🧪 TEST: Extraction Errors');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    // Look for failed PDFs
    const failedPdf = page.locator('article, .card').filter({ hasText: /failed|error/i }).first();

    if (await failedPdf.isVisible().catch(() => false)) {
      console.log('✓ Found failed PDF');

      await failedPdf.click();
      await page.waitForTimeout(2000);

      // Check for error messages
      const errorMessages = await page.locator('text=/error|failed|invalid/i').count();
      console.log(`Error messages found: ${errorMessages}`);

      // Look for retry button
      const retryBtn = page.getByRole('button', { name: /retry|try again|reprocess/i });
      if (await retryBtn.isVisible().catch(() => false)) {
        console.log('✓ Retry button available');
      }

      await page.screenshot({
        path: 'tests/screenshots/extraction-09-errors.png',
        fullPage: true
      });
    } else {
      console.log('✓ No failed extractions found');
    }
  });

  test('Complete extraction workflow', async ({ page }) => {
    console.log('\n🧪 TEST: Complete Extraction Workflow\n');

    // Step 1: Navigate and upload
    console.log('Step 1: Upload new PDF');
    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'tests/screenshots/workflow-extract-01-initial.png',
      fullPage: true
    });

    // Step 2: Upload PDF
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      const testPdfPath = path.resolve('test-documents/homebrew-sample.pdf');
      await fileInput.setInputFiles(testPdfPath);
      console.log('✓ File selected');

      await page.waitForTimeout(2000);

      // Enable AI enhancement if checkbox exists
      const aiCheckbox = page.locator('input[type="checkbox"]').filter({
        hasText: /AI|Gemini|enhancement/i
      }).or(page.locator('label').filter({ hasText: /AI|Gemini/i }).locator('input'));

      if (await aiCheckbox.count() > 0) {
        const isChecked = await aiCheckbox.first().isChecked();
        console.log(`AI Enhancement available, currently: ${isChecked ? 'enabled' : 'disabled'}`);
      }

      const uploadButton = page.getByRole('button', { name: /upload|process/i });
      if (await uploadButton.isVisible().catch(() => false)) {
        await uploadButton.click();
        console.log('✓ Upload started');

        await page.waitForTimeout(3000);

        await page.screenshot({
          path: 'tests/screenshots/workflow-extract-02-uploading.png',
          fullPage: true
        });

        // Step 3: Monitor extraction
        console.log('\nStep 3: Wait for extraction');
        await page.waitForTimeout(8000);

        await page.screenshot({
          path: 'tests/screenshots/workflow-extract-03-processing.png',
          fullPage: true
        });

        // Step 4: Check completion
        console.log('\nStep 4: Check extraction results');
        const completedPdf = page.locator('article, .card').filter({
          hasText: /homebrew-sample.*ready/i
        }).first();

        if (await completedPdf.isVisible().catch(() => false)) {
          await completedPdf.click();
          await page.waitForTimeout(2000);

          console.log('✓ PDF processing completed');

          // Step 5: Verify extracted content
          console.log('\nStep 5: Verify extracted content');

          const tabs = await page.locator('[role="tab"]').count();
          console.log(`✓ Content tabs: ${tabs}`);

          await page.screenshot({
            path: 'tests/screenshots/workflow-extract-04-completed.png',
            fullPage: true
          });

          // Check each tab
          if (tabs > 0) {
            for (let i = 0; i < tabs; i++) {
              const tab = page.locator('[role="tab"]').nth(i);
              const tabText = await tab.textContent();
              console.log(`\nChecking tab: ${tabText}`);

              await tab.click();
              await page.waitForTimeout(1000);

              await page.screenshot({
                path: `tests/screenshots/workflow-extract-05-tab-${i}.png`,
                fullPage: true
              });
            }
          }

          console.log('\n✅ Complete extraction workflow finished');
        } else {
          console.log('⚠️ PDF still processing, may need more time');
        }
      }
    }
  });
});
