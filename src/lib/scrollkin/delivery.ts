/**
 * Delivery — turns fired predicates into at most one surfaced nudge, reusing the
 * Co-DM confidence gate (`getConfidenceLevel` / `shouldSurface`) so Scrollkin
 * honours the DM's existing permission level instead of inventing a new one.
 *
 * Flow: evaluate predicates → pick the highest-priority one whose confidence
 * passes the gate → select a rotating line → (optionally) re-skin → return the
 * nudge for the perch. The caller broadcasts it over the existing WS channel.
 */

import { shouldSurface } from '@/lib/co-dm/decision-engine'
import type { CoDMPermissionLevel, CoDMSuggestion } from '@/lib/co-dm/types'
import { evaluatePredicates, PREDICATES } from './predicates'
import { selectLine, type RotationState } from './line-pool'
import type {
  Predicate,
  PredicateContext,
  ScrollkinNudge,
} from './types'

/**
 * Map a fired predicate to the minimal `CoDMSuggestion` shape `shouldSurface`
 * expects, so we can reuse the gate verbatim. Scrollkin nudges are surfaced as
 * `rule_reminder` suggestions (the mechanical category Co-DM already gates).
 */
function asSuggestion(predicate: Predicate, sessionId: string): CoDMSuggestion {
  return {
    id: `scrollkin:${predicate.id}`,
    type: 'rule_reminder',
    confidence: predicate.confidence,
    message: predicate.id,
    sessionId,
    createdAt: new Date(),
    dismissed: false,
  }
}

export interface DeliverOptions {
  permissionLevel: CoDMPermissionLevel
  rotation: RotationState
  /** Async re-skinner (e.g. `reskinLine`). Omit to skip the AI path entirely. */
  reskin?: (text: string) => Promise<string>
  registry?: Predicate[]
}

export interface DeliverResult {
  nudge: ScrollkinNudge | null
  /** Updated rotation state to persist (unchanged when nothing surfaced). */
  rotation: RotationState
}

/**
 * Produce at most one nudge for the given board context. Deterministic except
 * for the optional re-skin step (which only rewords display text).
 */
export async function deliverNudge(
  ctx: PredicateContext,
  opts: DeliverOptions,
): Promise<DeliverResult> {
  const fired = evaluatePredicates(ctx, opts.registry ?? PREDICATES)

  // First predicate (registry priority order) that the permission gate allows.
  const chosen = fired.find((p) =>
    shouldSurface(asSuggestion(p, ctx.snapshot.sessionId), opts.permissionLevel),
  )
  if (!chosen) return { nudge: null, rotation: opts.rotation }

  const { line, state } = selectLine(chosen.id, opts.rotation)

  const nudge: ScrollkinNudge = {
    predicateId: chosen.id,
    category: chosen.category,
    confidence: chosen.confidence,
    line,
    participantId: ctx.active?.id ?? null,
  }

  if (opts.reskin) {
    nudge.reskinnedText = await opts.reskin(line.text)
  }

  return { nudge, rotation: state }
}
