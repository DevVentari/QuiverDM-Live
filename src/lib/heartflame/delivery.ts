/**
 * Heartflame — delivery tiering.
 *
 * Maps a nudge's category onto the existing Co-DM confidence model so the
 * surfacing decision (`shouldSurface`, permission levels) is shared rather than
 * reinvented. Risk speaks loudest; option-unused is the quietest hint.
 */
import type { CoDMConfidence } from '@/lib/co-dm/types';
import type { FiredNudge, NudgeCategory } from './types';

const CATEGORY_CONFIDENCE: Record<NudgeCategory, CoDMConfidence> = {
  risk: 'alert',
  opportunity: 'highlight',
  'option-unused': 'hint',
};

export interface SurfacedNudge extends FiredNudge {
  confidence: CoDMConfidence;
}

/** Attach the Co-DM confidence tier a nudge should be delivered at. */
export function toSurfaced(nudge: FiredNudge): SurfacedNudge {
  return { ...nudge, confidence: CATEGORY_CONFIDENCE[nudge.category] };
}
