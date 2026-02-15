import { Queue } from 'bullmq';

const queue = new Queue('pdf-processing', {
  connection: { host: 'localhost', port: 6380, maxRetriesPerRequest: null },
});

async function main() {
  const workers = await queue.getWorkers();
  console.log('Active workers:', workers.length);
  for (const w of workers) {
    console.log('  Worker:', w.id, w.name, 'age:', w.age);
  }

  const job = await queue.getJob('cmllzw7i500015zmt3h7vjnla');
  if (job) {
    const state = await job.getState();
    console.log('Job state:', state);
    console.log('Job progress:', job.progress);
    console.log('Job attempts:', job.attemptsMade);
    console.log('Job failedReason:', job.failedReason?.substring(0, 200));
  } else {
    console.log('Job not found in queue');
  }

  // Check for waiting/active jobs
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const failed = await queue.getFailedCount();
  console.log('Queue: waiting:', waiting, 'active:', active, 'failed:', failed);

  await queue.close();
}

main().catch(console.error);
