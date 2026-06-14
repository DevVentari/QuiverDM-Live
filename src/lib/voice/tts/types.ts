export interface VoiceProfile {
  provider: 'elevenlabs';
  voiceId: string;
  settings?: Record<string, unknown>;
  assignedBy: 'brain' | 'dm';
}

export interface SynthesizeInput {
  text: string;
  voiceId: string;
  settings?: Record<string, unknown>;
}

export interface SynthesizeResult {
  audio: Buffer;
  contentType: string; // e.g. 'audio/mpeg'
  durationMs?: number;
}

export interface TtsVoice {
  voiceId: string;
  label: string;
}

export interface TtsProvider {
  readonly name: 'elevenlabs' | 'none';
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
  listVoices(): TtsVoice[];
}

/** Traits used to pick a stock voice for an NPC entity. */
export interface NpcVoiceTraits {
  gender?: string;
  race?: string;
  role?: string;
  personality?: string;
}
