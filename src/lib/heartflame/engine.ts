/**
 * Heartflame — the predicate engine.
 *
 * Evaluates a set of rules against an actor's state and emits nudges. Pure and
 * deterministic: rotation state (`cursors`) is passed in and returned out, so
 * the caller owns persistence (Redis, per session) and the engine itself has no
 * side effects. No AI in this layer — flavour comes from authored line pools,
 * and each nudge carries authoritative rule text for the tap-to-reveal path.
 */
import type { ActorState, FiredNudge, NudgeCategory } from './types';
import { LINE_POOLS, selectLine } from './line-pool';

export interface NudgeRule {
  id: string;
  category: NudgeCategory;
  /** Key into LINE_POOLS for this rule's flavour lines. */
  pool: string;
  /** Deterministic condition over actor state. */
  when: (actor: ActorState) => boolean;
  /** Plain, authoritative rule text revealed on tap. Authored, never generated. */
  rule: string;
}

/** Per-pool rotation state: pool key → next cursor. */
export type Cursors = Record<string, number>;

export interface EvaluateResult {
  nudges: FiredNudge[];
  cursors: Cursors;
}

/**
 * Evaluate `rules` against `actor`. Returns the fired nudges (one per matching
 * rule) and the advanced rotation cursors. `cursors` is treated as immutable.
 */
export function evaluate(
  actor: ActorState,
  rules: NudgeRule[],
  cursors: Cursors = {},
): EvaluateResult {
  const nextCursors: Cursors = { ...cursors };
  const nudges: FiredNudge[] = [];

  for (const rule of rules) {
    if (!rule.when(actor)) continue;
    const pool = LINE_POOLS[rule.pool];
    if (!pool) continue;

    const { line, cursor } = selectLine(pool, nextCursors[rule.pool] ?? 0);
    nextCursors[rule.pool] = cursor;

    nudges.push({
      ruleId: rule.id,
      actorId: actor.id,
      category: rule.category,
      line,
      rule: rule.rule,
    });
  }

  return { nudges, cursors: nextCursors };
}

/** Surfacing priority when several nudges fire: risk first, then opportunity, then option-unused. */
export const CATEGORY_PRIORITY: readonly NudgeCategory[] = ['risk', 'opportunity', 'option-unused'];

/** Pick the single most important nudge to surface (the rest stay silent — "authority through restraint"). */
export function primaryNudge(nudges: FiredNudge[]): FiredNudge | null {
  for (const category of CATEGORY_PRIORITY) {
    const match = nudges.find((n) => n.category === category);
    if (match) return match;
  }
  return nudges[0] ?? null;
}
