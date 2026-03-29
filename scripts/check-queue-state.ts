import { Queue } from 'bullmq';

const REDIS_URL = 'rediss://default:AcIzAAIncDFmZGU0YzNhNGQzZTg0MTM0OTAzMzUyYjkyZjM2YWViMnAxNDk3MTU@concise-ram-49715.upstash.io:6379';

const url = new URL(REDIS_URL);
const conn = {
  host: url.hostname,
  port: parseInt(url.port),
  username: url.username,
  password: decodeURIComponent(url.password),
  tls: {},
};

(async () => {
  const queues = ['ddb-sourcebook-sync', 'ddb-chapter-extract', 'ddb-sync-review'];
  for (const name of queues) {
    const q = new Queue(name, { connection: conn });
    const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    console.log(`${name}:`, JSON.stringify(counts));
    if (counts.failed && counts.failed > 0) {
      const failed = await q.getFailed(0, 2);
      for (const j of failed) {
        console.log(`  failed job ${j.id}: ${j.failedReason?.slice(0, 100)}`);
      }
    }
    await q.close();
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
