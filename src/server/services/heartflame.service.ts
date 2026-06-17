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
import { NotFoundError } from '@/server/errors';
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
  mapX: true,
  mapY: true,
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
  /** Battle-map token position in React Flow flow-coordinates; null until placed/dragged. */
  mapX: number | null;
  mapY: number | null;
}

/** A persisted fog-of-war rectangle (% coords). */
export interface FogRegionView {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EncounterBoard {
  id: string;
  name: string;
  round: number;
  status: string;
  mapImageUrl: string | null;
  participants: BoardParticipant[];
  fogRegions: FogRegionView[];
}

/**
 * Find the campaign's live encounter and return its board. An encounter belongs
 * to a session, which belongs to a campaign — so the "active" encounter is the
 * most-recently-touched `active` encounter across the campaign's sessions.
 * Membership-scoped: returns null if the user isn't a member or none is active.
 */
export async function getActiveBoardForCampaign(
  campaignId: string,
  userId: string,
): Promise<EncounterBoard | null> {
  const encounter = await (prisma as any).encounter.findFirst({
    where: {
      status: 'active',
      session: { campaignId, campaign: { members: { some: { userId } } } },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (!encounter) return null;
  return getEncounterForBoard(encounter.id);
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
      mapImageUrl: true,
      participants: {
        select: BOARD_PARTICIPANT_SELECT,
        orderBy: { initiative: 'desc' },
      },
      fogRegions: {
        select: { id: true, x: true, y: true, width: true, height: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

/**
 * Throw unless `userId` is a member of the encounter's campaign. Used by all the
 * battle-map mutations (token drag, fog paint) which are otherwise gated only to
 * authenticated users by the router.
 */
async function assertEncounterMember(encounterId: string, userId: string): Promise<void> {
  const ok = await (prisma as any).encounter.findFirst({
    where: { id: encounterId, session: { campaign: { members: { some: { userId } } } } },
    select: { id: true },
  });
  if (!ok) throw new NotFoundError('encounter', encounterId);
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Persist a token's battle-map position (% coords). Does NOT re-evaluate nudges —
 * position has no bearing on the predicate engine, so dragging stays cheap.
 */
export async function setTokenPosition(
  participantId: string,
  x: number,
  y: number,
  userId: string,
): Promise<{ encounterId: string }> {
  const p = await (prisma as any).encounterParticipant.findUnique({
    where: { id: participantId },
    select: { encounterId: true },
  });
  if (!p) throw new NotFoundError('participant', participantId);
  await assertEncounterMember(p.encounterId, userId);
  await (prisma as any).encounterParticipant.update({
    where: { id: participantId },
    data: { mapX: x, mapY: y },
  });
  return { encounterId: p.encounterId };
}

/** Add one hidden fog rectangle to an encounter's battle map. */
export async function addFogRegion(
  encounterId: string,
  region: { x: number; y: number; width: number; height: number },
  userId: string,
): Promise<FogRegionView> {
  await assertEncounterMember(encounterId, userId);
  const created = await (prisma as any).fogRegion.create({
    data: {
      encounterId,
      x: clampPct(region.x),
      y: clampPct(region.y),
      width: clampPct(region.width),
      height: clampPct(region.height),
    },
    select: { id: true, x: true, y: true, width: true, height: true },
  });
  return created;
}

/** Reveal (delete) a single fog region. */
export async function removeFogRegion(regionId: string, userId: string): Promise<{ ok: true }> {
  const r = await (prisma as any).fogRegion.findUnique({
    where: { id: regionId },
    select: { encounterId: true },
  });
  if (r) {
    await assertEncounterMember(r.encounterId, userId);
    await (prisma as any).fogRegion.delete({ where: { id: regionId } });
  }
  return { ok: true };
}

/** Cover the whole map: clear existing fog and add one full-canvas region. */
export async function coverAllFog(encounterId: string, userId: string): Promise<FogRegionView> {
  await assertEncounterMember(encounterId, userId);
  await (prisma as any).fogRegion.deleteMany({ where: { encounterId } });
  return (prisma as any).fogRegion.create({
    data: { encounterId, x: 0, y: 0, width: 100, height: 100 },
    select: { id: true, x: true, y: true, width: true, height: true },
  });
}

/** Reveal everything: clear all fog regions for the encounter. */
export async function revealAllFog(encounterId: string, userId: string): Promise<{ ok: true }> {
  await assertEncounterMember(encounterId, userId);
  await (prisma as any).fogRegion.deleteMany({ where: { encounterId } });
  return { ok: true };
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
