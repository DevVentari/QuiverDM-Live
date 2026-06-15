import { describe, it, expect } from 'vitest'
import { selectLine, LINE_POOLS, type RotationState } from '../line-pool'

describe('line-pool rotation', () => {
  it('throws for an unknown predicate', () => {
    expect(() => selectLine('nope', {})).toThrow()
  })

  it('cycles through the entire pool before any line repeats', () => {
    const id = 'action_available'
    const pool = LINE_POOLS[id]
    let state: RotationState = {}
    const seen: string[] = []

    for (let i = 0; i < pool.length; i++) {
      const res = selectLine(id, state)
      state = res.state
      seen.push(res.line.text)
    }

    // Every line appeared exactly once across one full cycle.
    expect(new Set(seen).size).toBe(pool.length)
  })

  it('never returns the same line twice in a row across many selections', () => {
    const id = 'action_available'
    let state: RotationState = {}
    let prev: string | null = null

    for (let i = 0; i < 50; i++) {
      const res = selectLine(id, state)
      state = res.state
      if (prev !== null) expect(res.line.text).not.toBe(prev)
      prev = res.line.text
    }
  })

  it('is pure — returns new state without mutating the input', () => {
    const id = 'has_bonus_action'
    const state: RotationState = {}
    const res = selectLine(id, state)
    expect(state).toEqual({}) // input untouched
    expect(res.state[id]).toBe(0)
  })

  it('every predicate with a pool has at least two lines (rotation is meaningful)', () => {
    for (const [id, pool] of Object.entries(LINE_POOLS)) {
      expect(pool.length, `pool ${id}`).toBeGreaterThanOrEqual(2)
      for (const line of pool) {
        expect(line.text.length).toBeGreaterThan(0)
        expect(line.rule.length).toBeGreaterThan(0)
      }
    }
  })
})
