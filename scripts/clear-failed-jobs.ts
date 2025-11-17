/**
 * Clear failed jobs from the queue
 */

import { pdfProcessingQueue } from '../src/lib/queue';

async function main() {
  console.log('Clearing failed jobs from queue...\n');

  // Get all failed jobs
  const failedJobs = await pdfProcessingQueue.getFailed();
  console.log(`Found ${failedJobs.length} failed jobs`);

  // Remove each failed job
  for (const job of failedJobs) {
    console.log(`Removing job ${job.id}: ${job.data.filename}`);
    await job.remove();
  }

  console.log('\nAll failed jobs cleared');

  await pdfProcessingQueue.close();
  process.exit(0);
}

main().catch(console.error);
