/**
 * Heartflame — board-state mapping.
 *
 * Pure functions that turn a combat participant (the EncounterParticipant
 * action-economy fields) into the `ActorState` the predicate engine consumes.
 * Kept Prisma-agnostic (plain input shape) so it is unit-testable without a DB.
 */
import type { ActorState, FeatureState } from './types';

/** Minimal participant shape the mapper needs — a structural subset of EncounterParticipant. */
export interface ParticipantInput {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  /** Prisma Json column — expected to be a string[] of D&D 5e conditions. */
  conditions: unknown;
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  concentration: boolean;
  isAlive: boolean;
}

export interface MapOptions {
  /** Whether the encounter is live (status === 'active'). */
  inCombat: boolean;
  /**
   * Feature toggles for this actor, keyed by feature id (e.g. from the character
   * sheet): `{ 'crimson-rite': { active: false } }`. Optional; defaults to none.
   */
  features?: Record<string, FeatureState>;
}

/** Coerce the Json conditions column into a clean string[]. */
function toConditionList(conditions: unknown): string[] {
  if (!Array.isArray(conditions)) return [];
  return conditions.filter((c): c is string => typeof c === 'string');
}

/** Map a combat participant + encounter context into the engine's ActorState. */
export function participantToActorState(p: ParticipantInput, opts: MapOptions): ActorState {
  return {
    id: p.id,
    name: p.name,
    inCombat: opts.inCombat && p.isAlive,
    hp: p.hp,
    maxHp: p.maxHp,
    tempHp: p.tempHp ?? 0,
    actionUsed: p.actionUsed,
    bonusActionUsed: p.bonusActionUsed,
    reactionUsed: p.reactionUsed,
    concentration: p.concentration,
    conditions: toConditionList(p.conditions),
    features: opts.features ?? {},
  };
}
