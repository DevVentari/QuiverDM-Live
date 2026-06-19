/**
 * Heartflame — the starter rule library.
 *
 * Each rule maps a deterministic predicate to a category + flavour pool +
 * authoritative rule text. This is a small, illustrative set (the diagram's
 * Crimson Rite example plus a few generic combat rules); it is meant to be
 * extended per class/feature over time.
 */
import type { NudgeRule } from './engine';
import {
  and,
  inCombat,
  hasAction,
  hasBonusAction,
  hasReaction,
  concentrating,
  isBloodied,
  featureInactive,
} from './predicates';

export const DEFAULT_RULES: NudgeRule[] = [
  {
    id: 'crimson-rite-available',
    category: 'option-unused',
    pool: 'crimson-rite',
    when: and(inCombat, featureInactive('crimson-rite'), hasBonusAction),
    rule: 'Activate Crimson Rite — bonus action. Costs HP equal to one rolled hit die; the weapon deals extra elemental damage of the rite until you finish a short or long rest or fall unconscious.',
  },
  {
    id: 'concentration-at-risk',
    category: 'risk',
    pool: 'concentration-risk',
    when: and(inCombat, concentrating, isBloodied),
    rule: 'Concentration: when you take damage, make a Constitution saving throw (DC 10 or half the damage taken, whichever is higher) or the spell ends.',
  },
  {
    id: 'reaction-held',
    category: 'opportunity',
    pool: 'reaction-held',
    when: and(inCombat, hasReaction),
    rule: 'You still have your reaction — available for an opportunity attack, a readied action, or features such as Shield or Counterspell. It refreshes at the start of your turn.',
  },
  {
    id: 'bonus-action-idle',
    category: 'option-unused',
    pool: 'bonus-action-idle',
    when: and(inCombat, hasBonusAction, hasAction),
    rule: 'Bonus action unused — many classes have a bonus-action option (off-hand attack, Second Wind, Healing Word, Hex, a rogue’s Cunning Action).',
  },
];
