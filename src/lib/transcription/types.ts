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
