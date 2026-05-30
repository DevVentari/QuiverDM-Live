import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const t = await prisma.transcript.findUnique({
  where: { id: 'cmp86w82f0001guq587adyht4' },
  select: { content: true, speakers: true },
});
process.stdout.write(JSON.stringify({ content: t.content, speakers: t.speakers }));
await prisma.$disconnect();
