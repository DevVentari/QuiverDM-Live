/**
 * Shared transcription types.
 *
 * Generic interfaces that both WhisperX and AssemblyAI results satisfy,
 * so downstream code (saveTranscript, TranscriptViewer) works unchanged.
 */

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface SpeakerInfo {
  name: string;
  segmentCount: number;
}

/**
 * Generic transcription result.
 * Both WhisperX and AssemblyAI mappers produce this shape.
 */
export interface TranscriptionResult {
  success: boolean;
  text: string;
  textWithSpeakers?: string | null;
  segments: TranscriptionSegment[];
  language: string;
  language_probability: number;
  duration: number;
  hasSpeakers: boolean;
  speakers?: SpeakerInfo[] | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Realtime (streaming) contract
//
// Provider-neutral interface for live transcription. AssemblyAI and the local
// WhisperLive adapter both satisfy this, so live-session-manager.ts and the
// WebSocket server are unaware of which engine is running. Selection happens in
// realtime-provider.ts via STT_REALTIME_PROVIDER.
// ---------------------------------------------------------------------------

export interface RealtimeTranscriptTurn {
  text: string;
  isFinal: boolean;
  speaker?: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  timestamp: number;
}

export interface RealtimeTranscriberOptions {
  sampleRate?: number;
  wordBoost?: string[];
  onTranscript?: (turn: RealtimeTranscriptTurn) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
}

export interface RealtimeTranscriberHandle {
  connect: () => Promise<void>;
  sendAudio: (chunk: Buffer) => void;
  close: (waitForCompletion?: boolean) => Promise<void>;
}
