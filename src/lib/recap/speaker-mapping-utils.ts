export type SpeakerEntry = { id: string; name: string; segments: number };
export type TimestampEntry = { start: number; end: number; text: string; speaker: string };

export function applyMappingsToTranscriptData(
  speakers: SpeakerEntry[],
  timestamps: TimestampEntry[],
  lookup: Map<string, string>
): { speakers: SpeakerEntry[]; timestamps: TimestampEntry[] } {
  return {
    speakers: speakers.map((s) => ({
      ...s,
      name: lookup.get(s.name) ?? s.name,
    })),
    timestamps: timestamps.map((t) => ({
      ...t,
      speaker: lookup.get(t.speaker) ?? t.speaker,
    })),
  };
}
