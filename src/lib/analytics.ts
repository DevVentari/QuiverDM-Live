'use client';

import posthog from 'posthog-js';
import type { EventName } from './analytics-events';
export { EVENTS } from './analytics-events';
export type { EventName } from './analytics-events';

export function track(event: EventName, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}
