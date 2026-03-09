import type { CoDMConfidence, CoDMPermissionLevel, CoDMSuggestion } from './types'

export function getConfidenceLevel(score: number): CoDMConfidence {
  if (score < 0.3) return 'silent'
  if (score < 0.6) return 'hint'
  if (score <= 0.85) return 'highlight'
  return 'alert'
}

export function shouldSurface(suggestion: CoDMSuggestion, permissionLevel: CoDMPermissionLevel): boolean {
  if (suggestion.dismissed) return false
  if (suggestion.confidence === 'silent') return false

  switch (permissionLevel) {
    case 'Manual':
      return false
    case 'Assist':
      return suggestion.confidence === 'highlight' || suggestion.confidence === 'alert'
    case 'AutoMechanical':
      return suggestion.type === 'rule_reminder'
        ? suggestion.confidence === 'hint' || suggestion.confidence === 'highlight' || suggestion.confidence === 'alert'
        : suggestion.confidence === 'highlight' || suggestion.confidence === 'alert'
    case 'FullCoDM':
      return true
    default:
      return false
  }
}
