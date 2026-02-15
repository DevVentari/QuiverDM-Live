import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';

const queue = new Queue('pdf-processing', {
  connection: { host: 'localhost', port: 6380, maxRetriesPerRequest: null },
});
const prisma = new PrismaClient();

async function main() {
  // Clean all jobs from the queue
  await queue.obliterate({ force: true });
  console.log('Queue obliterated (all jobs removed)');

  // Reset or delete the test PDF
  const pdfId = process.argv[2];
  if (pdfId) {
    try {
      await prisma.homebrewPDF.delete({ where: { id: pdfId } });
      console.log('Deleted PDF:', pdfId);
    } catch {
      console.log('PDF not found:', pdfId);
    }
  }

  // Check workers
  const workers = await queue.getWorkers();
  console.log('Workers after cleanup:', workers.length);

  await queue.close();
  await prisma.$disconnect();
}

main().catch(console.error);
