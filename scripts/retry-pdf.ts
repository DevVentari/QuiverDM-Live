/**
 * Retry a failed PDF processing job
 */

import { prisma } from '../src/server/db';
import { addPDFProcessingJob } from '../src/lib/queue';

async function main() {
  const pdfId = 'cmhyssl800001jag5dm5wqkyr';

  // Get the PDF from database
  const pdf = await prisma.homebrewPDF.findUnique({
    where: { id: pdfId },
  });

  if (!pdf) {
    console.error(`PDF ${pdfId} not found`);
    process.exit(1);
  }

  console.log(`Retrying PDF: ${pdf.filename}`);
  console.log(`Current status: ${pdf.processingStatus}`);

  // Reset the status to pending
  await prisma.homebrewPDF.update({
    where: { id: pdfId },
    data: {
      processingStatus: 'pending',
      errorMessage: null,
      processingStartedAt: null,
      processingEndedAt: null,
    },
  });

  console.log('Status reset to pending');

  // Extract the r2Key from the r2Url
  const r2Key = pdf.r2Url?.replace('local://', '') || '';

  // Add new job to queue
  await addPDFProcessingJob({
    pdfId: pdf.id,
    userId: pdf.userId,
    campaignId: pdf.campaignId || '',
    r2Key,
    filename: pdf.filename,
    options: {
      useLLM: pdf.useLLM,
    },
  });

  console.log('Job re-queued successfully');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(console.error);
