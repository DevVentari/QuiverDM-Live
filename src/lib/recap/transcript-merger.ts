/**
 * Merges multiple AssemblyAI word-level transcripts into a single
 * ordered segment list, attributing each word to its source track.
 */

export interface TrackWord {
  text: string;
  start: number; // milliseconds
  end: number;   // milliseconds
}

export interface TrackInput {
  words: TrackWord[];
  speakerTag: string; // "Kira" or "Speaker 0" etc.
}

export interface MergedSegment {
  start: number;
  end: number;
  text: string;
  speaker: string;
}

// Gap threshold: words more than 500ms apart from the same speaker
// become separate segments.
const SEGMENT_GAP_MS = 500;

/**
 * Merge word arrays from multiple tracks into ordered segments.
 * Words are sorted globally by start time, then grouped into segments
 * by speaker with a gap threshold.
 */
export function mergeTranscripts(tracks: TrackInput[]): MergedSegment[] {
  // Tag every word with its speaker
  const tagged: Array<{ text: string; start: number; end: number; speaker: string }> = [];

  for (const track of tracks) {
    for (const word of track.words) {
      tagged.push({ ...word, speaker: track.speakerTag });
    }
  }

  // Sort all words globally by start time
  tagged.sort((a, b) => a.start - b.start);

  if (tagged.length === 0) return [];

  // Group into segments: new segment when speaker changes or gap > threshold
  const segments: MergedSegment[] = [];
  let current = {
    start: tagged[0].start,
    end: tagged[0].end,
    text: tagged[0].text,
    speaker: tagged[0].speaker,
  };

  for (let i = 1; i < tagged.length; i++) {
    const word = tagged[i];
    const sameSpeaker = word.speaker === current.speaker;
    const withinGap = word.start - current.end < SEGMENT_GAP_MS;

    if (sameSpeaker && withinGap) {
      current.text += ' ' + word.text;
      current.end = word.end;
    } else {
      segments.push({ ...current });
      current = {
        start: word.start,
        end: word.end,
        text: word.text,
        speaker: word.speaker,
      };
    }
  }
  segments.push({ ...current });

  return segments;
}

/**
 * Build a plain-text representation from merged segments.
 * Format: "SpeakerName: text\n\nSpeakerName: text"
 */
export function segmentsToText(segments: MergedSegment[]): string {
  return segments.map((s) => `${s.speaker}: ${s.text}`).join('\n\n');
}
