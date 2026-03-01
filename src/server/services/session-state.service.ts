import { prisma } from '../db';
import { NotFoundError, ForbiddenError } from '../errors';

async function applyEvent(
  sessionId: string,
  characterId: string,
  eventType: string,
  eventData: Record<string, unknown>
) {
  const state = await prisma.characterSessionState.findUnique({
    where: { sessionId_characterId: { sessionId, characterId } },
  });
  if (!state) return;

  const updates: Record<string, unknown> = {};

  if (eventType === 'damage' && typeof eventData.amount === 'number') {
    updates.currentHp = Math.max(0, state.currentHp - eventData.amount);
  } else if (eventType === 'healing' && typeof eventData.amount === 'number') {
    const char = await prisma.character.findUnique({
      where: { id: characterId },
      select: { hitPoints: true },
    });
    const maxHp = (char?.hitPoints as any)?.max ?? state.currentHp + eventData.amount;
    updates.currentHp = Math.min(maxHp, state.currentHp + eventData.amount);
  } else if (eventType === 'condition_applied' && typeof eventData.condition === 'string') {
    const conditions = state.conditionsActive as string[];
    if (!conditions.includes(eventData.condition)) {
      updates.conditionsActive = [...conditions, eventData.condition];
    }
  } else if (eventType === 'condition_removed' && typeof eventData.condition === 'string') {
    const conditions = state.conditionsActive as string[];
    updates.conditionsActive = conditions.filter((c) => c !== eventData.condition);
  } else if (eventType === 'spell_slot_used' && typeof eventData.level === 'number') {
    const slots = state.spellSlotsUsed as Record<string, number>;
    const level = String(eventData.level);
    updates.spellSlotsUsed = { ...slots, [level]: (slots[level] ?? 0) + 1 };
  } else if (eventType === 'spell_applied') {
    const spells = state.activeSpells as any[];
    updates.activeSpells = [
      ...spells,
      {
        spellName: eventData.spellName,
        casterName: eventData.casterName,
        concentration: eventData.concentration,
        duration: eventData.duration,
      },
    ];
  }

  if (Object.keys(updates).length > 0) {
    await prisma.characterSessionState.update({
      where: { sessionId_characterId: { sessionId, characterId } },
      data: updates,
    });
  }
}

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
      const maxHp = (char.hitPoints as any)?.max ?? 10;
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

  async reviewEvent(eventId: string, action: 'confirm' | 'reject', campaignId: string) {
    // Verify event belongs to a session in this campaign
    const event = await prisma.sessionMechanicalEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        sessionId: true,
        characterId: true,
        eventType: true,
        eventData: true,
        session: { select: { campaignId: true } },
      },
    });
    if (!event) throw new NotFoundError('event', eventId);
    if (event.session.campaignId !== campaignId) {
      throw ForbiddenError.forPermission('review', 'event');
    }

    await prisma.sessionMechanicalEvent.update({
      where: { id: eventId },
      data: {
        status: action === 'reject' ? 'rejected' : 'confirmed',
        ...(action === 'confirm' ? { appliedAt: new Date() } : {}),
      },
    });

    if (action === 'confirm' && event.characterId) {
      await applyEvent(
        event.sessionId,
        event.characterId,
        event.eventType,
        event.eventData as Record<string, unknown>
      );
    }
  },

  async commitSessionEvents(sessionId: string) {
    const events = await prisma.sessionMechanicalEvent.findMany({
      where: { sessionId, status: { in: ['confirmed', 'auto_applied'] } },
      select: { id: true, characterId: true, eventType: true, eventData: true },
    });

    // Group by characterId to avoid TOCTOU races on HP
    const byCharacter = new Map<string, typeof events>();
    for (const event of events) {
      if (!event.characterId) continue;
      const existing = byCharacter.get(event.characterId) ?? [];
      existing.push(event);
      byCharacter.set(event.characterId, existing);
    }

    for (const [characterId, charEvents] of byCharacter) {
      const char = await prisma.character.findUnique({
        where: { id: characterId },
        select: { hitPoints: true },
      });
      const hp = char?.hitPoints as any;
      if (!hp || typeof hp.current !== 'number') continue;

      let current = hp.current;
      const maximum: number = hp.max ?? hp.maximum ?? current;

      for (const event of charEvents) {
        const data = event.eventData as Record<string, unknown>;
        if (event.eventType === 'damage' && typeof data.amount === 'number') {
          current = Math.max(0, current - data.amount);
        } else if (event.eventType === 'healing' && typeof data.amount === 'number') {
          current = Math.min(maximum, current + data.amount);
        }
      }

      await prisma.character.update({
        where: { id: characterId },
        data: { hitPoints: { ...hp, current } },
      });
    }
  },
};
