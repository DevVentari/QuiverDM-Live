/**
 * Heartflame — predicate atoms.
 *
 * Pure, deterministic boolean functions over `ActorState`. No AI, no randomness,
 * no I/O. Rules (see ./rules) compose these into the conditions that fire nudges.
 */
import type { ActorState } from './types';

export type Predicate = (actor: ActorState) => boolean;

export const inCombat: Predicate = (a) => a.inCombat;
export const hasAction: Predicate = (a) => !a.actionUsed;
export const hasBonusAction: Predicate = (a) => !a.bonusActionUsed;
export const hasReaction: Predicate = (a) => !a.reactionUsed;
export const concentrating: Predicate = (a) => a.concentration;

/** Bloodied = at or below half of max HP (temp HP does not count). */
export const isBloodied: Predicate = (a) => a.maxHp > 0 && a.hp <= Math.floor(a.maxHp / 2);

/** Has the named condition (case-insensitive), e.g. `hasCondition('prone')`. */
export const hasCondition =
  (condition: string): Predicate =>
  (a) =>
    a.conditions.some((c) => c.toLowerCase() === condition.toLowerCase());

/** Feature is known/available but not currently engaged, e.g. `featureInactive('crimson-rite')`. */
export const featureInactive =
  (key: string): Predicate =>
  (a) => {
    const f = a.features[key];
    return Boolean(f) && f.available !== false && !f.active;
  };

/** Feature is currently engaged. */
export const featureActive =
  (key: string): Predicate =>
  (a) =>
    Boolean(a.features[key]?.active);

// ── Combinators ────────────────────────────────────────────────────────────
export const and =
  (...ps: Predicate[]): Predicate =>
  (a) =>
    ps.every((p) => p(a));

export const or =
  (...ps: Predicate[]): Predicate =>
  (a) =>
    ps.some((p) => p(a));

export const not =
  (p: Predicate): Predicate =>
  (a) =>
    !p(a);
