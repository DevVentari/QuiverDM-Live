/**
 * Check queue stats and job status
 */

import { getQueueStats, getPDFProcessingJobStatus } from '../src/lib/queue.js';

async function main() {
  console.log('Queue Stats:');
  const stats = await getQueueStats();
  console.log(JSON.stringify(stats, null, 2));

  console.log('\nMonster Loot PDF Job (cmi00tudz000310nmd5bcl1qn):');
  const jobStatus = await getPDFProcessingJobStatus('cmi00tudz000310nmd5bcl1qn');
  console.log(JSON.stringify(jobStatus, null, 2));

  process.exit(0);
}

main().catch(console.error);
