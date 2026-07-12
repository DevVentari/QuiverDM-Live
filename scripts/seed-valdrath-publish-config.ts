import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const CONFIG = { host: '192.168.1.15', user: 'valdrath-recv', urlBase: 'https://valdrath.quiverdm.com' };
async function main() {
  const c = await prisma.campaign.findFirst({
    where: { OR: [{ slug: { startsWith: 'valdrath' } }, { name: { contains: 'Valdrath', mode: 'insensitive' } }] },
    select: { id: true, name: true },
  });
  if (!c) { console.error('No Valdrath campaign found.'); return; }
  await prisma.campaign.update({ where: { id: c.id }, data: { publishConfig: CONFIG as object } });
  console.log(`Seeded publishConfig onto ${c.name} (${c.id}).`);
}
main().finally(() => prisma.$disconnect());
