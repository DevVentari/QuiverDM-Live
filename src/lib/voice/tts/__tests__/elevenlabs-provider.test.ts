import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElevenLabsProvider } from '../elevenlabs-provider';

describe('ElevenLabsProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the TTS endpoint and returns audio buffer', async () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]).buffer;
    (fetch as any).mockResolvedValue({
      ok: true,
      headers: { get: () => 'audio/mpeg' },
      arrayBuffer: async () => fakeAudio,
    });

    const provider = new ElevenLabsProvider('test-key');
    const result = await provider.synthesize({ text: 'Hello', voiceId: 'abc' });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain('/text-to-speech/abc');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('test-key');
    expect(result.contentType).toBe('audio/mpeg');
    expect(result.audio).toEqual(Buffer.from(fakeAudio));
  });

  it('throws a typed error when the API responds non-ok', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'quota exceeded',
    });

    const provider = new ElevenLabsProvider('test-key');
    await expect(provider.synthesize({ text: 'Hi', voiceId: 'abc' }))
      .rejects.toThrow(/ElevenLabs TTS failed: 429/);
  });
});
