import { describe, it, expect } from 'vitest'
import {
  evaluatePredicates,
  hasBonusAction,
  actionAvailable,
  reactionAvailable,
  concentrationAtRisk,
  participantDowned,
  riteInactive,
  inCombat,
} from '../predicates'
import type { BoardSnapshot, ParticipantBoardState, PredicateContext } from '../types'

function participant(over: Partial<ParticipantBoardState> = {}): ParticipantBoardState {
  return {
    id: 'p1',
    name: 'Aria',
    type: 'pc',
    hp: 20,
    maxHp: 20,
    tempHp: 0,
    conditions: [],
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    concentration: null,
    hasBonusActionOption: false,
    ...over,
  }
}

function ctx(
  active: ParticipantBoardState | null,
  snap: Partial<BoardSnapshot> = {},
): PredicateContext {
  const snapshot: BoardSnapshot = {
    sessionId: 's1',
    encounterId: 'e1',
    round: 1,
    inCombat: true,
    currentTurnId: active?.id ?? null,
    participants: active ? [active] : [],
    secondsSinceLastAction: 0,
    ...snap,
  }
  return { snapshot, active }
}

describe('predicates', () => {
  it('inCombat reflects the snapshot flag', () => {
    expect(inCombat(ctx(participant(), { inCombat: false }))).toBe(false)
    expect(inCombat(ctx(participant()))).toBe(true)
  })

  it('hasBonusAction fires only with an unused, available bonus action in combat', () => {
    expect(hasBonusAction(ctx(participant({ hasBonusActionOption: true })))).toBe(true)
    expect(hasBonusAction(ctx(participant({ hasBonusActionOption: false })))).toBe(false)
    expect(
      hasBonusAction(ctx(participant({ hasBonusActionOption: true, bonusActionUsed: true }))),
    ).toBe(false)
    expect(
      hasBonusAction(ctx(participant({ hasBonusActionOption: true }), { inCombat: false })),
    ).toBe(false)
  })

  it('actionAvailable / reactionAvailable track their flags', () => {
    expect(actionAvailable(ctx(participant({ actionUsed: false })))).toBe(true)
    expect(actionAvailable(ctx(participant({ actionUsed: true })))).toBe(false)
    expect(reactionAvailable(ctx(participant({ reactionUsed: false })))).toBe(true)
    expect(reactionAvailable(ctx(participant({ reactionUsed: true })))).toBe(false)
  })

  it('concentrationAtRisk fires only when concentrating and bloodied', () => {
    expect(
      concentrationAtRisk(ctx(participant({ concentration: 'Bless', hp: 10, maxHp: 20 }))),
    ).toBe(true)
    expect(
      concentrationAtRisk(ctx(participant({ concentration: 'Bless', hp: 15, maxHp: 20 }))),
    ).toBe(false)
    expect(concentrationAtRisk(ctx(participant({ concentration: null, hp: 5, maxHp: 20 })))).toBe(
      false,
    )
  })

  it('participantDowned fires at 0 hp', () => {
    expect(participantDowned(ctx(participant({ hp: 0 })))).toBe(true)
    expect(participantDowned(ctx(participant({ hp: 1 })))).toBe(false)
  })

  it('riteInactive fires after the pacing threshold', () => {
    expect(riteInactive(ctx(participant(), { secondsSinceLastAction: 60 }))).toBe(true)
    expect(riteInactive(ctx(participant(), { secondsSinceLastAction: 10 }))).toBe(false)
  })

  it('predicates are pure — no active participant means no firing', () => {
    const fired = evaluatePredicates(ctx(null))
    // Only inCombat-style predicates that don't need `active` could fire; none do here.
    expect(fired.map((p) => p.id)).not.toContain('has_bonus_action')
    expect(fired.map((p) => p.id)).not.toContain('participant_downed')
  })

  it('evaluatePredicates returns matches in registry priority order', () => {
    const downAndBloodied = participant({
      hp: 0,
      maxHp: 20,
      concentration: 'Bless',
      hasBonusActionOption: true,
    })
    const fired = evaluatePredicates(ctx(downAndBloodied)).map((p) => p.id)
    // Risk predicates are registered before option/opportunity ones.
    expect(fired[0]).toBe('participant_downed')
    expect(fired.indexOf('participant_downed')).toBeLessThan(fired.indexOf('has_bonus_action'))
  })
})
