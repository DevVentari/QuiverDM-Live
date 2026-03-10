import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.user.updateMany({
  where: { email: { in: ['vic@test.local', 'dana@test.local', 'nora@test.local', 'player@test.local'] } },
  data: { tier: 'pro' },
}).then(r => {
  console.log('[updated]', r.count, 'QA users to pro tier');
  return prisma.$disconnect();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
