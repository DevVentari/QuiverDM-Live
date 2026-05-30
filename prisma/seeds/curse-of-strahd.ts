import { PrismaClient, CampaignRole } from '@prisma/client';

export async function seedCurseOfStrahd(prisma: PrismaClient, userId: string) {
  await prisma.campaign.upsert({
    where: { slug: 'curse-of-strahd' },
    update: {},
    create: {
      name: 'Curse of Strahd',
      slug: 'curse-of-strahd',
      description:
        'A gothic horror campaign set in the dread domain of Barovia, ruled by the vampire lord Strahd von Zarovich.',
      status: 'active',
      userId,
    },
  });

  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { slug: 'curse-of-strahd' },
  });

  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId } },
    update: {},
    create: {
      campaignId: campaign.id,
      userId,
      role: CampaignRole.OWNER,
      canViewNPCSecrets: true,
      canEditNPCs: true,
      canManageSessions: true,
      canInviteMembers: true,
    },
  });

  // Link the CoS sourcebook if it has been synced (slug: 'cos')
  const sourcebook = await prisma.ddbSourcebook.findFirst({
    where: { slug: 'cos' },
    select: { id: true },
  });
  if (sourcebook) {
    await prisma.campaignSourcebook.upsert({
      where: { campaignId_sourcebookId: { campaignId: campaign.id, sourcebookId: sourcebook.id } },
      update: {},
      create: { campaignId: campaign.id, sourcebookId: sourcebook.id },
    });
    console.log(`Linked CoS sourcebook to campaign`);
  }

  console.log(`Seeded Curse of Strahd`);
}
