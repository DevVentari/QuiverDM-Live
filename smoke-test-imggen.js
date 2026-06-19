require('dotenv').config();
const { Queue } = require('bullmq');
const { PrismaClient } = require('@prisma/client');

const url = new URL(process.env.REDIS_URL);
const q = new Queue('image-generation', {
  connection: { host: url.hostname, port: parseInt(url.port || 6379), password: url.password || undefined, maxRetriesPerRequest: null }
});
const prisma = new PrismaClient();

const homebrewId = 'cmp2jf1ey02iv1f9k4vfi0ztq';
const userId = 'smoke-test-user';

prisma.imageGenerationJob.create({
  data: { homebrewId, userId, prompt: 'D&D fantasy item', provider: 'auto', status: 'queued' }
})
.then(job => {
  console.log('Created DB job:', job.id);
  return q.add('generate', { jobId: job.id, homebrewId, userId, type: 'item', name: 'The Mask of Malevolence', storageKeyPrefix: 'smoke-test/images' });
})
.then(bJob => {
  console.log('Queued BullMQ job:', bJob.id);
  return q.close();
})
.then(() => prisma.$disconnect())
.catch(e => { console.error(e.message); process.exit(1); });
