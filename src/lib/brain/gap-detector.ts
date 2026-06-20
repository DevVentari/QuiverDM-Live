export type GapRule =
  | 'missing_description'
  | 'isolated'
  | 'no_stat_block'
  | 'low_confidence'
  | 'forgotten';

export interface GapCandidate {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
  confidence: number;
  statBlockId: string | null;
  relationshipCount: number;
  sessionsSinceLastSeen: number | null;
}

export interface GapFinding {
  rule: GapRule;
  weight: number;
  hint: string;
}

export interface EntityGaps {
  id: string;
  name: string;
  type: string;
  score: number;
  findings: GapFinding[];
}

const MIN_DESCRIPTION_LENGTH = 50;
const MIN_CONFIDENCE = 0.6;
const FORGOTTEN_SESSIONS = 6;

const WEIGHTS: Record<GapRule, number> = {
  missing_description: 3,
  isolated: 3,
  no_stat_block: 2,
  low_confidence: 1,
  forgotten: 1,
};

const HINTS: Record<GapRule, string> = {
  missing_description: 'Write a description',
  isolated: 'Link to a faction, location, or NPC',
  no_stat_block: 'Add a stat block',
  low_confidence: 'Confirm or refine — extracted with low confidence',
  forgotten: 'Resolve or revive — dormant and unseen',
};

const STATBLOCK_TYPES = new Set(['NPC', 'THREAT']);
const DONE_STATUSES = new Set(['destroyed', 'resolved']);

export function detectGaps(candidates: GapCandidate[]): EntityGaps[] {
  const results: EntityGaps[] = [];

  for (const c of candidates) {
    if (DONE_STATUSES.has(c.status)) continue;

    const findings: GapFinding[] = [];
    const add = (rule: GapRule) => findings.push({ rule, weight: WEIGHTS[rule], hint: HINTS[rule] });

    if (!c.description || c.description.trim().length < MIN_DESCRIPTION_LENGTH) add('missing_description');
    if (c.relationshipCount === 0) add('isolated');
    if (STATBLOCK_TYPES.has(c.type) && c.statBlockId === null) add('no_stat_block');
    if (c.confidence < MIN_CONFIDENCE) add('low_confidence');
    if (c.status === 'dormant' && (c.sessionsSinceLastSeen === null || c.sessionsSinceLastSeen >= FORGOTTEN_SESSIONS)) add('forgotten');

    if (findings.length > 0) {
      const score = findings.reduce((sum, f) => sum + f.weight, 0);
      results.push({ id: c.id, name: c.name, type: c.type, score, findings });
    }
  }

  results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return results;
}
