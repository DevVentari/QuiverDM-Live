/**
 * Mint a short-lived live-session WebSocket token.
 *
 * Shared by play.getWsToken (browser DM mic) and the Discord voice bot, which
 * has no user session and mints on behalf of the campaign owner. The WS server
 * validates the token in handleJoinLiveSession and reads `deferSave` to decide
 * whether to persist a transcript on stop (the bot defers — the authoritative
 * transcript comes from the per-track multi-track merge instead).
 */

import { randomUUID } from 'node:crypto';
import { redis } from '@/lib/queue/queue';

export interface LiveSessionTokenInput {
  sessionId: string;
  campaignId: string;
  userId: string;
  sampleRate?: number;
  /** When true, stopLiveSession won't write a Transcript (A3 hybrid). */
  deferSave?: boolean;
}

const TOKEN_TTL_SECONDS = 60;

export async function mintLiveSessionToken(input: LiveSessionTokenInput): Promise<string> {
  if (!redis) throw new Error('Redis unavailable — cannot mint live session token');
  const token = randomUUID();
  await redis.set(`live-session-token:${token}`, JSON.stringify(input), 'EX', TOKEN_TTL_SECONDS);
  return token;
}
