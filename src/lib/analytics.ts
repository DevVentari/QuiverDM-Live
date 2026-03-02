'use client';

import posthog from 'posthog-js';

export const EVENTS = {
  CAMPAIGN_CREATED: 'campaign_created',
  SESSION_STARTED: 'session_started',
  PDF_UPLOADED: 'pdf_uploaded',
  TRANSCRIPTION_STARTED: 'transcription_started',
  HOMEBREW_CREATED: 'homebrew_created',
  ONBOARDING_COMPLETED: 'onboarding_completed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export function track(event: EventName, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}
