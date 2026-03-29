import { PrismaClient } from '@prisma/client';
import { assert, cleanupUser, createBaseContext, type Assertion } from './workflow-test-utils';

const prisma = new PrismaClient();

async function main() {
  const assertions: Assertion[] = [];
  let ownerId: string | null = null;

  try {
    const { owner, campaign } = await createBaseContext(prisma, 'character-wf');
    ownerId = owner.id;

    const character = await prisma.character.create({
      data: {
        userId: owner.id,
        name: 'Workflow Hero',
        level: 3,
        class: 'Wizard',
      },
    });
    assert(assertions, 'Character created', !!character.id);

    const link = await prisma.campaignCharacter.create({
      data: {
        campaignId: campaign.id,
        characterId: character.id,
        status: 'ACTIVE',
      },
    });
    assert(assertions, 'Character linked to campaign', !!link.id);

    const updatedCharacter = await prisma.character.update({
      where: { id: character.id },
      data: { level: 4 },
    });
    assert(assertions, 'Character updated', updatedCharacter.level === 4);

    const links = await prisma.campaignCharacter.findMany({
      where: { campaignId: campaign.id, characterId: character.id },
    });
    assert(assertions, 'Character campaign link retrievable', links.length === 1);

    await prisma.campaignCharacter.delete({ where: { id: link.id } });
    await prisma.character.delete({ where: { id: character.id } });
    const deleted = await prisma.character.findUnique({ where: { id: character.id } });
    assert(assertions, 'Character deleted', !deleted);

    console.log('Character workflow assertions passed:', assertions.length);
  } finally {
    if (ownerId) {
      await cleanupUser(prisma, ownerId).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('Character workflow test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});

