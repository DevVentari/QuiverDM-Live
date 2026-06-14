import type { SynthesizeInput, SynthesizeResult, TtsProvider, TtsVoice } from './types';
import { ElevenLabsProvider } from './elevenlabs-provider';
import { STOCK_VOICES } from './voice-catalog';

/** No-op provider used when no API key is configured. */
class NoopProvider implements TtsProvider {
  readonly name = 'none' as const;
  async synthesize(_input: SynthesizeInput): Promise<SynthesizeResult> {
    throw new Error('TTS_NOT_CONFIGURED');
  }
  listVoices(): TtsVoice[] {
    return STOCK_VOICES.map(({ voiceId, label }) => ({ voiceId, label }));
  }
}

let cached: TtsProvider | null = null;

export function getTtsProvider(): TtsProvider {
  if (cached) return cached;
  const key = process.env.ELEVENLABS_API_KEY;
  cached = key ? new ElevenLabsProvider(key) : new NoopProvider();
  return cached;
}

export function isTtsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export type { TtsProvider } from './types';
