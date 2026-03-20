import { prisma } from '../db';

// Prisma type workaround for new models before client regeneration
const prismaAny = prisma as any;

const creatureSelect = {
  id: true,
  name: true,
  count: true,
  cr: true,
  xp: true,
  sourceType: true,
  sourceId: true,
  statBlock: true,
  createdAt: true,
};

const planWithCreaturesInclude = {
  creatures: {
    select: creatureSelect,
    orderBy: { createdAt: 'asc' as const },
  },
};

export const encounterPlanRepository = {
  findByCampaign: (campaignId: string) =>
    prismaAny.encounterPlan.findMany({
      where: { campaignId },
      include: {
        _count: { select: { creatures: true } },
        creatures: { select: creatureSelect, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),

  findById: (planId: string) =>
    prismaAny.encounterPlan.findUnique({
      where: { id: planId },
      include: {
        ...planWithCreaturesInclude,
        campaign: { select: { id: true, userId: true } },
      },
    }),

  create: (data: {
    campaignId: string;
    name: string;
    aiPrompt?: string;
    sceneDescription?: string;
    tacticalNotes?: string;
    difficulty?: string;
    partySize?: number;
    partyLevel?: number;
    xpBudget?: number;
    totalXp?: number;
    adjustedXp?: number;
    ddbChapterId?: string;
  }) =>
    prismaAny.encounterPlan.create({
      data,
      include: planWithCreaturesInclude,
    }),

  update: (
    planId: string,
    data: {
      name?: string;
      aiPrompt?: string;
      sceneDescription?: string;
      tacticalNotes?: string;
      environmentalEffects?: string;
      portraitUrl?: string;
      difficulty?: string;
      partySize?: number;
      partyLevel?: number;
      xpBudget?: number;
      totalXp?: number;
      adjustedXp?: number;
      ddbChapterId?: string;
    }
  ) =>
    prismaAny.encounterPlan.update({
      where: { id: planId },
      data,
      include: planWithCreaturesInclude,
    }),

  delete: (planId: string) => prismaAny.encounterPlan.delete({ where: { id: planId } }),

  addCreature: (data: {
    planId: string;
    name: string;
    count: number;
    cr?: string;
    xp?: number;
    sourceType: string;
    sourceId?: string;
    statBlock?: unknown;
  }) =>
    prismaAny.encounterPlanCreature.create({
      data,
      select: creatureSelect,
    }),

  removeCreature: (creatureId: string) =>
    prismaAny.encounterPlanCreature.delete({ where: { id: creatureId } }),

  updateCreature: (
    creatureId: string,
    data: { count?: number; statBlock?: unknown; name?: string; cr?: string; xp?: number }
  ) =>
    prismaAny.encounterPlanCreature.update({
      where: { id: creatureId },
      data,
      select: creatureSelect,
    }),

  deleteAllCreatures: (planId: string) =>
    prismaAny.encounterPlanCreature.deleteMany({ where: { planId } }),

  getBySourcebook: async (campaignId: string) => {
    const plans = await prismaAny.encounterPlan.findMany({
      where: {
        campaignId,
        ddbChapterId: { not: null },
      },
      select: {
        id: true,
        name: true,
        difficulty: true,
        sceneDescription: true,
        ddbChapterId: true,
        lastRunAt: true,
        timesRun: true,
        _count: { select: { creatures: true } },
      },
      orderBy: { ddbChapterId: 'asc' },
    });

    const chapterIds = [...new Set(plans.map((p: any) => p.ddbChapterId).filter(Boolean))];
    const chapterRecords = await prismaAny.homebrewContent.findMany({
      where: {
        dndBeyondId: { in: chapterIds },
        type: 'location',
        campaigns: { some: { campaignId } },
      },
      select: { dndBeyondId: true, name: true },
    });
    const chapterNameMap = new Map<string, string>(chapterRecords.map((r: any) => [r.dndBeyondId as string, r.name as string]));

    const grouped = new Map<string, { ddbChapterId: string; chapterName: string; plans: any[] }>();
    for (const plan of plans) {
      const key = plan.ddbChapterId as string;
      if (!grouped.has(key)) {
        const rawName = chapterNameMap.get(key) ?? key.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        grouped.set(key, { ddbChapterId: key, chapterName: rawName, plans: [] });
      }
      grouped.get(key)!.plans.push(plan);
    }
    return [...grouped.values()];
  },

  markAsRun: async (planId: string, sessionId?: string) => {
    return prismaAny.encounterPlan.update({
      where: { id: planId },
      data: {
        lastRunAt: new Date(),
        timesRun: { increment: 1 },
        ...(sessionId ? { lastRunSessionId: sessionId } : {}),
      },
    });
  },
};
