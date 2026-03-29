import { PrismaClient } from '@prisma/client';
import { assert, cleanupUser, createBaseContext, type Assertion } from './workflow-test-utils';

const prisma = new PrismaClient();

async function main() {
  const assertions: Assertion[] = [];
  let ownerId: string | null = null;

  try {
    const { owner, campaign } = await createBaseContext(prisma, 'homebrew-wf');
    ownerId = owner.id;

    const content = await prisma.homebrewContent.create({
      data: {
        userId: owner.id,
        type: 'spell',
        name: 'Workflow Test Spell',
        data: {
          level: 1,
          school: 'evocation',
          description: 'Test spell for workflow checks.',
        },
        tags: ['workflow', 'spell'],
        images: [],
        searchText: 'workflow test spell evocation',
      },
    });
    assert(assertions, 'Homebrew content created', !!content.id);

    const updated = await prisma.homebrewContent.update({
      where: { id: content.id },
      data: {
        name: 'Workflow Test Spell Updated',
        searchText: 'workflow test spell updated evocation',
      },
    });
    assert(assertions, 'Homebrew content updated', updated.name.includes('Updated'));

    await prisma.campaignHomebrewContent.create({
      data: {
        campaignId: campaign.id,
        homebrewId: content.id,
      },
    });
    const links = await prisma.campaignHomebrewContent.count({
      where: { campaignId: campaign.id, homebrewId: content.id },
    });
    assert(assertions, 'Homebrew linked to campaign', links === 1, `count=${links}`);

    await prisma.campaignHomebrewContent.deleteMany({
      where: { campaignId: campaign.id, homebrewId: content.id },
    });
    await prisma.homebrewContent.delete({ where: { id: content.id } });
    const afterDelete = await prisma.homebrewContent.findUnique({ where: { id: content.id } });
    assert(assertions, 'Homebrew deleted', !afterDelete);

    console.log('Homebrew workflow assertions passed:', assertions.length);
  } finally {
    if (ownerId) {
      await cleanupUser(prisma, ownerId).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('Homebrew workflow test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});

