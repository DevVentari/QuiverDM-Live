/**
 * Multi-track FLAC transcription script for D&D sessions.
 *
 * Each FLAC file is one speaker track (already separated by Discord/Craig/etc).
 * Transcribes each in parallel, merges words by timestamp, cleans up OOC chatter.
 *
 * Outputs:
 *   transcript-for-coding.json  - structured JSON with speaker/start/end/text per utterance
 *   master-transcript.md        - human-readable formatted document
 *
 * Run: npx tsx scripts/transcribe-session-tracks.ts [directory]
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { AssemblyAI } from 'assemblyai';

const API_KEY = process.env.ASSEMBLYAI_API_KEY;
if (!API_KEY) { console.error('ASSEMBLYAI_API_KEY not set'); process.exit(1); }
const GAP_MS = 2000; // max gap within an utterance from the same speaker

// ─── D&D term boost ──────────────────────────────────────────────────────────

const DND_TERMS = [
  'initiative', 'perception', 'investigation', 'persuasion', 'deception',
  'intimidation', 'stealth', 'arcana', 'athletics', 'acrobatics',
  'hit points', 'armor class', 'saving throw', 'death save',
  'spell slot', 'cantrip', 'advantage', 'disadvantage',
  'natural twenty', 'natural one', 'critical hit', 'critical miss',
  'dungeon master', 'game master', 'bonus action', 'reaction',
  'concentration', 'opportunity attack', 'grapple', 'shove',
  'short rest', 'long rest', 'inspiration', 'passive perception',
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Word {
  text: string;
  start: number; // ms
  end: number;   // ms
  confidence: number;
  speaker: string;
}

interface Utterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface CodingEntry {
  speaker: string;
  start: number;
  end: number;
  start_formatted: string;
  end_formatted: string;
  text: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function speakerFromFilename(filename: string): string {
  return path.basename(filename, '.flac').replace(/^\d+-/, '');
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

// Returns true for utterances that are clearly out-of-character / meta / tech noise
function isNonGameplay(text: string): boolean {
  const t = text.toLowerCase().trim();
  const patterns = [
    /^(can|can't|cannot) (you|everyone|anyone) hear( me)?/,
    /my (mic|microphone) (is|was|keeps?|cut)/,
    /^(ok|okay)[,.]?\s*(i'?m back|i was muted|sorry i was muted|sorry about that)/,
    /^(brb|be right back|bathroom break|bio break)/,
    /^(hang on|hold on|one sec(ond)?|just a sec(ond)?|give me a (sec|moment))/,
    /^(oh|oops|sorry)[,.]?\s*(i was muted|forgot to unmute|didn'?t realize)/,
    /^(test(ing)?|mic check|audio check)/,
    /^(is my (mic|audio|sound) (working|ok|okay|good))/,
    /^(reconnect|dropped|lost (my )?(connection|audio|sound))/,
  ];
  return patterns.some(p => p.test(t));
}

// ─── Core transcription ──────────────────────────────────────────────────────

async function transcribeTrack(
  client: AssemblyAI,
  filePath: string,
  speaker: string,
): Promise<Word[]> {
  console.log(`[${speaker}] Uploading ${path.basename(filePath)}...`);
  const uploadUrl = await client.files.upload(filePath);
  console.log(`[${speaker}] Upload complete — submitting...`);

  const transcript = await client.transcripts.transcribe({
    audio_url: uploadUrl,
    speech_models: ['universal-2'],
    speaker_labels: false,
    word_boost: DND_TERMS,
    boost_param: 'high',
  } as any);

  if (transcript.status === 'error') {
    throw new Error(`[${speaker}] AssemblyAI error: ${transcript.error}`);
  }

  const words = transcript.words ?? [];
  console.log(`[${speaker}] Complete — ${words.length} words`);

  return words
    .filter(w => w.text && w.text.trim())
    .map(w => ({
      text: w.text ?? '',
      start: w.start ?? 0,
      end: w.end ?? 0,
      confidence: w.confidence ?? 0,
      speaker,
    }));
}

// ─── Merge & group ───────────────────────────────────────────────────────────

function mergeIntoUtterances(allWords: Word[]): Utterance[] {
  allWords.sort((a, b) => a.start - b.start);

  const utterances: Utterance[] = [];
  let current: Utterance | null = null;

  for (const word of allWords) {
    if (
      current &&
      current.speaker === word.speaker &&
      word.start - current.end < GAP_MS
    ) {
      current.text += ` ${word.text}`;
      current.end = word.end;
    } else {
      if (current) utterances.push(current);
      current = {
        speaker: word.speaker,
        text: word.text,
        start: word.start,
        end: word.end,
      };
    }
  }
  if (current) utterances.push(current);
  return utterances;
}

// ─── Output formatters ───────────────────────────────────────────────────────

function buildCodingJson(utterances: Utterance[]): CodingEntry[] {
  return utterances.map(u => ({
    speaker: u.speaker,
    start: u.start,
    end: u.end,
    start_formatted: formatTimestamp(u.start),
    end_formatted: formatTimestamp(u.end),
    text: u.text.trim(),
  }));
}

function buildMasterMarkdown(utterances: Utterance[], speakers: string[], sessionName: string): string {
  const lines: string[] = [
    `# ${sessionName} — Session Transcript`,
    '',
    `**Participants:** ${speakers.join(', ')}`,
    `**Utterances:** ${utterances.length}`,
    '',
    '---',
    '',
  ];

  for (const u of utterances) {
    lines.push(`**[${formatTimestamp(u.start)}] ${u.speaker}:** ${u.text.trim()}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dir = process.argv[2] ?? 'e:/Projects/QuiverDM/docs/Test/transcription/Jordans 2nd Campaign';
  const sessionName = path.basename(dir);

  const flacFiles = fs.readdirSync(dir)
    .filter(f => f.endsWith('.flac'))
    .sort()
    .map(f => ({ filePath: path.join(dir, f), speaker: speakerFromFilename(f) }));

  if (flacFiles.length === 0) {
    console.error('No FLAC files found in', dir);
    process.exit(1);
  }

  console.log(`Session: ${sessionName}`);
  console.log(`Tracks (${flacFiles.length}):`);
  flacFiles.forEach(f => console.log(`  ${f.speaker}`));
  console.log();

  const client = new AssemblyAI({ apiKey: API_KEY! });

  // Transcribe all tracks in parallel
  const results = await Promise.all(
    flacFiles.map(f => transcribeTrack(client, f.filePath, f.speaker)),
  );

  const allWords = results.flat();
  console.log(`\nTotal words across all tracks: ${allWords.length}`);

  const utterances = mergeIntoUtterances(allWords);
  console.log(`Utterances after merge: ${utterances.length}`);

  const gameplay = utterances.filter(u => !isNonGameplay(u.text));
  console.log(`Utterances after OOC filter: ${gameplay.length} (removed ${utterances.length - gameplay.length})`);

  const speakers = flacFiles.map(f => f.speaker);

  // Write outputs
  const jsonPath = path.join(dir, 'transcript-for-coding.json');
  const mdPath = path.join(dir, 'master-transcript.md');

  fs.writeFileSync(jsonPath, JSON.stringify(buildCodingJson(gameplay), null, 2), 'utf8');
  console.log(`\nWrote: ${jsonPath}`);

  fs.writeFileSync(mdPath, buildMasterMarkdown(gameplay, speakers, sessionName), 'utf8');
  console.log(`Wrote: ${mdPath}`);

  // Summary
  const totalMs = gameplay.length > 0 ? gameplay[gameplay.length - 1].end : 0;
  console.log(`\nSession duration: ~${formatTimestamp(totalMs)}`);
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
