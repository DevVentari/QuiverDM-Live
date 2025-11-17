import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { extractContent } from '../src/lib/ai-extraction';
import { slugify } from '../src/lib/slugify';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const PDF_ID = 'cmi2j3pct000lxono241dx0rc';
const PDF_PATH = './local-storage/homebrew-pdfs/cmi28ityz00013w7dz43h2218/1763346710006-377346-EchidnaDesign-Honkonomicon_v_1_0.pdf';

async function extractHonkonomicon() {
  console.log('=== Direct Honkonomicon Extraction ===\n');

  // Get PDF info
  const pdf = await prisma.homebrewPDF.findUnique({
    where: { id: PDF_ID }
  });

  if (!pdf) {
    console.error('PDF not found');
    process.exit(1);
  }

  console.log('PDF:', pdf.filename);
  console.log('User:', pdf.userId);
  console.log('Campaign:', pdf.campaignId);
  console.log('');

  // Step 1: Convert PDF to Markdown using PyMuPDF fallback
  console.log('Step 1: Converting PDF to Markdown with PyMuPDF...');
  const tempMdPath = './temp/honkonomicon.md';

  const { stdout } = await execAsync(
    `python scripts/pdf_to_markdown_fallback.py "${PDF_PATH}" --output "${tempMdPath}" --json`
  );

  const pyResult = JSON.parse(stdout);
  if (!pyResult.success) {
    console.error('PyMuPDF failed:', pyResult.error);
    process.exit(1);
  }

  console.log(`✅ Converted ${pyResult.metadata.pages} pages`);
  console.log(`   Markdown: ${pyResult.markdown_length} characters\n`);

  // Read the markdown
  const markdown = await fs.readFile(tempMdPath, 'utf-8');

  // Step 2: Extract D&D content with Gemini (more reliable JSON)
  console.log('Step 2: Extracting D&D content with Gemini...');
  const result = await extractContent(markdown, 'gemini');
  if (!result.success) {
    console.error('Extraction failed:', result.error);
    process.exit(1);
  }
  const extractedItems = result.items;
  console.log(`✅ Extracted ${extractedItems.length} items (tokens: ${result.tokensUsed || 'N/A'})\n`);

  // Step 3: Save to database
  console.log('Step 3: Saving to database...');

  let saved = 0;
  let skipped = 0;

  for (const item of extractedItems) {
    // Check if already exists
    const existing = await prisma.homebrewContent.findFirst({
      where: {
        name: item.name,
        userId: pdf.userId,
        type: item.type.toLowerCase()
      }
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Create the content - match actual schema
    const description = typeof item.data?.description === 'string'
      ? item.data.description
      : (item.data ? JSON.stringify(item.data).slice(0, 500) : item.name);

    // Add source info to data
    const dataWithSource = {
      ...item.data,
      _source: pdf.filename,
      _sourcePDFId: PDF_ID
    };

    await prisma.homebrewContent.create({
      data: {
        name: item.name,
        type: item.type.toLowerCase(),
        data: dataWithSource,
        images: [],
        tags: [item.type.toLowerCase(), 'goose', 'honkonomicon'],
        searchText: `${item.name} ${description} ${pdf.filename}`,
        sourceType: 'pdf',
        userId: pdf.userId
      }
    });
    saved++;

    if (saved % 10 === 0) {
      console.log(`   Saved ${saved}/${extractedItems.length}...`);
    }
  }

  console.log(`✅ Saved ${saved} items (${skipped} skipped as duplicates)\n`);

  // Step 4: Update PDF status
  console.log('Step 4: Updating PDF status...');
  await prisma.homebrewPDF.update({
    where: { id: PDF_ID },
    data: {
      processingStatus: 'completed',
      errorMessage: null,
      extractedItemsCount: saved,
      processingEndedAt: new Date()
    }
  });
  console.log('✅ PDF marked as completed\n');

  // Summary
  console.log('=== Extraction Complete ===');
  console.log(`Total items extracted: ${extractedItems.length}`);
  console.log(`Items saved to database: ${saved}`);
  console.log(`Items skipped (duplicates): ${skipped}`);

  await prisma.$disconnect();
}

extractHonkonomicon().catch(console.error);
