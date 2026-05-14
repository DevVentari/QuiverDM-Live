import 'dotenv/config';
import { addDdbSyncJob } from '../src/lib/queue/ddb-sync-queue';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const sb = await prisma.ddbSourcebook.findFirst({ where: { slug: 'lmop' } });
  if (!sb) {
    console.error('No LMoP sourcebook row found.');
    process.exit(1);
  }
  console.log(`Enqueuing sync for ${sb.title} (${sb.id}), user ${sb.userId}`);
  const job = await addDdbSyncJob(sb.id, sb.userId, false);
  console.log(`Queued job ${job.id}`);
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
