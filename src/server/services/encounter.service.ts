import { authz } from './authorization.service';
import { encounterRepository } from '../repositories/encounter.repository';
import { prisma } from '../db';
import { ForbiddenError, NotFoundError } from '../errors';
// Single source of truth for the 5e condition set (shared with the combat UIs
// and the Compendium). See src/lib/srd/conditions.ts.
import { CONDITION_NAMES } from '../../lib/srd/conditions';

export class EncounterService {
  async getBySession(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).verify();
    return encounterRepository.findBySession(sessionId);
  }

  async create(sessionId: string, userId: string, name: string) {
    const access = await authz.session(sessionId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('create encounters', 'session');
    }
    return encounterRepository.create({ sessionId, name });
  }

  async addParticipant(
    encounterId: string,
    userId: string,
    data: {
      name: string;
      type: string;
      initiative: number;
      hp: number;
      maxHp: number;
      npcId?: string;
    }
  ) {
    const encounter = await encounterRepository.findById(encounterId);
    if (!encounter) {
      throw new NotFoundError('encounter', encounterId);
    }

    const access = await authz.session(encounter.sessionId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('manage participants', 'encounter');
    }

    return encounterRepository.addParticipant({ encounterId, ...data });
  }

  async updateParticipant(
    participantId: string,
    userId: string,
    data: {
      hp?: number;
      maxHp?: number;
      initiative?: number;
      conditions?: string[];
      isAlive?: boolean;
      name?: string;
    }
  ) {
    const participant = await (prisma as any).encounterParticipant.findUnique({
      where: { id: participantId },
      include: {
        encounter: {
          select: {
            sessionId: true,
          },
        },
      },
    });

    if (!participant) {
      throw new NotFoundError('participant', participantId);
    }

    const access = await authz.session(participant.encounter.sessionId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('manage participants', 'encounter');
    }

    return encounterRepository.updateParticipant(participantId, data);
  }

  async deleteParticipant(participantId: string, userId: string) {
    const participant = await (prisma as any).encounterParticipant.findUnique({
      where: { id: participantId },
      include: {
        encounter: {
          select: {
            sessionId: true,
          },
        },
      },
    });

    if (!participant) {
      throw new NotFoundError('participant', participantId);
    }

    const access = await authz.session(participant.encounter.sessionId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('manage participants', 'encounter');
    }

    await encounterRepository.deleteParticipant(participantId);
    return { success: true };
  }

  async nextRound(encounterId: string, userId: string) {
    const encounter = await encounterRepository.findById(encounterId);
    if (!encounter) {
      throw new NotFoundError('encounter', encounterId);
    }

    const access = await authz.session(encounter.sessionId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('manage encounters', 'session');
    }

    const newRound = encounter.round + 1;
    const roundSummary = `\n\n**Round ${newRound} started** (${encounter.name})`;

    const session = await prisma.gameSession.findUnique({
      where: { id: encounter.sessionId },
      select: { quickNotes: true },
    });

    await prisma.gameSession.update({
      where: { id: encounter.sessionId },
      data: {
        quickNotes: `${session?.quickNotes ?? ''}${roundSummary}`,
      },
    });

    return encounterRepository.update(encounterId, { round: newRound });
  }

  async complete(encounterId: string, userId: string) {
    const encounter = await encounterRepository.findById(encounterId);
    if (!encounter) {
      throw new NotFoundError('encounter', encounterId);
    }

    const access = await authz.session(encounter.sessionId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('manage encounters', 'session');
    }

    return encounterRepository.update(encounterId, { status: 'complete' });
  }

  async delete(encounterId: string, userId: string) {
    const encounter = await encounterRepository.findById(encounterId);
    if (!encounter) {
      throw new NotFoundError('encounter', encounterId);
    }

    const access = await authz.session(encounter.sessionId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('manage encounters', 'session');
    }

    await encounterRepository.delete(encounterId);
    return { success: true };
  }

  getDnd5eConditions(): string[] {
    return [...CONDITION_NAMES];
  }
}

export const encounterService = new EncounterService();
