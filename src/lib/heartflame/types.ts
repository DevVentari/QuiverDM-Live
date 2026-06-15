/**
 * Heartflame — core types for the deterministic nudge engine.
 *
 * The pipeline (see docs/assets/designs/v3/nudge-system-diagram.excalidraw):
 *   inputs (actor state) → predicate engine → category → rotating line pool →
 *   delivery (+ optional AI re-skin that re-words a chosen line, never invents).
 *
 * This layer is pure and framework-free. No AI, no I/O.
 */

/** The three nudge categories from the diagram. */
export type NudgeCategory = 'opportunity' | 'option-unused' | 'risk';

/** Glyph per category (matches the diagram: ⚡ opportunity · 🔥 option-unused · ⚠ risk). */
export const CATEGORY_ICON: Record<NudgeCategory, string> = {
  opportunity: '⚡',
  'option-unused': '🔥',
  risk: '⚠',
};

/** State of a single class/feature toggle, e.g. Blood Hunter's Crimson Rite. */
export interface FeatureState {
  /** Whether the feature is currently engaged. */
  active: boolean;
  /** Whether the feature is usable at all right now (uses remaining, known). Defaults true. */
  available?: boolean;
}

/**
 * A combat actor's deterministic state — the inputs to the predicate engine.
 * Sourced from the character sheet + live board state (the EncounterParticipant
 * action-economy fields added in Track B.2).
 */
export interface ActorState {
  id: string;
  name: string;
  inCombat: boolean;
  hp: number;
  maxHp: number;
  tempHp: number;
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  concentration: boolean;
  conditions: string[];
  /** Feature toggles keyed by feature id, e.g. `{ 'crimson-rite': { active: false } }`. */
  features: Record<string, FeatureState>;
}

/** A nudge produced by the engine, ready for delivery. */
export interface FiredNudge {
  ruleId: string;
  actorId: string;
  category: NudgeCategory;
  /** The rotating flavour line drawn from the rule's pool — the only surfaced text. */
  line: string;
  /**
   * Plain, authoritative rule text revealed on tap. Authored, never AI-generated —
   * this is the "no AI hallucination path" from the diagram.
   */
  rule: string;
}
