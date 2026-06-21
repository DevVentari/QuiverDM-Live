/**
 * Seed EncounterPlan rows from a campaign's EVENT/encounter entities, linking each
 * encounter's free-text monster list to real stat blocks (book-unique creatures →
 * SRD → custom) via the monster resolver. Turns static lore encounters into
 * runnable, launch-to-tracker plans.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { makeMonsterResolver, type CreatureSource, type ResolvedCreature } from './resolve-monster';

export interface EventEntity {
  name: string;
  description?: string | null;
  ddbChapterId?: string | null;
  properties: unknown;
}

export interface PlanCreatureSpec {
  name: string;
  count: number;
  cr?: string;
  xp?: number;
  sourceType: ResolvedCreature['sourceType'];
  sourceId?: string;
  statBlock?: Record<string, unknown>;
}

export interface EncounterPlanSpec {
  name: string;
  sceneDescription: string;
  difficulty: string;
  ddbChapterId: string | null;
  totalXp: number;
  creatures: PlanCreatureSpec[];
}

function encounterMonsters(props: unknown): string[] | null {
  const p = (props ?? {}) as { subtype?: string; monsters?: unknown };
  if (p.subtype !== 'encounter') return null;
  if (!Array.isArray(p.monsters) || p.monsters.length === 0) return null;
  return p.monsters.map(String);
}

/** Pure: turn EVENT entities into EncounterPlan specs (no DB). */
export function buildEncounterPlanSpecs(
  events: EventEntity[],
  resolve: (raw: string) => ResolvedCreature,
): EncounterPlanSpec[] {
  const specs: EncounterPlanSpec[] = [];
  for (const e of events) {
    const monsters = encounterMonsters(e.properties);
    if (!monsters) continue;

    // Group identical resolved creatures into a count.
    const groups = new Map<string, { resolved: ResolvedCreature; count: number }>();
    for (const raw of monsters) {
      const resolved = resolve(raw);
      const key = resolved.sourceId ?? `${resolved.sourceType}:${resolved.name.toLowerCase()}`;
      const g = groups.get(key);
      if (g) g.count += 1;
      else groups.set(key, { resolved, count: 1 });
    }

    const creatures: PlanCreatureSpec[] = [...groups.values()].map(({ resolved, count }) => ({
      name: resolved.name,
      count,
      cr: resolved.cr,
      xp: resolved.xp,
      sourceType: resolved.sourceType,
      sourceId: resolved.sourceId,
      statBlock: resolved.statBlock,
    }));

    const props = (e.properties ?? {}) as { difficulty?: string };
    const totalXp = creatures.reduce((sum, c) => sum + (c.xp ?? 0) * c.count, 0);

    specs.push({
      name: e.name,
      sceneDescription: e.description ?? '',
      difficulty: typeof props.difficulty === 'string' && props.difficulty ? props.difficulty : 'medium',
      ddbChapterId: e.ddbChapterId ?? null,
      totalXp,
      creatures,
    });
  }
  return specs;
}

export interface SeedResult {
  plansCreated: number;
  plansSkipped: number;
  creaturesLinked: number;
  bySource: { srd: number; homebrew: number; custom: number };
}

/**
 * Seed EncounterPlans for a campaign from its EVENT entities. Idempotent: skips
 * events that already have a same-named plan. Dry-run unless { write: true }.
 */
export async function seedEncounterPlansFromWorldEvents(
  campaignId: string,
  opts: { write?: boolean } = {},
): Promise<SeedResult> {
  const links = await prisma.campaignHomebrewContent.findMany({
    where: { campaignId, homebrew: { type: 'creature' } },
    select: { homebrew: { select: { id: true, name: true, data: true } } },
  });
  const sources: CreatureSource[] = links.map((l) => {
    const d = (l.homebrew.data ?? {}) as Record<string, unknown>;
    return {
      name: l.homebrew.name,
      id: l.homebrew.id,
      cr: typeof d.cr === 'number' || typeof d.cr === 'string' ? (d.cr as number | string) : undefined,
      xp: typeof d.xp === 'number' ? d.xp : undefined,
      statBlock: d,
    };
  });
  const resolve = makeMonsterResolver(sources);

  const events = await prisma.worldEntity.findMany({
    where: { campaignId, type: 'EVENT' },
    select: { name: true, description: true, properties: true, ddbChapterId: true },
  });
  const specs = buildEncounterPlanSpecs(events as EventEntity[], resolve);

  const existing = new Set(
    (await prisma.encounterPlan.findMany({ where: { campaignId }, select: { name: true } })).map((p) => p.name),
  );

  const result: SeedResult = { plansCreated: 0, plansSkipped: 0, creaturesLinked: 0, bySource: { srd: 0, homebrew: 0, custom: 0 } };

  for (const spec of specs) {
    if (existing.has(spec.name)) { result.plansSkipped += 1; continue; }
    for (const c of spec.creatures) result.bySource[c.sourceType] += 1;
    result.creaturesLinked += spec.creatures.length;

    if (opts.write) {
      await prisma.encounterPlan.create({
        data: {
          campaignId,
          name: spec.name,
          sceneDescription: spec.sceneDescription || null,
          difficulty: spec.difficulty,
          ddbChapterId: spec.ddbChapterId,
          totalXp: spec.totalXp || null,
          creatures: {
            create: spec.creatures.map((c) => ({
              name: c.name,
              count: c.count,
              cr: c.cr ?? null,
              xp: c.xp ?? null,
              sourceType: c.sourceType,
              sourceId: c.sourceId ?? null,
              statBlock: (c.statBlock ?? undefined) as Prisma.InputJsonValue,
            })),
          },
        },
      });
    }
    result.plansCreated += 1;
  }
  return result;
}
