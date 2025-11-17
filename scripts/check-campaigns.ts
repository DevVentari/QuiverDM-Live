import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      _count: {
        select: { npcs: true }
      }
    }
  });

  console.log('Campaigns in database:');
  campaigns.forEach(camp => {
    console.log(`- ${camp.name} (${camp._count.npcs} NPCs) - User: ${camp.userId}`);
  });
}

main()
  .finally(() => prisma.$disconnect());
