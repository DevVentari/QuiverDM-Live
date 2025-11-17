import { PrismaClient } from '@prisma/client';
import { addPDFProcessingJob, cancelPDFProcessingJob } from '../src/lib/queue';

const prisma = new PrismaClient();

async function reprocessPdf() {
  const pdfId = process.argv[2] || 'cmi2j3pct000lxono241dx0rc';

  // Get the PDF data
  const pdf = await prisma.homebrewPDF.findUnique({
    where: { id: pdfId }
  });

  if (!pdf) {
    console.error(`PDF not found: ${pdfId}`);
    process.exit(1);
  }

  console.log('Found PDF:', pdf.id);
  console.log('Filename:', pdf.filename);
  console.log('Current status:', pdf.processingStatus);

  // First, remove any existing job from the queue
  console.log('\nRemoving existing job from queue...');
  const removed = await cancelPDFProcessingJob(pdfId);
  console.log('Removed:', removed);

  // Reset the PDF status
  const updatedPdf = await prisma.homebrewPDF.update({
    where: { id: pdfId },
    data: {
      processingStatus: 'pending',
      errorMessage: null,
      processingStartedAt: null,
      processingEndedAt: null
    }
  });

  console.log('\nReset PDF status to pending');

  // Extract r2Key from the URL
  // URL format: http://localhost:3000/api/storage/homebrew-pdfs/userId/timestamp-filename.pdf
  const r2Key = pdf.r2Url.replace(/^.*\/api\/storage\//, '').replace(/^.*\/local-storage\//, '');
  console.log('r2Key:', r2Key);

  // Add to queue using the proper helper function with full data structure
  const job = await addPDFProcessingJob({
    pdfId: pdf.id,
    userId: pdf.userId,
    campaignId: pdf.campaignId || '',
    r2Key: r2Key,
    filename: pdf.filename,
    options: {
      useLLM: false,  // Don't use expensive Marker LLM vision
      useAIExtraction: true,  // Use AI to extract D&D content
      llmProvider: 'openai'
    }
  });

  console.log('\nAdded PDF to queue for reprocessing with OpenAI extraction');
  console.log('Job ID:', job.id);
  console.log('Job name:', job.name);

  // Wait a moment for the job to be fully committed to Redis
  await new Promise(resolve => setTimeout(resolve, 2000));

  await prisma.$disconnect();
  console.log('\nDone! Worker should pick up the job now.');
  process.exit(0);
}

reprocessPdf().catch(console.error);
