import type { SynthesizeInput, SynthesizeResult, TtsProvider, TtsVoice } from './types';
import { STOCK_VOICES } from './voice-catalog';

const API_BASE = 'https://api.elevenlabs.io/v1';

export class ElevenLabsProvider implements TtsProvider {
  readonly name = 'elevenlabs' as const;

  constructor(private readonly apiKey: string) {}

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const res = await fetch(`${API_BASE}/text-to-speech/${input.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: input.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: input.settings ?? { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`ElevenLabs TTS failed: ${res.status} ${detail}`.trim());
    }

    const contentType = res.headers.get('content-type') ?? 'audio/mpeg';
    const audio = Buffer.from(await res.arrayBuffer());
    return { audio, contentType };
  }

  listVoices(): TtsVoice[] {
    return STOCK_VOICES.map(({ voiceId, label }) => ({ voiceId, label }));
  }
}
