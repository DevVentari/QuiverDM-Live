/**
 * Heartflame — line pools.
 *
 * Each category/situation has a pool of PRE-AUTHORED flavour lines in the
 * Heartflame voice. Lines are selected by deterministic round-robin rotation so
 * the same line never repeats until the whole pool has been shown — the
 * explicit "avoid the Clippy effect" requirement from the diagram.
 *
 * The flavour line is the only text surfaced unprompted; the authoritative rule
 * text lives on the rule (revealed on tap). The optional AI re-skin (Track B.4)
 * may re-word a line drawn here, but never invents a new one.
 */
import type { NudgeCategory } from './types';

export interface LinePool {
  key: string;
  category: NudgeCategory;
  /** Pre-authored flavour lines. Order is the rotation order. */
  lines: string[];
}

export const LINE_POOLS: Record<string, LinePool> = {
  'crimson-rite': {
    key: 'crimson-rite',
    category: 'option-unused',
    lines: [
      'The blade is cold. It could be otherwise.',
      'A rite waits, unspoken. Blood for fire.',
      'Heat sleeps in the steel. It has not been asked to wake.',
    ],
  },
  'reaction-held': {
    key: 'reaction-held',
    category: 'opportunity',
    lines: [
      'A held breath. The moment to answer has not yet come.',
      'Something is kept in reserve. Watch the doorway.',
    ],
  },
  'concentration-risk': {
    key: 'concentration-risk',
    category: 'risk',
    lines: [
      'The thread is taut. One hard blow and it parts.',
      'What is held in the mind grows fragile here.',
    ],
  },
  'bonus-action-idle': {
    key: 'bonus-action-idle',
    category: 'option-unused',
    lines: [
      'A small motion remains, unspent.',
      'There is room for one more gesture this turn.',
    ],
  },
};

/**
 * Deterministic round-robin selection. Returns the line at `cursor` and the next
 * cursor. Cycling guarantees every line appears once before any repeats.
 * `cursor` is safe for any integer (including negatives).
 */
export function selectLine(pool: LinePool, cursor: number): { line: string; cursor: number } {
  const n = pool.lines.length;
  if (n === 0) return { line: '', cursor };
  const idx = ((cursor % n) + n) % n;
  return { line: pool.lines[idx], cursor: cursor + 1 };
}
