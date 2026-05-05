import { PrismaClient, CampaignRole } from '@prisma/client';

export async function seedLostMines(prisma: PrismaClient, userId: string) {
  const campaign = await prisma.campaign.upsert({
    where: { slug: 'lost-mines-of-phandelver' },
    update: {},
    create: {
      name: 'Lost Mines of Phandelver',
      slug: 'lost-mines-of-phandelver',
      description:
        'A classic introductory adventure set in the Sword Coast. The party has been hired to escort a wagon of supplies to the mining town of Phandalin.',
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

  const npcs = [
    {
      name: 'Gundren Rockseeker',
      description:
        'A sturdy dwarf entrepreneur who hired the party to escort supplies. He has a secret — he and his brothers have found the legendary Wave Echo Cave.',
      faction: 'Rockseeker Clan',
      secrets: 'Knows the location of Wave Echo Cave. Currently captured by the Black Spider.',
      tags: ['ally', 'dwarf', 'quest-giver'],
    },
    {
      name: 'Sildar Hallwinter',
      description:
        'A kindhearted human warrior and member of the Lords Alliance. He travels with Gundren and seeks to bring order to Phandalin.',
      faction: "Lords' Alliance",
      secrets: 'Searching for Iarno Albrek, a fellow Alliance member who went missing.',
      tags: ['ally', 'human', 'warrior'],
    },
    {
      name: 'Halia Thornton',
      description:
        'The ambitious guildmaster of the Phandalin Miners Exchange. She has ties to the Zhentarim and her own hidden agenda.',
      faction: 'Zhentarim',
      secrets: 'Secretly a Zhentarim agent. Wants to take over the Redbrand operation for herself.',
      tags: ['neutral', 'human', 'merchant'],
    },
    {
      name: 'Glasstaff (Iarno Albrek)',
      description:
        'The mysterious leader of the Redbrands gang. He wields a glass staff and has connections to a shadowy figure known as the Black Spider.',
      faction: 'Redbrands',
      secrets: 'Actually Iarno Albrek, a former Lords Alliance member corrupted by the Black Spider.',
      tags: ['villain', 'human', 'mage'],
    },
  ];

  for (const npc of npcs) {
    const existing = await prisma.nPC.findFirst({ where: { campaignId: campaign.id, name: npc.name } });
    if (!existing) {
      await prisma.nPC.create({ data: { ...npc, campaignId: campaign.id } });
    }
  }

  const existingSessions = await prisma.gameSession.findMany({
    where: { campaignId: campaign.id },
    select: { sessionNumber: true },
  });
  const existingNumbers = new Set(existingSessions.map((s) => s.sessionNumber));

  const sessions = [
    {
      title: 'Session 1: Goblin Ambush',
      sessionNumber: 1,
      date: new Date('2026-01-15'),
      quickNotes:
        'The party was ambushed by goblins on the Triboar Trail. They tracked the goblins back to Cragmaw Hideout and rescued Sildar.',
      status: 'completed',
    },
    {
      title: 'Session 2: Arrival in Phandalin',
      sessionNumber: 2,
      date: new Date('2026-01-22'),
      quickNotes:
        'The party arrived in Phandalin and discovered the Redbrand menace. They gathered information from townsfolk.',
      status: 'completed',
    },
    {
      title: 'Session 3: Redbrand Hideout',
      sessionNumber: 3,
      date: new Date('2026-02-05'),
      quickNotes: null,
      status: 'active',
    },
  ];

  for (const session of sessions) {
    if (!existingNumbers.has(session.sessionNumber)) {
      await prisma.gameSession.create({ data: { ...session, campaignId: campaign.id } });
    }
  }

  console.log(`Seeded Lost Mines of Phandelver`);
}
