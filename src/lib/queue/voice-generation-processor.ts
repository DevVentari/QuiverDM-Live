import type { SynthesizeInput, SynthesizeResult } from '@/lib/voice/tts/types';

export interface VoiceClipRecord {
  id: string;
  campaignId: string;
  entityId: string | null;
  text: string;
  voiceId: string;
  status: string;
}

export interface VoiceClipProcessorDeps {
  getClip(clipId: string): Promise<VoiceClipRecord | null>;
  updateClip(clipId: string, data: {
    status?: string; audioUrl?: string; durationMs?: number; errorMessage?: string;
  }): Promise<void>;
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
  uploadAudio(clipId: string, audio: Buffer, contentType: string): Promise<string>;
}

/**
 * Core job logic, dependency-injected so it can be unit tested without
 * Redis, Prisma, the network, or the filesystem.
 */
export async function processVoiceClipJob(clipId: string, deps: VoiceClipProcessorDeps): Promise<void> {
  const clip = await deps.getClip(clipId);
  if (!clip) throw new Error(`VoiceClip ${clipId} not found`);

  await deps.updateClip(clipId, { status: 'processing' });

  try {
    const result = await deps.synthesize({ text: clip.text, voiceId: clip.voiceId });
    const audioUrl = await deps.uploadAudio(clipId, result.audio, result.contentType);
    await deps.updateClip(clipId, { status: 'ready', audioUrl });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await deps.updateClip(clipId, { status: 'failed', errorMessage });
    throw err; // let BullMQ retry/backoff handle it
  }
}
