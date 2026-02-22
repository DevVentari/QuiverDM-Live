import { prisma } from '../db';

const prismaAny = prisma as any;

const participantSelect = {
  id: true,
  name: true,
  type: true,
  npcId: true,
  initiative: true,
  hp: true,
  maxHp: true,
  conditions: true,
  isAlive: true,
};

export const encounterRepository = {
  findBySession: (sessionId: string) =>
    prismaAny.encounter.findMany({
      where: { sessionId },
      include: {
        participants: {
          select: participantSelect,
          orderBy: { initiative: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

  findById: (id: string) =>
    prismaAny.encounter.findUnique({
      where: { id },
      include: {
        participants: {
          select: participantSelect,
          orderBy: { initiative: 'desc' },
        },
      },
    }),

  create: (data: { sessionId: string; name: string }) =>
    prismaAny.encounter.create({
      data,
      include: {
        participants: {
          select: participantSelect,
          orderBy: { initiative: 'desc' },
        },
      },
    }),

  update: (
    id: string,
    data: { name?: string; round?: number; status?: string; log?: unknown }
  ) => prismaAny.encounter.update({ where: { id }, data }),

  addParticipant: (data: {
    encounterId: string;
    name: string;
    type: string;
    initiative: number;
    hp: number;
    maxHp: number;
    npcId?: string;
  }) => prismaAny.encounterParticipant.create({ data }),

  updateParticipant: (
    id: string,
    data: {
      hp?: number;
      maxHp?: number;
      initiative?: number;
      conditions?: string[];
      isAlive?: boolean;
      name?: string;
    }
  ) =>
    prismaAny.encounterParticipant.update({
      where: { id },
      data: {
        hp: data.hp,
        maxHp: data.maxHp,
        initiative: data.initiative,
        isAlive: data.isAlive,
        name: data.name,
        ...(data.conditions !== undefined ? { conditions: data.conditions } : {}),
      },
    }),

  deleteParticipant: (id: string) => prismaAny.encounterParticipant.delete({ where: { id } }),

  delete: (id: string) => prismaAny.encounter.delete({ where: { id } }),
};
