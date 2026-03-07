export const EVENTS = {
  CAMPAIGN_CREATED: 'campaign_created',
  SESSION_STARTED: 'session_started',
  PDF_UPLOADED: 'pdf_uploaded',
  TRANSCRIPTION_STARTED: 'transcription_started',
  HOMEBREW_CREATED: 'homebrew_created',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  NPC_CREATED: 'npc_created',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
