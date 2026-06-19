import { describe, it, expect } from 'vitest';
import {
  participantToActorState,
  toSurfaced,
  evaluate,
  primaryNudge,
  DEFAULT_RULES,
  type ParticipantInput,
} from '../index';

function participant(overrides: Partial<ParticipantInput> = {}): ParticipantInput {
  return {
    id: 'p1',
    name: 'Skreek',
    hp: 30,
    maxHp: 40,
    tempHp: 0,
    conditions: ['poisoned'],
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    concentration: false,
    isAlive: true,
    ...overrides,
  };
}

describe('participantToActorState', () => {
  it('maps action economy and coerces the conditions Json to string[]', () => {
    const a = participantToActorState(participant({ conditions: ['prone', 'poisoned'] }), { inCombat: true });
    expect(a.id).toBe('p1');
    expect(a.bonusActionUsed).toBe(false);
    expect(a.conditions).toEqual(['prone', 'poisoned']);
    expect(a.features).toEqual({});
  });

  it('tolerates a non-array conditions value', () => {
    const a = participantToActorState(participant({ conditions: null }), { inCombat: true });
    expect(a.conditions).toEqual([]);
  });

  it('is only in combat when the encounter is active AND the actor is alive', () => {
    expect(participantToActorState(participant({ isAlive: true }), { inCombat: true }).inCombat).toBe(true);
    expect(participantToActorState(participant({ isAlive: false }), { inCombat: true }).inCombat).toBe(false);
    expect(participantToActorState(participant({ isAlive: true }), { inCombat: false }).inCombat).toBe(false);
  });

  it('passes feature toggles through', () => {
    const a = participantToActorState(participant(), {
      inCombat: true,
      features: { 'crimson-rite': { active: false } },
    });
    expect(a.features['crimson-rite']).toEqual({ active: false });
  });
});

describe('delivery tiering', () => {
  it('maps category to the Co-DM confidence model', () => {
    expect(toSurfaced({ ruleId: 'r', actorId: 'a', category: 'risk', line: '', rule: '' }).confidence).toBe('alert');
    expect(toSurfaced({ ruleId: 'r', actorId: 'a', category: 'opportunity', line: '', rule: '' }).confidence).toBe('highlight');
    expect(toSurfaced({ ruleId: 'r', actorId: 'a', category: 'option-unused', line: '', rule: '' }).confidence).toBe('hint');
  });
});

describe('participant → engine end-to-end', () => {
  it('a concentrating, bloodied actor surfaces a risk alert as the primary nudge', () => {
    const actor = participantToActorState(
      participant({ concentration: true, hp: 10, maxHp: 40 }),
      { inCombat: true },
    );
    const { nudges } = evaluate(actor, DEFAULT_RULES);
    const surfaced = nudges.map(toSurfaced);
    const primary = primaryNudge(surfaced)!;
    expect(primary.category).toBe('risk');
    expect(surfaced.find((n) => n.ruleId === primary.ruleId)!.confidence).toBe('alert');
  });
});
