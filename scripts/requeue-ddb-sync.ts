/**
 * Re-queue DDB sync jobs using the CobaltSession already stored in prod DB.
 * Run: npx tsx scripts/requeue-ddb-sync.ts
 */
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const DB = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const REDIS_URL = 'rediss://default:AcIzAAIncDFmZGU0YzNhNGQzZTg0MTM0OTAzMzUyYjkyZjM2YWViMnAxNDk3MTU@concise-ram-49715.upstash.io:6379';
const USER_ID = 'cmmqlqy1o0001co5m5wf4efj7';

const p = new PrismaClient({ datasources: { db: { url: DB } } });

(async () => {
  const sourcebooks = await p.ddbSourcebook.findMany({
    where: { userId: USER_ID },
    select: { id: true, slug: true, title: true },
  });

  if (sourcebooks.length === 0) {
    console.log('No sourcebooks found. Run seed-ddb-prod.ts first.');
    await p.$disconnect();
    return;
  }

  const url = new URL(REDIS_URL);
  const queue = new Queue('ddb-sourcebook-sync', {
    connection: {
      host: url.hostname,
      port: parseInt(url.port),
      username: url.username,
      password: decodeURIComponent(url.password),
      tls: {},
    },
  });

  console.log('Queuing sync jobs:');
  for (const sb of sourcebooks) {
    const jobId = `sync-${sb.id}-${Date.now()}`;
    await queue.add(`sync-${sb.id}`, { sourcebookId: sb.id, userId: USER_ID, isUpdateCheck: false }, { jobId });
    console.log(`  ${sb.slug} (${sb.title}) — ${jobId}`);
  }

  await queue.close();
  await p.$disconnect();
  console.log('\nDone.');
})().catch(e => { console.error(e); process.exit(1); });
