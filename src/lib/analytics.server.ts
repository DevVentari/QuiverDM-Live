import { PostHog } from 'posthog-node';

export async function serverTrack(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  client.capture({ distinctId: userId, event, properties });
  await client.shutdown();
}
