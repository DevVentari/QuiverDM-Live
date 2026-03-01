import { prisma } from '../db';
import { NotFoundError } from '../errors';

export const sessionStateService = {
  async initForSession(sessionId: string) {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { campaignId: true },
    });
    if (!session) throw new NotFoundError('session', sessionId);

    const characters = await prisma.character.findMany({
      where: { campaignCharacters: { some: { campaignId: session.campaignId } } },
      select: { id: true, hitPoints: true },
    });

    for (const char of characters) {
      const maxHp = (char.hitPoints as any)?.maximum ?? 10;
      await prisma.characterSessionState.upsert({
        where: { sessionId_characterId: { sessionId, characterId: char.id } },
        create: { sessionId, characterId: char.id, currentHp: maxHp },
        update: {},
      });
    }
  },

  async getStates(sessionId: string) {
    return prisma.characterSessionState.findMany({
      where: { sessionId },
      include: { character: { select: { id: true, name: true, armorClass: true } } },
    });
  },

  async getAllEvents(sessionId: string) {
    return prisma.sessionMechanicalEvent.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async reviewEvent(eventId: string, action: 'confirm' | 'reject') {
    return prisma.sessionMechanicalEvent.update({
      where: { id: eventId },
      data: {
        status: action === 'reject' ? 'rejected' : 'confirmed',
        ...(action === 'confirm' ? { appliedAt: new Date() } : {}),
      },
    });
  },

  async commitSessionEvents(sessionId: string) {
    const events = await prisma.sessionMechanicalEvent.findMany({
      where: { sessionId, status: { in: ['confirmed', 'auto_applied'] } },
      select: { id: true, characterId: true, eventType: true, eventData: true },
    });

    for (const event of events) {
      if (!event.characterId) continue;
      const data = event.eventData as Record<string, unknown>;

      if (event.eventType === 'damage' && typeof data.amount === 'number') {
        const char = await prisma.character.findUnique({
          where: { id: event.characterId },
          select: { hitPoints: true },
        });
        const hp = char?.hitPoints as any;
        if (hp && typeof hp.current === 'number') {
          await prisma.character.update({
            where: { id: event.characterId },
            data: { hitPoints: { ...hp, current: Math.max(0, hp.current - data.amount) } },
          });
        }
      } else if (event.eventType === 'healing' && typeof data.amount === 'number') {
        const char = await prisma.character.findUnique({
          where: { id: event.characterId },
          select: { hitPoints: true },
        });
        const hp = char?.hitPoints as any;
        if (hp && typeof hp.current === 'number' && typeof hp.maximum === 'number') {
          await prisma.character.update({
            where: { id: event.characterId },
            data: { hitPoints: { ...hp, current: Math.min(hp.maximum, hp.current + data.amount) } },
          });
        }
      }
    }
  },
};
