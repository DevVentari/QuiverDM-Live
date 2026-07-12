// scripts/seed-valdrath-theme.ts
import { PrismaClient } from '@prisma/client';
import { VALDRATH_THEME } from '@quiverdm/shared';

const prisma = new PrismaClient();
async function main() {
  const c = await prisma.campaign.findFirst({
    where: { OR: [{ slug: 'valdrath' }, { name: { contains: 'Valdrath', mode: 'insensitive' } }] },
    select: { id: true, name: true },
  });
  if (!c) { console.error('No Valdrath campaign found — set theme manually once it exists.'); return; }
  await prisma.campaign.update({ where: { id: c.id }, data: { theme: VALDRATH_THEME as object } });
  console.log(`Seeded Valdrath theme onto campaign ${c.name} (${c.id}).`);
}
main().finally(() => prisma.$disconnect());
