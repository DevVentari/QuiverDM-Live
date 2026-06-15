/**
 * Deterministic predicate engine. Pure functions over a typed board snapshot.
 *
 * No AI, no randomness, no I/O — every predicate is a total function of its
 * `PredicateContext`, which makes the whole layer trivially unit-testable and
 * keeps the "Clippy effect" risk contained: a nudge only ever fires when a
 * concrete, explainable rule predicate is true.
 */

import type { Predicate, PredicateContext } from './types'

/** True when the encounter is live (combat in progress). */
export function inCombat(ctx: PredicateContext): boolean {
  return ctx.snapshot.inCombat
}

/** True when it is the active participant's turn and they still have a bonus action. */
export function hasBonusAction(ctx: PredicateContext): boolean {
  const a = ctx.active
  if (!a) return false
  return ctx.snapshot.inCombat && a.hasBonusActionOption && !a.bonusActionUsed
}

/** True when the active participant still has their action this turn. */
export function actionAvailable(ctx: PredicateContext): boolean {
  const a = ctx.active
  if (!a) return false
  return ctx.snapshot.inCombat && !a.actionUsed
}

/** True when the active participant still has their reaction available. */
export function reactionAvailable(ctx: PredicateContext): boolean {
  const a = ctx.active
  if (!a) return false
  return ctx.snapshot.inCombat && !a.reactionUsed
}

/** True when a concentrating participant is at risk (took damage / low hp). */
export function concentrationAtRisk(ctx: PredicateContext): boolean {
  const a = ctx.active
  if (!a || !a.concentration) return false
  // Bloodied (≤ half hp) while concentrating is the classic save-incoming risk.
  return a.hp > 0 && a.hp <= Math.floor(a.maxHp / 2)
}

/** True when the active participant is downed (0 hp) — death-save / revive risk. */
export function participantDowned(ctx: PredicateContext): boolean {
  const a = ctx.active
  if (!a) return false
  return a.hp <= 0
}

/**
 * True when play has stalled on the active participant's turn — a pacing nudge.
 * Threshold is intentionally generous; pacing is a hint, not an alert.
 */
export function riteInactive(ctx: PredicateContext): boolean {
  return ctx.snapshot.inCombat && ctx.snapshot.secondsSinceLastAction >= 45
}

/**
 * The default predicate registry, ordered by priority (first match wins per
 * category when the delivery layer dedupes). Risk predicates carry higher
 * confidence than opportunity/option-unused ones.
 */
export const PREDICATES: Predicate[] = [
  { id: 'participant_downed', category: 'risk', confidence: 'alert', test: participantDowned },
  { id: 'concentration_at_risk', category: 'risk', confidence: 'highlight', test: concentrationAtRisk },
  { id: 'has_bonus_action', category: 'option-unused', confidence: 'highlight', test: hasBonusAction },
  { id: 'reaction_available', category: 'option-unused', confidence: 'hint', test: reactionAvailable },
  { id: 'action_available', category: 'opportunity', confidence: 'hint', test: actionAvailable },
  { id: 'rite_inactive', category: 'opportunity', confidence: 'hint', test: riteInactive },
]

/**
 * Evaluate every registered predicate against a context. Returns the ids of all
 * predicates that fired, in registry (priority) order. Pure — no rotation, no
 * line selection (that is the line-pool layer's job).
 */
export function evaluatePredicates(
  ctx: PredicateContext,
  registry: Predicate[] = PREDICATES,
): Predicate[] {
  return registry.filter((p) => p.test(ctx))
}
