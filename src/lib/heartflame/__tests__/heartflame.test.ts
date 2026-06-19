import { describe, it, expect } from 'vitest';
import {
  type ActorState,
  evaluate,
  primaryNudge,
  selectLine,
  LINE_POOLS,
  DEFAULT_RULES,
  hasBonusAction,
  featureInactive,
  isBloodied,
  hasCondition,
} from '../index';

function actor(overrides: Partial<ActorState> = {}): ActorState {
  return {
    id: 'a1',
    name: 'Barksley',
    inCombat: true,
    hp: 28,
    maxHp: 40,
    tempHp: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    concentration: false,
    conditions: [],
    features: {},
    ...overrides,
  };
}

describe('predicates', () => {
  it('hasBonusAction reflects the action-economy flag', () => {
    expect(hasBonusAction(actor({ bonusActionUsed: false }))).toBe(true);
    expect(hasBonusAction(actor({ bonusActionUsed: true }))).toBe(false);
  });

  it('featureInactive requires the feature known, available, and not engaged', () => {
    expect(featureInactive('crimson-rite')(actor({ features: { 'crimson-rite': { active: false } } }))).toBe(true);
    expect(featureInactive('crimson-rite')(actor({ features: { 'crimson-rite': { active: true } } }))).toBe(false);
    expect(featureInactive('crimson-rite')(actor({ features: { 'crimson-rite': { active: false, available: false } } }))).toBe(false);
    expect(featureInactive('crimson-rite')(actor({ features: {} }))).toBe(false);
  });

  it('isBloodied is at or below half max HP', () => {
    expect(isBloodied(actor({ hp: 20, maxHp: 40 }))).toBe(true);
    expect(isBloodied(actor({ hp: 21, maxHp: 40 }))).toBe(false);
    expect(isBloodied(actor({ hp: 0, maxHp: 0 }))).toBe(false);
  });

  it('hasCondition is case-insensitive', () => {
    expect(hasCondition('Prone')(actor({ conditions: ['prone'] }))).toBe(true);
    expect(hasCondition('prone')(actor({ conditions: [] }))).toBe(false);
  });
});

describe('line pool rotation', () => {
  it('cycles through every line before repeating (avoids the Clippy effect)', () => {
    const pool = LINE_POOLS['crimson-rite'];
    const seen: string[] = [];
    let cursor = 0;
    for (let i = 0; i < pool.lines.length; i++) {
      const r = selectLine(pool, cursor);
      seen.push(r.line);
      cursor = r.cursor;
    }
    // every line appears exactly once in the first full cycle
    expect(new Set(seen).size).toBe(pool.lines.length);
    expect(seen).toEqual(pool.lines);
    // the next selection wraps back to the first line
    expect(selectLine(pool, cursor).line).toBe(pool.lines[0]);
  });

  it('never repeats consecutively across many fires', () => {
    const pool = LINE_POOLS['reaction-held'];
    let cursor = 0;
    let prev = '';
    for (let i = 0; i < 20; i++) {
      const r = selectLine(pool, cursor);
      if (pool.lines.length > 1) expect(r.line).not.toBe(prev);
      prev = r.line;
      cursor = r.cursor;
    }
  });

  it('handles negative cursors safely', () => {
    const pool = LINE_POOLS['crimson-rite'];
    expect(pool.lines).toContain(selectLine(pool, -1).line);
  });
});

describe('engine', () => {
  it('fires the Crimson Rite nudge for the diagram example actor', () => {
    // Barksley: in combat, rite inactive, bonus action available → FIRES
    const a = actor({ features: { 'crimson-rite': { active: false } } });
    const { nudges } = evaluate(a, DEFAULT_RULES);
    const rite = nudges.find((n) => n.ruleId === 'crimson-rite-available');
    expect(rite).toBeDefined();
    expect(rite!.category).toBe('option-unused');
    expect(rite!.actorId).toBe('a1');
    expect(LINE_POOLS['crimson-rite'].lines).toContain(rite!.line);
  });

  it('does not invent rule text — it equals the authored constant', () => {
    const a = actor({ features: { 'crimson-rite': { active: false } } });
    const { nudges } = evaluate(a, DEFAULT_RULES);
    const rite = nudges.find((n) => n.ruleId === 'crimson-rite-available')!;
    const authored = DEFAULT_RULES.find((r) => r.id === 'crimson-rite-available')!.rule;
    expect(rite.rule).toBe(authored);
  });

  it('is deterministic — same inputs and cursors give the same output', () => {
    const a = actor({ features: { 'crimson-rite': { active: false } } });
    const r1 = evaluate(a, DEFAULT_RULES, {});
    const r2 = evaluate(a, DEFAULT_RULES, {});
    expect(r2).toEqual(r1);
  });

  it('treats incoming cursors as immutable and advances rotation across calls', () => {
    const a = actor({ features: { 'crimson-rite': { active: false } } });
    const cursors = {};
    const first = evaluate(a, DEFAULT_RULES, cursors);
    expect(cursors).toEqual({}); // not mutated
    const second = evaluate(a, DEFAULT_RULES, first.cursors);
    const firstLine = first.nudges.find((n) => n.ruleId === 'crimson-rite-available')!.line;
    const secondLine = second.nudges.find((n) => n.ruleId === 'crimson-rite-available')!.line;
    expect(secondLine).not.toBe(firstLine); // pool rotated
  });

  it('stays silent when the actor is not in combat', () => {
    const { nudges } = evaluate(actor({ inCombat: false, features: { 'crimson-rite': { active: false } } }), DEFAULT_RULES);
    expect(nudges).toEqual([]);
  });

  it('primaryNudge surfaces risk over opportunity over option-unused', () => {
    // Concentrating + bloodied + bonus available → risk and option-unused both fire
    const a = actor({ concentration: true, hp: 10, maxHp: 40, features: { 'crimson-rite': { active: false } } });
    const { nudges } = evaluate(a, DEFAULT_RULES);
    expect(nudges.length).toBeGreaterThan(1);
    expect(primaryNudge(nudges)!.category).toBe('risk');
  });
});
