import { PostHog } from 'posthog-node';
import type { EventName } from './analytics-events';

export async function serverTrack(
  userId: string,
  event: EventName,
  properties?: Record<string, unknown>,
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  client.capture({ distinctId: userId, event, properties });
  try {
    await client.shutdown();
  } catch {
    // analytics is non-critical — swallow shutdown errors
  }
}
