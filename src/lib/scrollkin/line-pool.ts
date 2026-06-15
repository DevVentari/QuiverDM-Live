/**
 * Category + line pool with a rotating, never-repeat selector.
 *
 * The "Clippy effect" is the core product risk: a nudge that says the same thing
 * the same way is noise. Every predicate owns a pool of pre-authored lines; the
 * selector cycles through the full pool before any line repeats and never serves
 * the same line twice in a row. Selection is pure — state is threaded in and out
 * so callers (worker / Redis store) own persistence.
 */

import type { PoolLine } from './types'

/** Per-predicate line pools. Keyed by predicate id. */
export const LINE_POOLS: Record<string, PoolLine[]> = {
  participant_downed: [
    { text: 'They are down — death saves begin.', rule: 'At 0 hp a creature is unconscious and makes a death saving throw at the start of each of its turns (DC 10).' },
    { text: 'Someone needs healing or a Medicine check.', rule: 'A successful DC 10 Wisdom (Medicine) check stabilises a dying creature; any healing brings it back to 1 hp.' },
    { text: 'Three failures and they are gone.', rule: 'Three failed death saves means death; three successes means the creature stabilises at 0 hp.' },
  ],
  concentration_at_risk: [
    { text: 'Concentration may break — watch for damage.', rule: 'Taking damage forces a Constitution save (DC 10 or half the damage, whichever is higher) to keep concentration.' },
    { text: 'They are bloodied while concentrating.', rule: 'Losing concentration ends the linked spell immediately.' },
    { text: 'A failed save drops the spell.', rule: 'On a failed concentration save the spell ends; only one concentration spell can be active at a time.' },
  ],
  has_bonus_action: [
    { text: 'Bonus action still unspent.', rule: 'A bonus action can only be used when a feature, spell, or item specifically grants one.' },
    { text: 'There may be a bonus action to use.', rule: 'Two-weapon fighting, healing word, and many class features use a bonus action.' },
    { text: 'Spare bonus action this turn.', rule: 'A bonus action is lost if not used before the turn ends.' },
  ],
  reaction_available: [
    { text: 'Reaction is still available.', rule: 'A reaction is an instant response usable once per round, even on another creature’s turn.' },
    { text: 'Opportunity attack is on the table.', rule: 'A creature leaving your reach without disengaging provokes an opportunity attack as a reaction.' },
  ],
  action_available: [
    { text: 'Action not yet taken.', rule: 'On its turn a creature can take one action: Attack, Cast a Spell, Dash, Dodge, Help, Hide, Ready, Search, or Use an Object.' },
    { text: 'Consider Dodge or Help if attacking is weak.', rule: 'Dodge imposes disadvantage on attacks against you; Help grants an ally advantage.' },
    { text: 'Still a full action to spend.', rule: 'The Ready action lets you prepare a response to a trigger you specify.' },
  ],
  rite_inactive: [
    { text: 'The table has gone quiet — nudge the turn.', rule: 'Keeping turns moving sustains tension and pacing in combat.' },
    { text: 'Offer a prompt to keep momentum.', rule: 'A short recap of the situation often unsticks an indecisive turn.' },
  ],
}

/** Rotation cursor: predicate id → last served index (or undefined if never served). */
export type RotationState = Record<string, number>

export interface SelectionResult {
  line: PoolLine
  /** Updated rotation state to persist. */
  state: RotationState
}

/**
 * Select the next line for a predicate, advancing the rotation cursor. Cycles
 * through the entire pool before repeating; never returns the same index twice
 * in a row (when the pool has more than one line). Pure: returns a new state.
 *
 * @throws if the predicate has no line pool registered.
 */
export function selectLine(predicateId: string, state: RotationState): SelectionResult {
  const pool = LINE_POOLS[predicateId]
  if (!pool || pool.length === 0) {
    throw new Error(`No line pool registered for predicate "${predicateId}"`)
  }

  const last = state[predicateId]
  const next = last === undefined ? 0 : (last + 1) % pool.length

  return {
    line: pool[next],
    state: { ...state, [predicateId]: next },
  }
}
