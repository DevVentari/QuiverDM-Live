/**
 * Heartflame service — runs the predicate engine over a live encounter and
 * stores the resulting nudges for delivery.
 *
 * Orchestration only; all logic lives in the pure `src/lib/heartflame` core.
 * Rotation cursors and nudges are cached in Redis per encounter (1h TTL),
 * mirroring the Co-DM suggestion store.
 *
 * Note: feature-derived predicates (e.g. Crimson Rite) need the character's
 * feature toggles, which are not yet wired — `features` defaults to none, so
 * only action-economy / concentration rules fire for now. Feature mapping is a
 * follow-up once participants are linked to character sheets.
 */
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import {
  evaluate,
  primaryNudge,
  toSurfaced,
  reskinSurfaced,
  participantToActorState,
  DEFAULT_RULES,
  type Cursors,
  type FiredNudge,
  type SurfacedNudge,
} from '@/lib/heartflame';

const NUDGE_TTL_SECONDS = 60 * 60; // 1 hour, matches co-dm:*:suggestions

const cursorsKey = (encounterId: string) => `heartflame:${encounterId}:cursors`;
const nudgesKey = (encounterId: string) => `heartflame:${encounterId}:nudges`;

async function readCursors(encounterId: string): Promise<Cursors> {
  const raw = await redis.get(cursorsKey(encounterId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Cursors;
  } catch {
    return {};
  }
}

/**
 * Evaluate every participant in an encounter, advance rotation, persist the
 * cursors + surfaced nudges, and return them. Returns [] if the encounter is
 * missing.
 */
export interface EvaluateOptions {
  /** Re-word the primary nudge's line via the fact-safe AI re-skin (falls back to the authored line). */
  reskinPrimary?: boolean;
}

export async function evaluateEncounter(
  encounterId: string,
  opts: EvaluateOptions = {},
): Promise<SurfacedNudge[]> {
  const encounter = await (prisma as any).encounter.findUnique({
    where: { id: encounterId },
    select: {
      status: true,
      participants: {
        select: {
          id: true,
          name: true,
          hp: true,
          maxHp: true,
          tempHp: true,
          conditions: true,
          actionUsed: true,
          bonusActionUsed: true,
          reactionUsed: true,
          concentration: true,
          isAlive: true,
        },
      },
    },
  });

  if (!encounter) return [];

  const inCombat = encounter.status === 'active';
  let cursors = await readCursors(encounterId);

  const fired: FiredNudge[] = [];
  for (const participant of encounter.participants) {
    const actor = participantToActorState(participant, { inCombat });
    const result = evaluate(actor, DEFAULT_RULES, cursors);
    cursors = result.cursors;
    fired.push(...result.nudges);
  }

  let surfaced = fired.map(toSurfaced);

  // Optional fact-safe AI re-skin of the single surfaced (primary) nudge.
  if (opts.reskinPrimary && surfaced.length > 0) {
    const primary = primaryNudge(surfaced) as SurfacedNudge | null;
    if (primary) {
      const reworded = await reskinSurfaced(primary);
      surfaced = surfaced.map((n) => (n === primary ? reworded : n));
    }
  }

  await redis.set(cursorsKey(encounterId), JSON.stringify(cursors), 'EX', NUDGE_TTL_SECONDS);
  await redis.set(nudgesKey(encounterId), JSON.stringify(surfaced), 'EX', NUDGE_TTL_SECONDS);

  return surfaced;
}

/** Read the last-computed nudges for an encounter (without re-evaluating). */
export async function getEncounterNudges(encounterId: string): Promise<SurfacedNudge[]> {
  const raw = await redis.get(nudgesKey(encounterId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SurfacedNudge[];
  } catch {
    return [];
  }
}

/** The single nudge to surface on the Heartflame perch (risk > opportunity > option-unused). */
export function primarySurfaced(nudges: SurfacedNudge[]): SurfacedNudge | null {
  return primaryNudge(nudges) as SurfacedNudge | null;
}
