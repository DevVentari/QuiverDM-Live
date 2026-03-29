import { PrismaClient } from '@prisma/client';
import { assert, cleanupUser, createBaseContext, type Assertion } from './workflow-test-utils';

const prisma = new PrismaClient();

async function main() {
  const assertions: Assertion[] = [];
  let ownerId: string | null = null;
  let inviteeId: string | null = null;
  let campaignId: string | null = null;

  try {
    const { owner, campaign, id } = await createBaseContext(prisma, 'campaign-wf');
    ownerId = owner.id;
    campaignId = campaign.id;

    assert(assertions, 'Campaign created', !!campaign.id);

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { name: `${campaign.name} Updated` },
    });
    assert(assertions, 'Campaign updated', updated.name.endsWith('Updated'));

    const invitee = await prisma.user.create({
      data: {
        email: `${id}-invitee@workflow.test`,
        name: 'Campaign Invitee',
      },
    });
    inviteeId = invitee.id;

    await prisma.campaignInvite.create({
      data: {
        campaignId: campaign.id,
        email: invitee.email!,
        createdBy: owner.id,
        role: 'PLAYER',
      },
    });
    const invites = await prisma.campaignInvite.count({ where: { campaignId: campaign.id } });
    assert(assertions, 'Campaign invite created', invites === 1, `count=${invites}`);

    await prisma.campaignMember.create({
      data: {
        campaignId: campaign.id,
        userId: invitee.id,
        role: 'PLAYER',
      },
    });
    const members = await prisma.campaignMember.count({ where: { campaignId: campaign.id } });
    assert(assertions, 'Campaign member added', members === 2, `count=${members}`);

    await prisma.campaign.delete({ where: { id: campaign.id } });
    const deleted = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    assert(assertions, 'Campaign deleted', !deleted);

    console.log('Campaign workflow assertions passed:', assertions.length);
  } finally {
    if (inviteeId) {
      await cleanupUser(prisma, inviteeId).catch(() => {});
    }
    if (ownerId) {
      await cleanupUser(prisma, ownerId).catch(() => {});
    }
    if (campaignId) {
      await prisma.campaign.delete({ where: { id: campaignId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('Campaign workflow test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});

