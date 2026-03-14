// NOTE: Uses protectedProcedure + manual membership checks rather than
// campaignMemberProcedure — deliberate deviation because play queries are
// cross-campaign (getHome) or require custom player-scoped filtering.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError } from '@/server/errors';

export const playService = {
  async getPlayerCampaigns(userId: string) {
    const memberships = await prisma.campaignMember.findMany({
      where: { userId },
      include: {
        campaign: {
          include: {
            gameSessions: {
              orderBy: { date: 'desc' },
              take: 1,
              select: { id: true, title: true, date: true, status: true },
            },
            characters: {
              where: { character: { userId } },
              take: 1,
              include: {
                character: { select: { name: true, class: true, level: true, portraitUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { campaign: { updatedAt: 'desc' } },
    });
    return memberships.map(m => {
      const cc = m.campaign.characters[0] ?? null;
      return {
        campaignId: m.campaignId,
        name: m.campaign.name,
        slug: m.campaign.slug,
        bannerUrl: m.campaign.bannerUrl ?? null,
        role: m.role,
        nextSession: m.campaign.gameSessions[0] ?? null,
        character: cc
          ? { name: cc.character.name, class: cc.character.class ?? null, level: cc.character.level, portraitUrl: cc.character.portraitUrl ?? null }
          : null,
      };
    });
  },

  async getCampaignHub(slug: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
        gameSessions: {
          where: { status: { not: 'planning' } },
          orderBy: { date: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            date: true,
            aiSummary: true,
            playerVisibility: true,
          },
        },
        characters: {
          where: { character: { userId } },
          take: 1,
          include: {
            character: { select: { name: true, class: true, level: true, portraitUrl: true } },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundError('campaign', slug);

    const isMember = campaign.members.some(m => m.userId === userId);
    if (!isMember) throw ForbiddenError.forPermission('view', 'campaign');

    const activeSessions = campaign.gameSessions.filter(
      s => s.playerVisibility !== 'dm-only'
    );

    const cc = campaign.characters[0] ?? null;
    const character = cc
      ? { name: cc.character.name, class: cc.character.class ?? null, level: cc.character.level, portraitUrl: cc.character.portraitUrl ?? null }
      : null;

    const nextSession = await prisma.gameSession.findFirst({
      where: {
        campaignId: campaign.id,
        OR: [
          { status: 'in_progress' },
          { status: 'planning', date: { gt: new Date() } },
        ],
      },
      orderBy: { date: 'asc' },
      select: { id: true, title: true, date: true, status: true, quickNotes: true },
    });

    return {
      id: campaign.id,
      name: campaign.name,
      slug: campaign.slug,
      description: campaign.description,
      bannerUrl: campaign.bannerUrl ?? null,
      members: campaign.members,
      sessions: activeSessions,
      character,
      nextSession: nextSession ?? null,
    };
  },

  async getSessionRecap(sessionId: string, userId: string) {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        campaign: { include: { members: { where: { userId }, select: { role: true } } } },
      },
    });
    if (!session) throw new NotFoundError('session', sessionId);
    if (!session.campaign.members.length) throw ForbiddenError.forPermission('view', 'session');
    if (session.playerVisibility === 'dm-only') throw ForbiddenError.forPermission('view', 'session');

    return {
      id: session.id,
      title: session.title,
      status: session.status,
      date: session.date,
      aiSummary: session.aiSummary ?? null,
      playerVisibility: session.playerVisibility,
    };
  },

  async getSharedNpcs(campaignId: string, userId: string) {
    const member = await prisma.campaignMember.findFirst({ where: { campaignId, userId } });
    if (!member) throw ForbiddenError.forPermission('view', 'npcs');

    return prisma.nPC.findMany({
      where: { campaignId, playerVisible: true },
      select: {
        id: true, name: true, description: true,
        faction: true, role: true, imageUrl: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async getSharedLore(campaignId: string, userId: string) {
    const member = await prisma.campaignMember.findFirst({ where: { campaignId, userId } });
    if (!member) throw ForbiddenError.forPermission('view', 'lore');

    return prisma.homebrewContent.findMany({
      where: { campaigns: { some: { campaignId } }, sharedWithPlayers: true },
      select: { id: true, name: true, type: true, imageUrl: true, data: true },
      orderBy: { name: 'asc' },
    });
  },

  async getPlayerSessionState(sessionId: string, userId: string) {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { campaign: { select: { members: { where: { userId }, select: { id: true } } } } },
    });
    if (!session) throw new NotFoundError('session', sessionId);
    if (!session.campaign.members.length) throw ForbiddenError.forPermission('view', 'session state');

    return prisma.playerSessionState.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
  },

  async upsertPlayerSessionState(
    sessionId: string,
    userId: string,
    data: { hp: number; maxHp: number; tempHp?: number; conditions?: string[]; spellSlots?: Record<string, unknown>; hitDice?: Record<string, unknown> }
  ) {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { campaign: { select: { members: { where: { userId }, select: { id: true } } } } },
    });
    if (!session) throw new NotFoundError('session', sessionId);
    if (!session.campaign.members.length) throw ForbiddenError.forPermission('update', 'session state');

    const conditions = (data.conditions ?? []) as Prisma.InputJsonValue;
    const spellSlots = (data.spellSlots ?? {}) as Prisma.InputJsonValue;
    const hitDice = (data.hitDice ?? {}) as Prisma.InputJsonValue;

    return prisma.playerSessionState.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: {
        sessionId,
        userId,
        hp: data.hp,
        maxHp: data.maxHp,
        tempHp: data.tempHp ?? 0,
        conditions,
        spellSlots,
        hitDice,
      },
      update: {
        hp: data.hp,
        maxHp: data.maxHp,
        ...(data.tempHp !== undefined && { tempHp: data.tempHp }),
        ...(data.conditions !== undefined && { conditions }),
        ...(data.spellSlots !== undefined && { spellSlots }),
        ...(data.hitDice !== undefined && { hitDice }),
      },
    });
  },
};
