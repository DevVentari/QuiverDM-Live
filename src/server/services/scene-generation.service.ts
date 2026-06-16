/**
 * Server-side glue for AI scene generation: gathers prompt context from the
 * compendium + party, and merges (re)generated output into a Scene update.
 */
import { prisma } from '@/lib/prisma';
import type { GeneratedScene, SceneContext, SceneType } from '@/lib/ai/generate-scene';
import { Prisma } from '@prisma/client';

export type RegenSection = 'all' | 'readAloud' | 'dmNotes' | 'checks' | 'music';

export interface SceneFormInput {
  intent: string;
  mood?: SceneType;
  linkedEntityIds: string[];
  partyPresentIds: string[];
}

/** Load tagged WorldEntities + party characters into a prompt context. */
export async function gatherSceneContext(
  campaignId: string,
  input: SceneFormInput,
): Promise<SceneContext> {
  const [campaign, entities, party] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId }, select: { name: true } }),
    input.linkedEntityIds.length
      ? prisma.worldEntity.findMany({
          where: { id: { in: input.linkedEntityIds }, campaignId },
          select: {
            id: true, name: true, type: true, description: true,
            statBlock: { select: { name: true, data: true } },
          },
        })
      : Promise.resolve([]),
    input.partyPresentIds.length
      ? prisma.character.findMany({
          where: { id: { in: input.partyPresentIds }, campaignCharacters: { some: { campaignId } } },
          select: { id: true, name: true, race: true, class: true, level: true },
        })
      : Promise.resolve([]),
  ]);

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
    })),
    party: party.map((c) => ({
      name: c.name,
      summary: [c.race, c.class, c.level != null ? `lvl ${c.level}` : null].filter(Boolean).join(' '),
    })),
  };
}

function statSummary(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  const cr = d.cr ?? d.challengeRating;
  return cr != null ? `CR ${cr}` : undefined;
}

/** Build a Prisma Scene update patch for the chosen regenerate section. */
export function applyRegeneration(
  _current: unknown,
  gen: GeneratedScene,
  section: RegenSection,
): Prisma.SceneUpdateInput {
  const all: Prisma.SceneUpdateInput = {
    title: gen.title,
    type: gen.type,
    description: gen.readAloud,
    dmNotes: gen.dmNotes,
    musicCue: gen.musicCue,
    suggestedChecks: gen.suggestedChecks as Prisma.InputJsonValue,
    entityBeats: gen.entityBeats as Prisma.InputJsonValue,
  };
  switch (section) {
    case 'all': return all;
    case 'readAloud': return { description: gen.readAloud };
    case 'dmNotes': return { dmNotes: gen.dmNotes, entityBeats: gen.entityBeats as Prisma.InputJsonValue };
    case 'checks': return { suggestedChecks: gen.suggestedChecks as Prisma.InputJsonValue };
    case 'music': return { musicCue: gen.musicCue };
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}
