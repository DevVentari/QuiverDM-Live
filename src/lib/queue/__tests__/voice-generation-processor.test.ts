import { describe, it, expect, vi } from 'vitest';
import { processVoiceClipJob } from '../voice-generation-processor';
import type { VoiceClipProcessorDeps } from '../voice-generation-processor';

function makeDeps(overrides: Partial<VoiceClipProcessorDeps> = {}): VoiceClipProcessorDeps {
  return {
    getClip: vi.fn().mockResolvedValue({
      id: 'clip1', campaignId: 'camp1', entityId: 'ent1',
      text: 'You dare approach me?', voiceId: 'abc', status: 'pending',
    }),
    updateClip: vi.fn().mockResolvedValue(undefined),
    synthesize: vi.fn().mockResolvedValue({
      audio: Buffer.from([1, 2, 3]), contentType: 'audio/mpeg',
    }),
    uploadAudio: vi.fn().mockResolvedValue('/api/files/voice/clip1.mp3'),
    ...overrides,
  };
}

describe('processVoiceClipJob', () => {
  it('synthesizes, uploads, and marks the clip ready', async () => {
    const deps = makeDeps();
    await processVoiceClipJob('clip1', deps);

    expect(deps.updateClip).toHaveBeenCalledWith('clip1', { status: 'processing' });
    expect(deps.synthesize).toHaveBeenCalledWith({ text: 'You dare approach me?', voiceId: 'abc' });
    expect(deps.uploadAudio).toHaveBeenCalledWith('clip1', expect.any(Buffer), 'audio/mpeg');
    expect(deps.updateClip).toHaveBeenLastCalledWith('clip1', {
      status: 'ready', audioUrl: '/api/files/voice/clip1.mp3',
    });
  });

  it('marks the clip failed with the error message when synthesis throws', async () => {
    const deps = makeDeps({
      synthesize: vi.fn().mockRejectedValue(new Error('ElevenLabs TTS failed: 429')),
    });
    await expect(processVoiceClipJob('clip1', deps)).rejects.toThrow('ElevenLabs TTS failed: 429');
    expect(deps.updateClip).toHaveBeenLastCalledWith('clip1', {
      status: 'failed', errorMessage: 'ElevenLabs TTS failed: 429',
    });
  });
});
