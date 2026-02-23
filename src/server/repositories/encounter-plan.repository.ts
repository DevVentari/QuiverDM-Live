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
      include: planWithCreaturesInclude,
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
};
