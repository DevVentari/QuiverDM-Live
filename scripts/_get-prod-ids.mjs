import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const rows = await p.campaignMember.findMany({
  where: { userId: 'cmmqlqy1o0001co5m5wf4efj7' },
  include: {
    campaign: {
      select: {
        id: true, name: true, slug: true,
        gameSessions: { select: { id: true, title: true, status: true }, orderBy: { date: 'asc' } },
        npcs: { select: { id: true, name: true }, take: 5 },
      }
    }
  }
});
console.log(JSON.stringify(rows, null, 2));
await p.$disconnect();
