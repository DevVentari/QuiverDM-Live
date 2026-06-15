/**
 * Scrollkin — deterministic, predicate-driven nudge companion.
 *
 * Pipeline (from nudge-system-diagram): predicate → category → line pool →
 * delivery (+ optional AI re-skin). This module is the evolution of the Co-DM
 * decision engine (`src/lib/co-dm/`); it reuses the confidence model there for
 * the delivery gate but adds a pure, framework-free predicate + line-pool layer.
 *
 * Nothing in this file imports React, Prisma, or the AI client. The board-state
 * inputs are plain typed snapshots so the predicates stay unit-testable.
 */

import type { CoDMConfidence } from '@/lib/co-dm/types'

/** The three nudge categories from the design. */
export type ScrollkinCategory = 'opportunity' | 'option-unused' | 'risk'

/** Glyph + label metadata for a category (matches the diagram). */
export const CATEGORY_META: Record<
  ScrollkinCategory,
  { glyph: string; label: string }
> = {
  opportunity: { glyph: '⚡', label: 'Opportunity' },
  'option-unused': { glyph: '🔥', label: 'Option Unused' },
  risk: { glyph: '⚠', label: 'Risk' },
}

/**
 * Live per-participant combat state. Mirrors the columns the board-state
 * migration adds to `EncounterParticipant` plus the existing hp/conditions.
 */
export interface ParticipantBoardState {
  id: string
  name: string
  type: 'pc' | 'npc' | 'monster'
  hp: number
  maxHp: number
  tempHp: number
  conditions: string[]
  /** Action-economy flags for the current turn. */
  actionUsed: boolean
  bonusActionUsed: boolean
  reactionUsed: boolean
  /** Name of the spell being concentrated on, or null. */
  concentration: string | null
  /** Whether this participant has a bonus action available this turn (sheet-derived). */
  hasBonusActionOption: boolean
}

/** A snapshot of the encounter the predicate engine reads. */
export interface BoardSnapshot {
  sessionId: string
  encounterId: string
  round: number
  inCombat: boolean
  /** id of the participant whose turn it currently is, or null. */
  currentTurnId: string | null
  participants: ParticipantBoardState[]
  /** Seconds since the active player last took a meaningful action (pacing). */
  secondsSinceLastAction: number
}

/** The typed context every predicate receives. Pure data — no I/O. */
export interface PredicateContext {
  snapshot: BoardSnapshot
  /** The participant the nudge is being evaluated for (usually currentTurnId). */
  active: ParticipantBoardState | null
}

/** A registered predicate: a name, the category it feeds, and a pure test. */
export interface Predicate {
  /** Stable id used for line-pool lookup and dedup, e.g. `has_bonus_action`. */
  id: string
  category: ScrollkinCategory
  /** Confidence this predicate carries when it fires (fed to the Co-DM gate). */
  confidence: CoDMConfidence
  /** Pure, deterministic test. No side effects, no randomness. */
  test: (ctx: PredicateContext) => boolean
}

/** A pre-authored line, optionally with the plain rule text revealed on tap. */
export interface PoolLine {
  /** The short nudge text shown on the perch. */
  text: string
  /** Plain rules text revealed on tap — never AI-generated. */
  rule: string
}

/** Result of evaluating predicates against a snapshot. */
export interface ScrollkinNudge {
  /** Predicate that fired. */
  predicateId: string
  category: ScrollkinCategory
  confidence: CoDMConfidence
  /** Chosen line from the rotating pool. */
  line: PoolLine
  /** Optional AI-reworded variant of `line.text`. Never replaces `line.rule`. */
  reskinnedText?: string
  /** id of the participant the nudge concerns. */
  participantId: string | null
}
