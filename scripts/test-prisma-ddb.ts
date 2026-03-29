import { prisma } from '@/lib/prisma';
(async () => {
  console.log('ddbSourcebook type:', typeof prisma.ddbSourcebook);
  try {
    const count = await prisma.ddbSourcebook.count();
    console.log('ddbSourcebook count:', count);
  } catch(e) {
    console.error('ddbSourcebook error:', (e as Error).message);
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
