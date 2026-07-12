import { randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { decrypt } from '@quiverdm/shared';
import type { DdbClient } from '@/lib/ddb';
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

export async function importPartyFromDdb(
  prisma: PrismaClient,
  ddb: DdbClient,
  userId: string,
  input: { campaignId: string; campaignUrl: string },
): Promise<{ imported: number; failed: number }> {
  await assertCampaignOwner(prisma, input.campaignId, userId);

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const cobalt = settings?.dndBeyondCobaltCookie ? decrypt(settings.dndBeyondCobaltCookie) : '';
  if (!cobalt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No D&D Beyond cobalt cookie on file — add it in Workings.' });
  }

  const refs = await ddb.fetchCampaignCharacterIds(input.campaignUrl, cobalt);
  if (!refs.ok || !refs.ids?.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: refs.message ?? 'No characters found in that campaign.' });
  }

  let imported = 0;
  let failed = 0;
  for (const id of refs.ids) {
    const name = await ddb.fetchCharacterName(id, cobalt);
    if (!name) {
      failed++;
      continue;
    }
    const exists = await prisma.player.findFirst({ where: { campaignId: input.campaignId, characterName: name } });
    if (!exists) {
      await prisma.player.create({
        data: {
          campaignId: input.campaignId,
          name,
          characterName: name,
          dndBeyondUrl: `https://www.dndbeyond.com/characters/${id}`,
        },
      });
    }
    await prisma.lexiconTerm.upsert({
      where: { campaignId_term: { campaignId: input.campaignId, term: name } },
      update: {},
      create: { campaignId: input.campaignId, term: name, kind: 'pc', source: 'ddb-import' },
    });
    imported++;
  }
  return { imported, failed };
}
