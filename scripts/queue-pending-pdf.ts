/**
 * Queue a pending PDF for processing
 */

import { addPDFProcessingJob } from '../src/lib/queue.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('Finding pending PDFs...');

  const pendingPDFs = await prisma.homebrewPDF.findMany({
    where: { processingStatus: 'pending' }
  });

  console.log(`Found ${pendingPDFs.length} pending PDFs`);

  for (const pdf of pendingPDFs) {
    console.log(`\nQueuing: ${pdf.filename}`);
    console.log(`  ID: ${pdf.id}`);
    console.log(`  useLLM: ${pdf.useLLM}`);

    // Extract R2 key from URL
    let r2Key = '';
    if (pdf.r2Url.startsWith('/api/storage/')) {
      r2Key = pdf.r2Url.replace('/api/storage/', '');
    } else if (pdf.r2Url.startsWith('local://')) {
      r2Key = pdf.r2Url.replace('local://', '');
    } else {
      r2Key = pdf.r2Url.split('/').slice(-3).join('/');
    }

    console.log(`  R2 Key: ${r2Key}`);

    try {
      await addPDFProcessingJob({
        pdfId: pdf.id,
        userId: pdf.userId,
        campaignId: pdf.campaignId || '',
        r2Key,
        filename: pdf.filename,
        options: {
          useLLM: pdf.useLLM,
          llmProvider: 'gemini'
        }
      });

      console.log(`  ✅ Queued successfully!`);
    } catch (error: any) {
      console.error(`  ❌ Failed to queue:`, error.message);
    }
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(console.error);
