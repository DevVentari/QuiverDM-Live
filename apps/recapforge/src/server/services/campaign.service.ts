import { randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { assertCampaignOwner } from '../guards';

export function slugify(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return s || 'campaign';
}

export async function createForgeCampaign(prisma: PrismaClient, userId: string, name: string) {
  const slug = `${slugify(name)}-${randomBytes(3).toString('hex')}`;
  return prisma.campaign.create({
    data: {
      name,
      slug,
      userId,
      settings: { recapforge: true },
      members: {
        create: {
          userId,
          role: 'OWNER',
          canViewNPCSecrets: true,
          canEditNPCs: true,
          canManageSessions: true,
          canInviteMembers: true,
        },
      },
    },
    select: { id: true, name: true, slug: true },
  });
}

export async function listForgeCampaigns(prisma: PrismaClient, userId: string) {
  return prisma.campaign.findMany({
    where: {
      settings: { path: ['recapforge'], equals: true },
      OR: [{ userId }, { members: { some: { userId, role: { in: ['OWNER', 'CO_DM'] } } } }],
    },
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addPartyMember(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; playerName: string; characterName: string },
) {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const player = await prisma.player.create({
    data: { campaignId: input.campaignId, name: input.playerName, characterName: input.characterName },
    select: { id: true },
  });
  await prisma.lexiconTerm.upsert({
    where: { campaignId_term: { campaignId: input.campaignId, term: input.characterName } },
    update: {},
    create: { campaignId: input.campaignId, term: input.characterName, kind: 'pc', source: 'manual' },
  });
  return player;
}

export async function listParty(prisma: PrismaClient, userId: string, campaignId: string) {
  await assertCampaignOwner(prisma, campaignId, userId);
  return prisma.player.findMany({
    where: { campaignId },
    select: { id: true, name: true, characterName: true },
    orderBy: { createdAt: 'asc' },
  });
}
