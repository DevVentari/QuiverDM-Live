import { PrismaClient, CampaignRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ---------------------------------------------------------------------------
  // 1. Demo Users
  // ---------------------------------------------------------------------------
  const hashedPassword = await hash('demo1234', 12);

  const dm = await prisma.user.upsert({
    where: { email: 'demo@quiverdm.com' },
    update: {},
    create: {
      email: 'demo@quiverdm.com',
      name: 'Demo DM',
      onboardingCompleted: true,
    },
  });

  // Store password in Account table (credentials provider)
  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: dm.email! } },
    update: {},
    create: {
      userId: dm.id,
      type: 'credentials',
      provider: 'credentials',
      providerAccountId: dm.email!,
      password: hashedPassword,
    },
  });

  const player = await prisma.user.upsert({
    where: { email: 'player@quiverdm.com' },
    update: {},
    create: {
      email: 'player@quiverdm.com',
      name: 'Demo Player',
      onboardingCompleted: true,
    },
  });

  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: player.email! } },
    update: {},
    create: {
      userId: player.id,
      type: 'credentials',
      provider: 'credentials',
      providerAccountId: player.email!,
      password: hashedPassword,
    },
  });

  console.log(`Created demo users: ${dm.email}, ${player.email}`);

  // ---------------------------------------------------------------------------
  // 2. Campaigns
  // ---------------------------------------------------------------------------
  const campaign1 = await prisma.campaign.upsert({
    where: { slug: 'lost-mines-of-phandelver' },
    update: {},
    create: {
      name: 'Lost Mines of Phandelver',
      slug: 'lost-mines-of-phandelver',
      description:
        'A classic introductory adventure set in the Sword Coast. The party has been hired to escort a wagon of supplies to the mining town of Phandalin.',
      status: 'active',
      userId: dm.id,
    },
  });

  const campaign2 = await prisma.campaign.upsert({
    where: { slug: 'curse-of-strahd' },
    update: {},
    create: {
      name: 'Curse of Strahd',
      slug: 'curse-of-strahd',
      description:
        'A gothic horror campaign set in the dread domain of Barovia, ruled by the vampire lord Strahd von Zarovich.',
      status: 'active',
      userId: dm.id,
    },
  });

  console.log(`Created campaigns: ${campaign1.name}, ${campaign2.name}`);

  // ---------------------------------------------------------------------------
  // 3. Campaign Members
  // ---------------------------------------------------------------------------
  // DM as OWNER on both campaigns
  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign1.id, userId: dm.id } },
    update: {},
    create: {
      campaignId: campaign1.id,
      userId: dm.id,
      role: CampaignRole.OWNER,
      canViewNPCSecrets: true,
      canEditNPCs: true,
      canManageSessions: true,
      canInviteMembers: true,
    },
  });

  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign2.id, userId: dm.id } },
    update: {},
    create: {
      campaignId: campaign2.id,
      userId: dm.id,
      role: CampaignRole.OWNER,
      canViewNPCSecrets: true,
      canEditNPCs: true,
      canManageSessions: true,
      canInviteMembers: true,
    },
  });

  // Player as PLAYER on campaign1
  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign1.id, userId: player.id } },
    update: {},
    create: {
      campaignId: campaign1.id,
      userId: player.id,
      role: CampaignRole.PLAYER,
    },
  });

  console.log('Created campaign members');

  // ---------------------------------------------------------------------------
  // 4. NPCs
  // ---------------------------------------------------------------------------
  const npcData = [
    {
      name: 'Gundren Rockseeker',
      description:
        'A sturdy dwarf entrepreneur who hired the party to escort supplies. He has a secret — he and his brothers have found the legendary Wave Echo Cave.',
      faction: 'Rockseeker Clan',
      secrets: 'Knows the location of Wave Echo Cave. Currently captured by the Black Spider.',
      campaignId: campaign1.id,
      tags: ['ally', 'dwarf', 'quest-giver'],
    },
    {
      name: 'Sildar Hallwinter',
      description:
        'A kindhearted human warrior and member of the Lords Alliance. He travels with Gundren and seeks to bring order to Phandalin.',
      faction: "Lords' Alliance",
      secrets: 'Searching for Iarno Albrek, a fellow Alliance member who went missing.',
      campaignId: campaign1.id,
      tags: ['ally', 'human', 'warrior'],
    },
    {
      name: 'Halia Thornton',
      description:
        'The ambitious guildmaster of the Phandalin Miners Exchange. She has ties to the Zhentarim and her own hidden agenda.',
      faction: 'Zhentarim',
      secrets: 'Secretly a Zhentarim agent. Wants to take over the Redbrand operation for herself.',
      campaignId: campaign1.id,
      tags: ['neutral', 'human', 'merchant'],
    },
    {
      name: 'Glasstaff (Iarno Albrek)',
      description:
        'The mysterious leader of the Redbrands gang. He wields a glass staff and has connections to a shadowy figure known as the Black Spider.',
      faction: 'Redbrands',
      secrets: 'Actually Iarno Albrek, a former Lords Alliance member corrupted by the Black Spider.',
      campaignId: campaign1.id,
      tags: ['villain', 'human', 'mage'],
    },
    {
      name: 'Strahd von Zarovich',
      description:
        'The ancient and powerful vampire lord who rules Barovia with an iron fist. He is cursed to forever pine for his lost love, Tatyana.',
      faction: 'Castle Ravenloft',
      secrets: 'Can be weakened by the Sunsword, Holy Symbol of Ravenkind, and the Tome of Strahd.',
      campaignId: campaign2.id,
      tags: ['villain', 'vampire', 'boss'],
    },
  ];

  // Delete existing NPCs for these campaigns to avoid duplicates on re-seed
  for (const npc of npcData) {
    const existing = await prisma.nPC.findFirst({
      where: { campaignId: npc.campaignId, name: npc.name },
    });
    if (!existing) {
      await prisma.nPC.create({ data: npc });
    }
  }

  console.log(`Created ${npcData.length} NPCs`);

  // ---------------------------------------------------------------------------
  // 5. Sessions
  // ---------------------------------------------------------------------------
  // Check existing session numbers to avoid unique constraint violations
  const existingSessions = await prisma.gameSession.findMany({
    where: { campaignId: campaign1.id },
    select: { sessionNumber: true },
  });
  const existingNumbers = new Set(existingSessions.map((s) => s.sessionNumber));

  const sessionsToCreate = [
    {
      title: 'Session 1: Goblin Ambush',
      campaignId: campaign1.id,
      sessionNumber: 1,
      date: new Date('2026-01-15'),
      quickNotes:
        'The party was ambushed by goblins on the Triboar Trail. They tracked the goblins back to Cragmaw Hideout and rescued Sildar.',
      status: 'completed',
    },
    {
      title: 'Session 2: Arrival in Phandalin',
      campaignId: campaign1.id,
      sessionNumber: 2,
      date: new Date('2026-01-22'),
      quickNotes:
        'The party arrived in Phandalin and discovered the Redbrand menace. They gathered information from townsfolk.',
      status: 'completed',
    },
    {
      title: 'Session 3: Redbrand Hideout',
      campaignId: campaign1.id,
      sessionNumber: 3,
      date: new Date('2026-02-05'),
      quickNotes: null,
      status: 'active',
    },
  ];

  for (const session of sessionsToCreate) {
    if (!existingNumbers.has(session.sessionNumber)) {
      await prisma.gameSession.create({
        data: {
          title: session.title,
          campaignId: session.campaignId,
          sessionNumber: session.sessionNumber,
          date: session.date,
          quickNotes: session.quickNotes,
          status: session.status,
        },
      });
    }
  }

  console.log('Created 3 sessions');

  // ---------------------------------------------------------------------------
  // 6. Invite Code
  // ---------------------------------------------------------------------------
  await prisma.inviteCode.upsert({
    where: { code: 'DEMO-BETA-2026' },
    update: {},
    create: {
      code: 'DEMO-BETA-2026',
      expiresAt: new Date('2027-01-01'),
    },
  });

  console.log('Created demo invite code: DEMO-BETA-2026');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
