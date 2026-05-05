import { PrismaClient, CampaignRole } from '@prisma/client';

export async function seedCurseOfStrahd(prisma: PrismaClient, userId: string) {
  const campaign = await prisma.campaign.upsert({
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

  const existing = await prisma.nPC.findFirst({
    where: { campaignId: campaign.id, name: 'Strahd von Zarovich' },
  });
  if (!existing) {
    await prisma.nPC.create({
      data: {
        campaignId: campaign.id,
        name: 'Strahd von Zarovich',
        description:
          'The ancient and powerful vampire lord who rules Barovia with an iron fist. He is cursed to forever pine for his lost love, Tatyana.',
        faction: 'Castle Ravenloft',
        secrets: 'Can be weakened by the Sunsword, Holy Symbol of Ravenkind, and the Tome of Strahd.',
        tags: ['villain', 'vampire', 'boss'],
      },
    });
  }

  console.log(`Seeded Curse of Strahd`);
}
