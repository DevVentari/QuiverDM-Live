/**
 * Discord Voice Bot service entry point.
 *
 * Long-running process (PM2 on the homelab, beside ws-server). It logs the bot
 * into Discord lazily on first use and listens on a Redis control channel that
 * the web/tRPC process publishes to (start/stop recording). Keeping the gateway
 * connection here means the web process never holds a Discord socket.
 *
 * Run: npm run worker:discord-voice
 */

import 'dotenv/config';
import Redis from 'ioredis';
import { getRedisConnection } from '@/lib/queue/queue';
import { VOICE_CONTROL_CHANNEL, handleControlMessage } from '@/lib/discord/voice-bot';

const sub = new Redis(getRedisConnection() as never);

sub.on('error', (err) => console.warn('[VoiceBot] Redis error (non-fatal):', err.message));

sub.subscribe(VOICE_CONTROL_CHANNEL, (err) => {
  if (err) {
    console.error('[VoiceBot] failed to subscribe to control channel:', err);
    process.exit(1);
  }
  console.log(`[VoiceBot] listening for control messages on "${VOICE_CONTROL_CHANNEL}"`);
});

sub.on('message', (channel, message) => {
  if (channel !== VOICE_CONTROL_CHANNEL) return;
  void handleControlMessage(message).catch((err) =>
    console.error('[VoiceBot] control message handling failed:', err)
  );
});
