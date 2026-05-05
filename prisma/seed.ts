import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seeds/users';
import { seedLostMines } from './seeds/lost-mines';
import { seedCurseOfStrahd } from './seeds/curse-of-strahd';
import { seedHameriaIre } from './seeds/hameria-ire';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');

  const { dm, player } = await seedUsers(prisma);

  await seedLostMines(prisma, dm.id);
  await seedCurseOfStrahd(prisma, dm.id);
  await seedHameriaIre(prisma, dm.id);

  await prisma.inviteCode.upsert({
    where: { code: 'DEMO-BETA-2026' },
    update: {},
    create: { code: 'DEMO-BETA-2026', expiresAt: new Date('2027-01-01') },
  });

  const lostMines = await prisma.campaign.findUnique({ where: { slug: 'lost-mines-of-phandelver' } });
  if (lostMines) {
    await prisma.campaignMember.upsert({
      where: { campaignId_userId: { campaignId: lostMines.id, userId: player.id } },
      update: {},
      create: { campaignId: lostMines.id, userId: player.id, role: 'PLAYER' },
    });
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
