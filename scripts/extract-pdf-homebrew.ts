/**
 * Trigger AI extraction on a processed PDF to extract homebrew content.
 * Calls the same logic as the tRPC extractContent endpoint.
 *
 * Run: npx tsx scripts/extract-pdf-homebrew.ts
 */
import { PrismaClient } from '@prisma/client';
import { extractWithFallback } from '../src/lib/ai/extraction';
import { saveExtractedContent } from '../src/server/repositories/homebrew-extraction.repository';

const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const PDF_ID = 'cmn1qpl270001qo8xaxfh82u5';
const USER_ID = 'cmmqlqy1o0001co5m5wf4efj7';

const p = new PrismaClient({ datasources: { db: { url: DB } } });

(async () => {
  const pdf = await p.homebrewPDF.findFirst({
    where: { id: PDF_ID },
    select: { id: true, filename: true, markdownContent: true, aiExtractionStatus: true, campaignId: true },
  });

  if (!pdf) throw new Error('PDF not found');
  if (!pdf.markdownContent) throw new Error('No markdown content — PDF not yet processed');

  console.log(`Extracting from: ${pdf.filename}`);
  console.log(`Markdown length: ${pdf.markdownContent.length} chars`);
  console.log(`Campaign: ${pdf.campaignId}`);

  await p.homebrewPDF.update({
    where: { id: PDF_ID },
    data: { aiExtractionStatus: 'processing', aiExtractionProgress: { chunk: 0, totalChunks: 0, itemsFound: 0, byType: {} } },
  });

  let lastReport = Date.now();
  const onChunkProgress = async (chunk: number, totalChunks: number, itemsFound: number, byType: Record<string, number>) => {
    await p.homebrewPDF.update({
      where: { id: PDF_ID },
      data: { aiExtractionProgress: { chunk, totalChunks, itemsFound, byType } },
    }).catch(() => {});
    const now = Date.now();
    if (now - lastReport > 5000) {
      console.log(`  Progress: chunk ${chunk}/${totalChunks}, ${itemsFound} items found`, JSON.stringify(byType));
      lastReport = now;
    }
  };

  console.log('Starting AI extraction...');
  const result = await extractWithFallback(
    pdf.markdownContent,
    undefined,
    undefined,
    USER_ID,
    onChunkProgress
  );

  if (!result.success) {
    await p.homebrewPDF.update({ where: { id: PDF_ID }, data: { aiExtractionStatus: 'error' } });
    throw new Error('Extraction failed: ' + result.error);
  }

  console.log(`Extracted ${result.items.length} items`);
  const byType: Record<string, number> = {};
  for (const item of result.items) {
    byType[item.type] = (byType[item.type] || 0) + 1;
  }
  console.log('By type:', JSON.stringify(byType));

  if (result.items.length > 0) {
    // Pass prod DB client explicitly — saveExtractedContent defaults to local prisma otherwise
    await saveExtractedContent(result.items, USER_ID, PDF_ID, pdf.campaignId, p as any);
    console.log('Saved to DB');
  }

  await p.homebrewPDF.update({
    where: { id: PDF_ID },
    data: {
      aiExtractionStatus: 'done',
      aiExtractionProgress: { chunk: 0, totalChunks: 0, itemsFound: result.items.length, byType },
    },
  });

  console.log('\nDone.');
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
