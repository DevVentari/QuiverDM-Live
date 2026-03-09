export type CoDMPermissionLevel = 'Manual' | 'Assist' | 'AutoMechanical' | 'FullCoDM'

export type CoDMConfidence = 'silent' | 'hint' | 'highlight' | 'alert'

export interface CoDMSuggestion {
  id: string
  type: 'pacing' | 'npc_consistency' | 'rule_reminder' | 'engagement' | 'lore_continuity'
  confidence: CoDMConfidence
  message: string
  detail?: string
  entityId?: string
  sessionId: string
  createdAt: Date
  dismissed: boolean
}
