import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Ensure temp user exists
    const user = await prisma.user.upsert({
      where: { id: 'temp-user' },
      update: {},
      create: {
        id: 'temp-user',
        email: 'temp@quiverdm.com',
        name: 'Temp User',
      },
    });

    console.log('✅ Ensured temp user:', user.id);

    // Create test campaigns
    const campaign1 = await prisma.campaign.upsert({
      where: { id: 'test-campaign-1' },
      update: {},
      create: {
        id: 'test-campaign-1',
        name: 'Curse of Strahd',
        description: 'A gothic horror adventure in the land of Barovia',
        userId: user.id,
        status: 'active',
        glossary: {
          Strahd: 'Strahd von Zarovich, the vampire lord of Barovia',
          Barovia: 'The cursed land ruled by Count Strahd',
        },
      },
    });

    console.log('✅ Created campaign:', campaign1.name);

    const campaign2 = await prisma.campaign.upsert({
      where: { id: 'test-campaign-2' },
      update: {},
      create: {
        id: 'test-campaign-2',
        name: 'Dragon Heist',
        description: 'Urban adventure in the city of Waterdeep',
        userId: user.id,
        status: 'active',
      },
    });

    console.log('✅ Created campaign:', campaign2.name);

    // Create test sessions for campaign 1
    const session1 = await prisma.gameSession.upsert({
      where: { id: 'test-session-1' },
      update: {},
      create: {
        id: 'test-session-1',
        campaignId: campaign1.id,
        sessionNumber: 1,
        title: 'Arrival in Barovia',
        quickNotes: 'The party entered through the mists and encountered Strahd for the first time.',
        status: 'completed',
      },
    });

    console.log('✅ Created session:', session1.title);

    const session2 = await prisma.gameSession.upsert({
      where: { id: 'test-session-2' },
      update: {},
      create: {
        id: 'test-session-2',
        campaignId: campaign1.id,
        sessionNumber: 2,
        title: 'Village of Barovia',
        quickNotes: 'Explored the village, met Ismark and Ireena at the local tavern.',
        status: 'completed',
      },
    });

    console.log('✅ Created session:', session2.title);

    const session3 = await prisma.gameSession.upsert({
      where: { id: 'test-session-3' },
      update: {},
      create: {
        id: 'test-session-3',
        campaignId: campaign1.id,
        sessionNumber: 3,
        title: 'Castle Ravenloft',
        quickNotes: 'Infiltrating the castle. Currently fighting skeletons in the courtyard.',
        status: 'in_progress',
      },
    });

    console.log('✅ Created session:', session3.title);

    // Ensure campaign 2 has NO sessions (for empty state testing)
    await prisma.gameSession.deleteMany({
      where: { campaignId: campaign2.id },
    });

    console.log('✅ Ensured campaign 2 has no sessions');

    // Create some NPCs
    const npc1 = await prisma.nPC.upsert({
      where: { id: 'test-npc-1' },
      update: {},
      create: {
        id: 'test-npc-1',
        campaignId: campaign1.id,
        name: 'Strahd von Zarovich',
        description: 'The ancient vampire lord who rules Barovia with an iron fist.',
        faction: 'Undead',
        secrets: 'Obsessed with Ireena, who he believes is the reincarnation of his lost love Tatyana',
      },
    });

    console.log('✅ Created NPC:', npc1.name);

    const npc2 = await prisma.nPC.upsert({
      where: { id: 'test-npc-2' },
      update: {},
      create: {
        id: 'test-npc-2',
        campaignId: campaign1.id,
        name: 'Ireena Kolyana',
        description: 'A young woman with striking features who is being hunted by Strahd.',
        faction: 'Barovian Refugees',
      },
    });

    console.log('✅ Created NPC:', npc2.name);

    console.log('\n✅ Test campaign data setup complete!');
  } catch (error) {
    console.error('❌ Error setting up test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
