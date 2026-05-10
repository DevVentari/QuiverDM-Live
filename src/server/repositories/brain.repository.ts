import { Prisma, WorldEntityType, WorldEntityStatus, WorldStateChangeType, WorldStateChangeSource } from '@prisma/client';
import { prisma } from '../db';
import { enqueueMeiliSyncSafe } from '@/lib/queue/meili-sync-queue';

export const brainRepository = {
  async findEntities(campaignId: string, opts?: { type?: WorldEntityType; status?: WorldEntityStatus; search?: string; limit?: number }) {
    const where: Prisma.WorldEntityWhereInput = { campaignId };
    if (opts?.type) where.type = opts.type;
    if (opts?.status) where.status = opts.status;
    if (opts?.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { description: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    return prisma.worldEntity.findMany({
      where,
      orderBy: { name: 'asc' },
      take: opts?.limit ?? 100,
      include: {
        mapPins: { select: { id: true, mapId: true, x: true, y: true }, take: 1 },
      },
    });
  },

  async findEntityById(id: string) {
    return prisma.worldEntity.findUnique({
      where: { id },
      include: {
        fromRelationships: { include: { toEntity: true } },
        toRelationships: { include: { fromEntity: true } },
        stateChanges: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  },

  async upsertEntity(campaignId: string, data: {
    type: WorldEntityType;
    name: string;
    aliases?: string[];
    description?: string;
    properties?: Record<string, unknown>;
    status?: WorldEntityStatus;
    sourceType?: string;
    sourceId?: string;
    firstSeenSessionId?: string;
    lastSeenSessionId?: string;
    confidence?: number;
  }) {
    const entity = await prisma.worldEntity.upsert({
      where: { campaignId_name_type: { campaignId, name: data.name, type: data.type } },
      create: { campaignId, ...data, aliases: data.aliases ?? [], properties: (data.properties ?? {}) as Prisma.InputJsonValue },
      update: {
        aliases: data.aliases ?? [],
        description: data.description,
        properties: (data.properties ?? {}) as Prisma.InputJsonValue,
        status: data.status,
        lastSeenSessionId: data.lastSeenSessionId,
        confidence: data.confidence,
        updatedAt: new Date(),
        // firstSeenSessionId is intentionally excluded — never overwrite on update
      },
    });
    enqueueMeiliSyncSafe({ kind: 'world_entity', op: 'upsert', id: entity.id });
    return entity;
  },

  async updateEntity(id: string, data: Partial<{
    name: string;
    aliases: string[];
    description: string;
    properties: Record<string, unknown>;
    status: WorldEntityStatus;
    lastSeenSessionId: string;
    confidence: number;
  }>) {
    const entity = await prisma.worldEntity.update({
      where: { id },
      data: {
        ...data,
        properties: data.properties ? (data.properties as Prisma.InputJsonValue) : undefined,
      },
    });
    enqueueMeiliSyncSafe({ kind: 'world_entity', op: 'upsert', id });
    return entity;
  },

  async deleteEntity(id: string) {
    const entity = await prisma.worldEntity.delete({ where: { id } });
    enqueueMeiliSyncSafe({ kind: 'world_entity', op: 'delete', id });
    return entity;
  },

  async findRelationships(campaignId: string, entityId?: string) {
    const where: Prisma.WorldRelationshipWhereInput = { campaignId };
    if (entityId) {
      where.OR = [{ fromEntityId: entityId }, { toEntityId: entityId }];
    }
    return prisma.worldRelationship.findMany({
      where,
      include: { fromEntity: true, toEntity: true },
      orderBy: { strength: 'desc' },
    });
  },

  async upsertRelationship(data: {
    campaignId: string;
    fromEntityId: string;
    toEntityId: string;
    type: string;
    strength?: number;
    description?: string;
  }) {
    return prisma.worldRelationship.upsert({
      where: { fromEntityId_toEntityId_type: { fromEntityId: data.fromEntityId, toEntityId: data.toEntityId, type: data.type } },
      create: { ...data, strength: data.strength ?? 0.5, history: [] },
      update: { strength: data.strength ?? 0.5, description: data.description, updatedAt: new Date() },
    });
  },

  async findRelationshipById(id: string) {
    return prisma.worldRelationship.findUnique({ where: { id } });
  },

  async deleteRelationship(id: string) {
    return prisma.worldRelationship.delete({ where: { id } });
  },

  async getOrCreateState(campaignId: string) {
    return prisma.worldState.upsert({
      where: { campaignId },
      create: { campaignId },
      update: {},
    });
  },

  async updateState(campaignId: string, data: Partial<{
    pressurePolitical: number;
    pressureSupernatural: number;
    pressureEconomic: number;
    pressureCosmic: number;
    pressureSocial: number;
    hooks: unknown[];
    threats: unknown[];
    lastIngestedSessionId: string;
    lastInferenceAt: Date;
  }>) {
    return prisma.worldState.upsert({
      where: { campaignId },
      create: { campaignId, ...data, hooks: (data.hooks ?? []) as Prisma.InputJsonValue, threats: (data.threats ?? []) as Prisma.InputJsonValue },
      update: { ...data, hooks: data.hooks ? (data.hooks as Prisma.InputJsonValue) : undefined, threats: data.threats ? (data.threats as Prisma.InputJsonValue) : undefined },
    });
  },

  async logChange(data: {
    campaignId: string;
    entityId?: string;
    sessionId?: string;
    changeType: WorldStateChangeType;
    previousValue?: unknown;
    newValue: unknown;
    triggerText?: string;
    source: WorldStateChangeSource;
  }) {
    return prisma.worldStateChange.create({
      data: {
        campaignId: data.campaignId,
        entityId: data.entityId,
        sessionId: data.sessionId,
        changeType: data.changeType,
        previousValue: data.previousValue ? (data.previousValue as Prisma.InputJsonValue) : undefined,
        newValue: data.newValue as Prisma.InputJsonValue,
        triggerText: data.triggerText,
        source: data.source,
      },
    });
  },

  async getTimeline(campaignId: string, limit = 50, entityId?: string) {
    return prisma.worldStateChange.findMany({
      where: { campaignId, ...(entityId ? { entityId } : {}) },
      include: { entity: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async getExistingNpcs(campaignId: string) {
    return prisma.nPC.findMany({
      where: { campaignId },
      select: { id: true, name: true, description: true, faction: true, role: true },
    });
  },

  async getExistingCharacters(campaignId: string) {
    return prisma.campaignCharacter.findMany({
      where: { campaignId },
      include: { character: { select: { id: true, name: true, class: true, background: true } } },
    });
  },

  async appendRelationshipHistory(relId: string, entry: { sessionId: string; description: string; timestamp: Date }) {
    const rel = await prisma.worldRelationship.findUnique({ where: { id: relId }, select: { history: true } });
    if (!rel) return;
    const history = Array.isArray(rel.history) ? rel.history as Array<Record<string, unknown>> : [];
    return prisma.worldRelationship.update({
      where: { id: relId },
      data: { history: [...history, { sessionId: entry.sessionId, description: entry.description, timestamp: entry.timestamp.toISOString() }] as Prisma.InputJsonValue },
    });
  },

  async recordAppearance(data: { sessionId: string; entityId: string; campaignId: string; role?: string }) {
    return prisma.sessionEntityAppearance.upsert({
      where: { sessionId_entityId: { sessionId: data.sessionId, entityId: data.entityId } },
      create: { sessionId: data.sessionId, entityId: data.entityId, campaignId: data.campaignId, role: data.role },
      update: { role: data.role },
    });
  },

  async getEntitySessionHistory(entityId: string) {
    return prisma.sessionEntityAppearance.findMany({
      where: { entityId },
      include: {
        session: { select: { id: true, sessionNumber: true, title: true, date: true } },
      },
      orderBy: { session: { date: 'asc' } },
    });
  },

  async getSessionEntities(sessionId: string) {
    return prisma.sessionEntityAppearance.findMany({
      where: { sessionId },
      include: {
        entity: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  },
};
