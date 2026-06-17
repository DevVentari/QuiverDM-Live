/**
 * Server-side glue for AI scene generation: gathers prompt context from the
 * compendium + party, and merges (re)generated output into a Scene update.
 */
import { prisma } from '@/lib/prisma';
import type { SceneContext, SceneType } from '@/lib/ai/generate-scene';

export interface SceneFormInput {
  intent: string;
  mood?: SceneType;
  linkedEntityIds: string[];
  partyPresentIds: string[];
}

/** The body of the scene's primary read-aloud: lowest orderIndex, ties by createdAt. */
export function primaryReadAloud(
  notes: Array<{ type: string; body: string; orderIndex: number; createdAt: Date }>,
): string | null {
  const ra = notes
    .filter((n) => n.type === 'read_aloud')
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.getTime() - b.createdAt.getTime());
  return ra[0]?.body ?? null;
}

/** Load tagged WorldEntities + party characters into a prompt context. */
export async function gatherSceneContext(
  campaignId: string,
  input: SceneFormInput,
): Promise<SceneContext> {
  const [campaign, entities, party, changes] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId }, select: { name: true } }),
    input.linkedEntityIds.length
      ? prisma.worldEntity.findMany({
          where: { id: { in: input.linkedEntityIds }, campaignId },
          select: { id: true, name: true, type: true, description: true, statBlock: { select: { name: true, data: true } } },
        })
      : Promise.resolve([]),
    input.partyPresentIds.length
      ? prisma.character.findMany({
          where: { id: { in: input.partyPresentIds }, campaignCharacters: { some: { campaignId } } },
          select: { id: true, name: true, race: true, class: true, level: true, bonds: true, flaws: true },
        })
      : Promise.resolve([]),
    input.linkedEntityIds.length
      ? prisma.worldStateChange.findMany({
          where: { entityId: { in: input.linkedEntityIds }, campaignId, triggerText: { not: null } },
          select: { entityId: true, triggerText: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 40,
        })
      : Promise.resolve([]),
  ]);

  const historyByEntity = new Map<string, string[]>();
  for (const c of changes) {
    if (!c.entityId || !c.triggerText) continue;
    const arr = historyByEntity.get(c.entityId) ?? [];
    if (arr.length < 4) { arr.push(c.triggerText); historyByEntity.set(c.entityId, arr); }
  }

  return {
    intent: input.intent,
    mood: input.mood,
    campaignName: campaign?.name,
    tagged: entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: String(e.type),
      description: e.description ?? undefined,
      statSummary: e.statBlock ? statSummary(e.statBlock.data) : undefined,
      history: historyByEntity.get(e.id),
    })),
    party: party.map((c) => ({
      name: c.name,
      summary: [c.race, c.class, c.level != null ? `lvl ${c.level}` : null].filter(Boolean).join(' '),
      hook: c.bonds?.trim() || c.flaws?.trim() || undefined,
    })),
  };
}

function statSummary(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  const cr = d.cr ?? d.challengeRating;
  return cr != null ? `CR ${cr}` : undefined;
}
