import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing campaign userId...\n');

  // Find the Bonfire Keep campaign
  const campaign = await prisma.campaign.findFirst({
    where: {
      name: 'Tales from The Bonfire Keep'
    }
  });

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log(`Found campaign: ${campaign.name}`);
  console.log(`Current userId: ${campaign.userId}`);

  // Update to temp-user
  await prisma.campaign.update({
    where: {
      id: campaign.id
    },
    data: {
      userId: 'temp-user'
    }
  });

  console.log(`✅ Updated campaign userId to: temp-user`);

  // Verify the update
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId: 'temp-user'
    },
    include: {
      _count: {
        select: { npcs: true }
      }
    }
  });

  console.log('\nCampaigns for temp-user:');
  campaigns.forEach(camp => {
    console.log(`- ${camp.name} (${camp._count.npcs} NPCs)`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
