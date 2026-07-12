import { randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { decrypt } from '@quiverdm/shared';
import { parseCardMeta, type DdbClient } from '@/lib/ddb';
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
    select: { id: true, name: true, characterName: true, characterClass: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Strike a member from the party. The Player row goes; their lexicon term is
 * re-filed as an NPC rather than deleted — the name should still boost
 * transcription and link in the wiki, it just stops being offered as a voice.
 * Deleting an already-struck member is a no-op.
 */
export async function removePartyMember(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; playerId: string },
): Promise<void> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const player = await prisma.player.findFirst({
    where: { id: input.playerId, campaignId: input.campaignId },
    select: { characterName: true },
  });
  if (!player) return; // already struck — no-op
  await prisma.player.deleteMany({ where: { id: input.playerId, campaignId: input.campaignId } });
  await prisma.lexiconTerm.updateMany({
    where: { campaignId: input.campaignId, term: player.characterName },
    data: { kind: 'npc' },
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

  const roster = await ddb.fetchCampaignRoster(input.campaignUrl, cobalt);
  if (!roster.ok) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: roster.message ?? 'No characters found in that campaign.' });
  }

  // Normalized shape, whichever path fills it. Name + class/race/level +
  // player only — context for the scribe, never a full sheet import.
  type Row = {
    id: string | null; name: string; className: string | null;
    race: string | null; level: number | null; playerUsername: string | null;
  };
  const rows: Row[] = [];
  let failed = 0;

  if (roster.entries?.length) {
    // Roster cards carry every character — private sheets included.
    for (const e of roster.entries) {
      const { level, race, className } = parseCardMeta(e.meta);
      rows.push({ id: e.id, name: e.name, className, race, level, playerUsername: e.playerUsername });
    }
  } else if (roster.ids?.length) {
    // Card scrape came back empty (markup drift?) — per-sheet fallback.
    for (const id of roster.ids) {
      const summary = await ddb.fetchCharacterSummary(id, cobalt);
      if (!summary) {
        failed++;
        continue;
      }
      rows.push({ id, name: summary.name, className: summary.className, race: null, level: null, playerUsername: null });
    }
  } else {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No characters found in that campaign.' });
  }

  let imported = 0;
  for (const row of rows) {
    // A lexicon term already re-filed as npc means the DM struck this name
    // from the party — re-imports must not resurrect it.
    const struck = await prisma.lexiconTerm.findUnique({
      where: { campaignId_term: { campaignId: input.campaignId, term: row.name } },
      select: { kind: true },
    });
    if (struck?.kind === 'npc') continue;

    const exists = await prisma.player.findFirst({
      where: { campaignId: input.campaignId, characterName: row.name },
      select: { id: true },
    });
    const context = {
      characterClass: row.className ?? undefined,
      characterRace: row.race ?? undefined,
      level: row.level ?? undefined,
      ...(row.playerUsername ? { name: row.playerUsername } : {}),
    };
    if (!exists) {
      await prisma.player.create({
        data: {
          campaignId: input.campaignId,
          name: row.playerUsername ?? row.name,
          characterName: row.name,
          characterClass: row.className,
          characterRace: row.race,
          ...(row.level !== null ? { level: row.level } : {}),
          ...(row.id ? { dndBeyondUrl: `https://www.dndbeyond.com/characters/${row.id}` } : {}),
        },
      });
    } else {
      // Re-import refreshes context (level-ups, subclass picks, player renames).
      await prisma.player.update({ where: { id: exists.id }, data: context });
    }
    await prisma.lexiconTerm.upsert({
      where: { campaignId_term: { campaignId: input.campaignId, term: row.name } },
      update: {},
      create: { campaignId: input.campaignId, term: row.name, kind: 'pc', source: 'ddb-import' },
    });
    imported++;
  }
  return { imported, failed };
}
