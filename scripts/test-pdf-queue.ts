/**
 * Test PDF Processing Job Queue
 *
 * Tests the BullMQ job queue system without actually processing PDFs
 */

import { addPDFProcessingJob, getPDFProcessingJobStatus, getQueueStats, pdfProcessingQueue } from '../src/lib/queue';
import { redis } from '../src/lib/queue';

async function testQueue() {
  console.log('🧪 Testing PDF Processing Job Queue\n');

  try {
    // Test 1: Check Redis connection
    console.log('1️⃣ Testing Redis connection...');
    await redis.ping();
    console.log('   ✅ Redis connected successfully\n');

    // Test 2: Get initial queue stats
    console.log('2️⃣ Getting initial queue stats...');
    const initialStats = await getQueueStats();
    console.log('   📊 Initial stats:', initialStats);
    console.log('');

    // Test 3: Add a test job
    console.log('3️⃣ Adding test job to queue...');
    const testJob = await addPDFProcessingJob({
      pdfId: `test-${Date.now()}`,
      userId: 'test-user',
      campaignId: 'test-campaign',
      r2Key: 'test-pdfs/test.pdf',
      filename: 'test.pdf',
      options: {
        useLLM: false,
      },
    });

    console.log('   ✅ Job added successfully');
    console.log('   📝 Job ID:', testJob.id);
    console.log('   📝 Job Name:', testJob.name);
    console.log('');

    // Test 4: Get job status
    console.log('4️⃣ Getting job status...');
    const status = await getPDFProcessingJobStatus(testJob.id as string);
    console.log('   📊 Job status:', {
      id: status?.id,
      state: status?.state,
      progress: status?.progress,
      attemptsMade: status?.attemptsMade,
    });
    console.log('');

    // Test 5: Get updated queue stats
    console.log('5️⃣ Getting updated queue stats...');
    const updatedStats = await getQueueStats();
    console.log('   📊 Updated stats:', updatedStats);
    console.log('');

    // Test 6: Remove test job (cleanup)
    console.log('6️⃣ Cleaning up test job...');
    const job = await pdfProcessingQueue.getJob(testJob.id as string);
    if (job) {
      await job.remove();
      console.log('   ✅ Test job removed\n');
    }

    // Final stats
    console.log('7️⃣ Final queue stats...');
    const finalStats = await getQueueStats();
    console.log('   📊 Final stats:', finalStats);
    console.log('');

    console.log('✅ All tests passed!');
    console.log('\n📚 Next steps:');
    console.log('   1. Start the worker: npm run worker:pdf');
    console.log('   2. Upload a real PDF through the UI');
    console.log('   3. Watch the worker process the job');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    await redis.quit();
    await pdfProcessingQueue.close();
    process.exit(0);
  }
}

// Run tests
testQueue().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
