/**
 * Sync completed job results to the database
 * This fixes PDFs that were processed but database wasn't updated
 */

import { getPDFProcessingJobStatus } from '../src/lib/queue.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('Finding pending PDFs that have completed jobs...');

  const pendingPDFs = await prisma.homebrewPDF.findMany({
    where: { processingStatus: 'pending' }
  });

  console.log(`Found ${pendingPDFs.length} pending PDFs`);

  for (const pdf of pendingPDFs) {
    console.log(`\nChecking: ${pdf.filename}`);
    console.log(`  ID: ${pdf.id}`);

    const jobStatus = await getPDFProcessingJobStatus(pdf.id);

    if (!jobStatus) {
      console.log(`  ❌ No job found in queue`);
      continue;
    }

    console.log(`  Job state: ${jobStatus.state}`);

    if (jobStatus.state === 'completed' && jobStatus.returnvalue?.success) {
      console.log(`  ✅ Job completed but DB not updated!`);
      console.log(`  Syncing to database...`);

      const result = jobStatus.returnvalue;
      const markdownLength = result.markdownContent?.length || 0;

      // Update the database with the job results
      await prisma.homebrewPDF.update({
        where: { id: pdf.id },
        data: {
          processingStatus: 'completed',
          markerProcessed: true,
          markdownContent: result.markdownContent || null,
          markerMetadata: result.metadata || { llmUsed: false },
          processingEndedAt: jobStatus.finishedOn ? new Date(jobStatus.finishedOn) : new Date(),
        },
      });

      console.log(`  ✅ Database updated!`);
      console.log(`  Markdown length: ${markdownLength} characters`);
    } else if (jobStatus.state === 'failed') {
      console.log(`  ❌ Job failed: ${jobStatus.failedReason}`);
    } else {
      console.log(`  ⏳ Job still ${jobStatus.state}`);
    }
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(console.error);
