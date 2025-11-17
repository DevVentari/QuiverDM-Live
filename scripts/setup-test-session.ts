import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Create or update temp user
    const user = await prisma.user.upsert({
      where: { id: 'temp-user' },
      update: {},
      create: {
        id: 'temp-user',
        email: 'temp@quiverdm.com',
        name: 'Temp User',
      },
    });

    console.log('✅ Created temp user:', user.id);

    // Create or update temp campaign
    const campaign = await prisma.campaign.upsert({
      where: { id: 'temp-campaign' },
      update: {},
      create: {
        id: 'temp-campaign',
        name: 'Test Campaign',
        userId: user.id,
      },
    });

    console.log('✅ Created temp campaign:', campaign.id);

    // Create or update temp session
    const session = await prisma.gameSession.upsert({
      where: { id: 'temp-session' },
      update: {},
      create: {
        id: 'temp-session',
        campaignId: campaign.id,
        sessionNumber: 1,
        title: 'Test Session',
      },
    });

    console.log('✅ Created temp session:', session.id);
    console.log('\n✅ Test database setup complete!');
  } catch (error) {
    console.error('❌ Error setting up test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
