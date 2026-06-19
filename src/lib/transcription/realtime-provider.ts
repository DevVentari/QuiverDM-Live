/**
 * Realtime STT provider selector.
 *
 * Picks the live-transcription engine at runtime so the rest of the stack
 * (live-session-manager, the WebSocket server, the browser capture client) is
 * provider-agnostic. Mirrors the AI_PROVIDER_ORDER pattern in src/lib/ai/chat.ts.
 *
 *   STT_REALTIME_PROVIDER=local        → self-hosted WhisperLive (default, free)
 *   STT_REALTIME_PROVIDER=assemblyai   → AssemblyAI streaming (cloud, billed)
 *
 * Both factories return the same RealtimeTranscriberHandle, so swapping is a
 * config change with zero code changes downstream.
 */

import type { RealtimeTranscriberOptions, RealtimeTranscriberHandle } from './types';
import { createRealtimeTranscriber as createAssemblyAiTranscriber } from './assemblyai';
import { createLocalRealtimeTranscriber } from './local-realtime';

export type RealtimeSttProvider = 'local' | 'assemblyai';

export function getRealtimeSttProvider(): RealtimeSttProvider {
  return (process.env.STT_REALTIME_PROVIDER ?? 'local').toLowerCase() === 'assemblyai'
    ? 'assemblyai'
    : 'local';
}

export function createRealtimeTranscriber(
  options: RealtimeTranscriberOptions
): RealtimeTranscriberHandle {
  return getRealtimeSttProvider() === 'assemblyai'
    ? createAssemblyAiTranscriber(options)
    : createLocalRealtimeTranscriber(options);
}
