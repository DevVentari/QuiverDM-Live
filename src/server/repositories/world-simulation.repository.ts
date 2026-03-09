import { Prisma } from '@prisma/client';
import { prisma } from '../db';

export const worldSimulationRepository = {
  async upsertActor(campaignId: string, entityId: string, data: {
    goals?: string[];
    urgency?: number;
    resources?: Record<string, unknown>;
    riskTolerance?: number;
  }) {
    return prisma.worldActor.upsert({
      where: { entityId },
      create: {
        entityId,
        campaignId,
        goals: (data.goals ?? []) as Prisma.InputJsonValue,
        urgency: data.urgency ?? 0.5,
        resources: (data.resources ?? {}) as Prisma.InputJsonValue,
        riskTolerance: data.riskTolerance ?? 0.5,
      },
      update: {
        goals: data.goals ? (data.goals as Prisma.InputJsonValue) : undefined,
        urgency: data.urgency,
        resources: data.resources ? (data.resources as Prisma.InputJsonValue) : undefined,
        riskTolerance: data.riskTolerance,
      },
    });
  },

  async getActor(campaignId: string, entityId: string) {
    return prisma.worldActor.findUnique({
      where: { entityId },
    });
  },

  async listActors(campaignId: string) {
    return prisma.worldActor.findMany({
      where: { campaignId },
      include: { entity: true },
      orderBy: { urgency: 'desc' },
    });
  },

  async deleteActor(actorId: string) {
    return prisma.worldActor.delete({ where: { id: actorId } });
  },

  async createEvent(campaignId: string, data: {
    actorId?: string;
    type: string;
    description: string;
    causalChain?: unknown[];
  }) {
    return prisma.worldSimulationEvent.create({
      data: {
        campaignId,
        actorId: data.actorId ?? null,
        type: data.type,
        description: data.description,
        causalChain: (data.causalChain ?? []) as Prisma.InputJsonValue,
      },
    });
  },

  async listEvents(campaignId: string, opts?: { limit?: number; type?: string }) {
    return prisma.worldSimulationEvent.findMany({
      where: {
        campaignId,
        ...(opts?.type ? { type: opts.type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 50,
    });
  },

  async getSessionSeed(campaignId: string, limit = 3) {
    return prisma.worldSimulationEvent.findMany({
      where: { campaignId, type: 'threshold_trigger' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async updateActorLastTickAt(actorId: string) {
    return prisma.worldActor.update({
      where: { id: actorId },
      data: { lastTickAt: new Date() },
    });
  },
};
