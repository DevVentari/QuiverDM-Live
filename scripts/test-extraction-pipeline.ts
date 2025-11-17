/**
 * Test Script for PDF → Markdown → Ollama Extraction Pipeline
 *
 * Tests the complete flow:
 * 1. Load markdown from a processed PDF
 * 2. Parse into sections
 * 3. Extract structured D&D content with Ollama
 * 4. Validate against Zod schemas
 * 5. Display results
 */

import { parseMarkdown, getSectionsByType, generateSummary, formatSectionForOllama } from '../src/lib/markdown-parser';
import { extractContent, extractBatch, testOllama } from '../src/lib/ollama-extraction';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('PDF → Markdown → Ollama Extraction Pipeline Test');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Test Ollama connectivity
  console.log('Step 1: Testing Ollama connectivity...');
  const ollamaTest = await testOllama();

  if (!ollamaTest.available) {
    console.error('❌ Ollama is not available!');
    console.error('   Error:', ollamaTest.error);
    console.error('');
    console.error('   Please ensure Ollama is running:');
    console.error('   1. Install Ollama from https://ollama.ai');
    console.error('   2. Start Ollama service');
    console.error('   3. Pull the model: ollama pull qwen2.5:14b');
    process.exit(1);
  }

  if (!ollamaTest.modelLoaded) {
    console.error('❌ Model qwen2.5:14b is not available!');
    console.error('   Error:', ollamaTest.error);
    console.error('');
    console.error('   Please pull the model:');
    console.error('   ollama pull qwen2.5:14b');
    process.exit(1);
  }

  console.log('✅ Ollama is ready with qwen2.5:14b');
  console.log();

  // Step 2: Find a processed PDF
  console.log('Step 2: Finding processed PDFs...');
  const processedPdfs = await prisma.homebrewPDF.findMany({
    where: {
      processingStatus: 'completed',
      markdownContent: { not: null },
    },
    orderBy: { processingEndedAt: 'desc' },
    take: 1,
  });

  if (processedPdfs.length === 0) {
    console.error('❌ No processed PDFs found!');
    console.error('');
    console.error('   Please upload and process a PDF first:');
    console.error('   1. Go to http://localhost:3000/campaigns/[your-campaign]/homebrew');
    console.error('   2. Upload a D&D PDF');
    console.error('   3. Wait for processing to complete');
    process.exit(1);
  }

  const pdf = processedPdfs[0];
  console.log(`✅ Found processed PDF: ${pdf.filename}`);
  console.log(`   Pages: ${(pdf.markerMetadata as any)?.pages || 'unknown'}`);
  console.log(`   Markdown length: ${pdf.markdownContent?.length || 0} characters`);
  console.log();

  // Step 3: Parse markdown
  console.log('Step 3: Parsing markdown into sections...');
  const parsed = parseMarkdown(pdf.markdownContent!);

  console.log('✅ Markdown parsed successfully!');
  console.log();
  console.log(generateSummary(parsed));
  console.log();

  // Step 4: Extract sections by type
  const spells = getSectionsByType(parsed.sections, 'spell');
  const items = getSectionsByType(parsed.sections, 'item');
  const monsters = getSectionsByType(parsed.sections, 'monster');

  console.log('Step 4: Content breakdown:');
  console.log(`   Spells: ${spells.length}`);
  console.log(`   Items: ${items.length}`);
  console.log(`   Monsters: ${monsters.length}`);
  console.log();

  // Step 5: Test single extraction
  if (spells.length > 0) {
    console.log('Step 5: Testing single spell extraction...');
    console.log(`   Extracting: "${spells[0].title}"`);
    console.log();

    const startTime = Date.now();
    const extracted = await extractContent(spells[0], {
      onProgress: (current, total, section) => {
        console.log(`   Progress: ${current}/${total} - ${section}`);
      },
    });
    const extractionTime = Date.now() - startTime;

    if (extracted) {
      console.log(`✅ Extraction successful! (${extractionTime}ms)`);
      console.log();
      console.log('Extracted data:');
      console.log(JSON.stringify(extracted, null, 2));
      console.log();
    } else {
      console.log('❌ Extraction failed!');
      console.log();
    }
  }

  // Step 6: Test batch extraction
  const testSections = [...spells.slice(0, 2), ...items.slice(0, 2), ...monsters.slice(0, 1)].filter(Boolean);

  if (testSections.length > 0) {
    console.log(`Step 6: Testing batch extraction (${testSections.length} sections)...`);
    console.log();

    const batchResult = await extractBatch(testSections, {
      batchSize: 2,
      onProgress: (current, total, section) => {
        console.log(`   Progress: ${current}/${total} - ${section}`);
      },
    });

    console.log();
    console.log('Batch Extraction Results:');
    console.log(`   Total sections: ${batchResult.metadata.totalSections}`);
    console.log(`   Successful: ${batchResult.metadata.successfulExtractions}`);
    console.log(`   Failed: ${batchResult.metadata.failedExtractions}`);
    console.log(`   Processing time: ${(batchResult.metadata.processingTime / 1000).toFixed(1)}s`);
    console.log(`   Average per section: ${(batchResult.metadata.processingTime / batchResult.metadata.totalSections / 1000).toFixed(1)}s`);
    console.log();

    if (batchResult.errors.length > 0) {
      console.log('Errors:');
      batchResult.errors.forEach(error => {
        console.log(`   ❌ ${error.section}: ${error.error}`);
      });
      console.log();
    }

    if (batchResult.items.length > 0) {
      console.log('Successfully extracted items:');
      batchResult.items.forEach((item, idx) => {
        const name = (item.data as any).name || 'Unknown';
        console.log(`   ${idx + 1}. [${item.type}] ${name}`);
      });
      console.log();

      // Save results to file
      const outputPath = path.join(process.cwd(), 'test-extraction-results.json');
      await fs.writeFile(outputPath, JSON.stringify(batchResult, null, 2));
      console.log(`   Results saved to: ${outputPath}`);
      console.log();
    }
  }

  // Summary
  console.log('='.repeat(80));
  console.log('Pipeline Test Complete!');
  console.log('='.repeat(80));
  console.log();
  console.log('Next steps:');
  console.log('1. Review the extracted data in test-extraction-results.json');
  console.log('2. Adjust prompts in ollama-extraction.ts if needed');
  console.log('3. Process all sections for full PDF extraction');
  console.log('4. Save extracted content to database');
  console.log();
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
