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

const REDIS_OP_TIMEOUT_MS = 2000;

const cursorsKey = (encounterId: string) => `heartflame:${encounterId}:cursors`;
const nudgesKey = (encounterId: string) => `heartflame:${encounterId}:nudges`;

/**
 * Best-effort Redis: resolves to `fallback` if the op rejects or exceeds the
 * timeout. Redis here is a cache (rotation continuity + last nudges), never the
 * source of truth, so an outage degrades to "compute fresh, skip cache" instead
 * of hanging the request.
 */
function bestEffort<T>(op: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    op.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), REDIS_OP_TIMEOUT_MS)),
  ]);
}

async function readCursors(encounterId: string): Promise<Cursors> {
  const raw = await bestEffort(redis.get(cursorsKey(encounterId)), null);
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

  await bestEffort(redis.set(cursorsKey(encounterId), JSON.stringify(cursors), 'EX', NUDGE_TTL_SECONDS), null);
  await bestEffort(redis.set(nudgesKey(encounterId), JSON.stringify(surfaced), 'EX', NUDGE_TTL_SECONDS), null);

  return surfaced;
}

/** Read the last-computed nudges for an encounter (without re-evaluating). */
export async function getEncounterNudges(encounterId: string): Promise<SurfacedNudge[]> {
  const raw = await bestEffort(redis.get(nudgesKey(encounterId)), null);
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

// ── Combat board (v3 combat tracker) ─────────────────────────────────────────

const BOARD_PARTICIPANT_SELECT = {
  id: true,
  name: true,
  type: true,
  hp: true,
  maxHp: true,
  tempHp: true,
  conditions: true,
  initiative: true,
  isAlive: true,
  actionUsed: true,
  bonusActionUsed: true,
  reactionUsed: true,
  concentration: true,
} as const;

export interface BoardParticipant {
  id: string;
  name: string;
  type: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  conditions: unknown;
  initiative: number;
  isAlive: boolean;
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  concentration: boolean;
}

export interface EncounterBoard {
  id: string;
  name: string;
  round: number;
  status: string;
  participants: BoardParticipant[];
}

/** Load an encounter + its participants (with action-economy fields) for the tracker. */
export async function getEncounterForBoard(encounterId: string): Promise<EncounterBoard | null> {
  return (prisma as any).encounter.findUnique({
    where: { id: encounterId },
    select: {
      id: true,
      name: true,
      round: true,
      status: true,
      participants: {
        select: BOARD_PARTICIPANT_SELECT,
        orderBy: { initiative: 'desc' },
      },
    },
  });
}

export interface ParticipantStatePatch {
  hp?: number;
  tempHp?: number;
  conditions?: string[];
  isAlive?: boolean;
  actionUsed?: boolean;
  bonusActionUsed?: boolean;
  reactionUsed?: boolean;
  concentration?: boolean;
}

/** Update one participant, then re-evaluate the encounter. Returns fresh nudges. */
export async function setParticipantState(
  participantId: string,
  patch: ParticipantStatePatch,
): Promise<{ encounterId: string; nudges: SurfacedNudge[] }> {
  const updated = await (prisma as any).encounterParticipant.update({
    where: { id: participantId },
    data: patch,
    select: { encounterId: true },
  });
  const nudges = await evaluateEncounter(updated.encounterId);
  return { encounterId: updated.encounterId, nudges };
}

// Idempotent demo encounter so /v3/combat always has something to drive.
const DEMO_ENCOUNTER_NAME = 'Heartflame Demo';
const DEMO_PARTY: Array<Partial<BoardParticipant> & { name: string; hp: number; maxHp: number }> = [
  { name: 'Norm Alfella', type: 'pc', hp: 31, maxHp: 38 },
  { name: 'Oriyen Vale', type: 'pc', hp: 14, maxHp: 30, concentration: true },
  { name: 'Skreek Swicschnout', type: 'pc', hp: 26, maxHp: 28 },
];

/** Find-or-create the demo encounter and return its board. Dev convenience. */
export async function getOrCreateDemoBoard(): Promise<EncounterBoard | null> {
  const existing = await (prisma as any).encounter.findFirst({
    where: { name: DEMO_ENCOUNTER_NAME },
    select: { id: true },
  });
  if (existing) return getEncounterForBoard(existing.id);

  const campaign = await prisma.campaign.findFirst({ select: { id: true } });
  if (!campaign) throw new Error('no campaign in DB to attach a demo encounter to');

  let session = await prisma.gameSession.findFirst({
    where: { campaignId: campaign.id },
    select: { id: true },
  });
  if (!session) {
    session = await prisma.gameSession.create({
      data: { campaignId: campaign.id, sessionNumber: 900 },
      select: { id: true },
    });
  }

  const encounter: any = await (prisma as any).encounter.create({
    data: { sessionId: session.id, name: DEMO_ENCOUNTER_NAME, status: 'active' },
    select: { id: true },
  });

  let initiative = 20;
  for (const p of DEMO_PARTY) {
    await (prisma as any).encounterParticipant.create({
      data: {
        encounterId: encounter.id,
        name: p.name,
        type: p.type ?? 'pc',
        hp: p.hp,
        maxHp: p.maxHp,
        initiative,
        concentration: p.concentration ?? false,
      },
    });
    initiative -= 3;
  }

  return getEncounterForBoard(encounter.id);
}
