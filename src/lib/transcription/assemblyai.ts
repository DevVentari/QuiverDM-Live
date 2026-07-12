/**
 * AssemblyAI Transcription Service
 *
 * Core wrapper around AssemblyAI SDK for both async (file upload)
 * and real-time (streaming) transcription.
 *
 * Lazy-initialized singleton pattern (same as src/lib/stripe.ts).
 */

import { AssemblyAI, RealtimeTranscriber, type Transcript as AAITranscript } from 'assemblyai';
import type {
  TranscriptionResult,
  TranscriptionSegment,
  RealtimeTranscriberOptions,
  RealtimeTranscriptTurn,
  RealtimeTranscriberHandle,
} from './types';
import { prisma } from '@/lib/prisma';

// Re-exported for backward compatibility — the realtime contract now lives in
// ./types so the local adapter can share it without importing the AssemblyAI SDK.
export type { RealtimeTranscriberOptions, RealtimeTranscriptTurn, RealtimeTranscriberHandle };

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: AssemblyAI | null = null;

function getClient(): AssemblyAI {
  if (!_client) {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('ASSEMBLYAI_API_KEY is not configured');
    }
    _client = new AssemblyAI({ apiKey });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Async (file upload) API
// ---------------------------------------------------------------------------

export interface AsyncTranscriptionOptions {
  /** URL or local file path of the audio */
  audioUrl: string;
  /** Enable speaker diarization */
  speakerLabels?: boolean;
  /** Expected number of speakers (improves diarization accuracy) */
  speakersExpected?: number;
  /** Language code (e.g. 'en') — omit for auto-detect */
  language?: string;
  /** Word boost list (NPC names, campaign terms, etc.) */
  wordBoost?: string[];
  /** How much to boost custom words (low | default | high) */
  boostParam?: 'low' | 'default' | 'high';
}

/**
 * Submit an audio file for async transcription.
 * Handles both local file paths (uploads first) and remote URLs.
 * Returns the AssemblyAI transcript ID for subsequent polling.
 */
export async function submitAsyncTranscription(
  options: AsyncTranscriptionOptions
): Promise<string> {
  const client = getClient();

  // If it's a local file path, upload it to AssemblyAI first
  let audioUrl = options.audioUrl;
  const isLocalPath = !audioUrl.startsWith('http://') && !audioUrl.startsWith('https://');

  if (isLocalPath) {
    console.log(`[AssemblyAI] Uploading local file: ${audioUrl}`);
    const uploadUrl = await client.files.upload(audioUrl);
    audioUrl = uploadUrl;
    console.log(`[AssemblyAI] Upload complete: ${uploadUrl}`);
  }

  const params: Record<string, unknown> = {
    audio_url: audioUrl,
    speech_models: ['universal-3-pro'],
    speaker_labels: options.speakerLabels ?? true,
  };

  if (options.speakersExpected) {
    params.speakers_expected = options.speakersExpected;
  }
  if (options.language) {
    params.language_code = options.language;
  }
  if (options.wordBoost && options.wordBoost.length > 0) {
    params.keyterms_prompt = options.wordBoost;
  }

  const transcript = await client.transcripts.submit(params as any);
  return transcript.id;
}

/**
 * Poll transcription status. Returns status string and percent complete.
 */
export async function pollTranscriptionStatus(
  transcriptId: string
): Promise<{ status: string; percentComplete: number; error?: string }> {
  const client = getClient();
  const transcript = await client.transcripts.get(transcriptId);

  // AssemblyAI statuses: queued, processing, completed, error
  let percentComplete = 0;
  if (transcript.status === 'completed') {
    percentComplete = 100;
  } else if (transcript.status === 'processing') {
    // AssemblyAI doesn't provide granular %, estimate based on status
    percentComplete = 50;
  } else if (transcript.status === 'queued') {
    percentComplete = 10;
  }

  return {
    status: transcript.status,
    percentComplete,
    error: transcript.error ?? undefined,
  };
}

/**
 * Get the full result from a completed async transcription
 * and map it to our generic TranscriptionResult interface.
 */
export async function getAsyncResult(
  transcriptId: string
): Promise<TranscriptionResult> {
  const client = getClient();
  const transcript = await client.transcripts.get(transcriptId);
  return assemblyAIToTranscriptionResult(transcript);
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/**
 * Map an AssemblyAI transcript response to our generic TranscriptionResult.
 */
export function assemblyAIToTranscriptionResult(
  aaiTranscript: AAITranscript
): TranscriptionResult {
  if (aaiTranscript.status === 'error') {
    return {
      success: false,
      text: '',
      segments: [],
      language: '',
      language_probability: 0,
      duration: 0,
      hasSpeakers: false,
      error: aaiTranscript.error ?? 'Unknown AssemblyAI error',
    };
  }

  const segments: TranscriptionSegment[] = [];
  const speakerCounts = new Map<string, number>();

  // Use utterances if speaker labels are available, otherwise fall back to words
  if (aaiTranscript.utterances && aaiTranscript.utterances.length > 0) {
    for (const utt of aaiTranscript.utterances) {
      const speaker = utt.speaker ?? undefined;
      segments.push({
        start: (utt.start ?? 0) / 1000, // ms → seconds
        end: (utt.end ?? 0) / 1000,
        text: utt.text ?? '',
        speaker,
      });
      if (speaker) {
        speakerCounts.set(speaker, (speakerCounts.get(speaker) || 0) + 1);
      }
    }
  } else if (aaiTranscript.words && aaiTranscript.words.length > 0) {
    // Group consecutive words by speaker into segments
    let currentSegment: TranscriptionSegment | null = null;

    for (const word of aaiTranscript.words) {
      const speaker = word.speaker ?? undefined;
      const wordStart = (word.start ?? 0) / 1000;
      const wordEnd = (word.end ?? 0) / 1000;

      if (
        currentSegment &&
        currentSegment.speaker === speaker &&
        wordStart - currentSegment.end < 2 // gap threshold: 2s
      ) {
        currentSegment.end = wordEnd;
        currentSegment.text += ` ${word.text}`;
      } else {
        if (currentSegment) {
          segments.push(currentSegment);
        }
        currentSegment = {
          start: wordStart,
          end: wordEnd,
          text: word.text ?? '',
          speaker,
        };
      }

      if (speaker) {
        speakerCounts.set(speaker, (speakerCounts.get(speaker) || 0) + 1);
      }
    }
    if (currentSegment) {
      segments.push(currentSegment);
    }
  }

  const hasSpeakers = speakerCounts.size > 0;
  const speakers = hasSpeakers
    ? Array.from(speakerCounts.entries()).map(([name, count]) => ({
        name,
        segmentCount: count,
      }))
    : undefined;

  // Build text with speaker labels
  let textWithSpeakers: string | undefined;
  if (hasSpeakers && segments.length > 0) {
    textWithSpeakers = segments
      .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
      .join('\n');
  }

  const durationMs = aaiTranscript.audio_duration ?? 0;

  return {
    success: true,
    text: aaiTranscript.text ?? '',
    textWithSpeakers: textWithSpeakers ?? null,
    segments,
    language: aaiTranscript.language_code ?? 'en',
    language_probability: aaiTranscript.language_confidence ?? 0,
    duration: durationMs, // AssemblyAI returns seconds
    hasSpeakers,
    speakers: speakers ?? null,
  };
}

// ---------------------------------------------------------------------------
// Word boost helpers
// ---------------------------------------------------------------------------

/**
 * Load campaign-specific word boost list (NPC names, character names, glossary terms).
 */
export async function getCampaignWordBoost(campaignId: string): Promise<string[]> {
  const words: string[] = [];

  // Load NPCs
  const npcs = await prisma.nPC.findMany({
    where: { campaignId },
    select: { name: true },
  });
  for (const npc of npcs) {
    if (npc.name) words.push(npc.name);
  }

  // Load player characters
  const members = await prisma.campaignMember.findMany({
    where: { campaignId },
    select: {
      user: {
        select: {
          characters: {
            select: { name: true },
            take: 10,
          },
        },
      },
    },
  });
  for (const member of members) {
    for (const char of member.user.characters) {
      if (char.name) words.push(char.name);
    }
  }

  // RecapForge: campaigns store party as Player rows and names as LexiconTerm,
  // not NPC/Character — pull those so fantasy names boost at the source.
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { settings: true },
  });
  if ((campaign?.settings as { recapforge?: boolean } | null)?.recapforge) {
    const terms = await prisma.lexiconTerm.findMany({
      where: { campaignId },
      select: { term: true, aliases: true },
    });
    for (const t of terms) {
      if (t.term) words.push(t.term);
      for (const a of t.aliases) if (a) words.push(a);
    }
    const players = await prisma.player.findMany({
      where: { campaignId },
      select: { characterName: true },
    });
    for (const p of players) if (p.characterName) words.push(p.characterName);
  }

  // Common D&D terms for better recognition
  const dndTerms = [
    'Dungeons and Dragons',
    'initiative',
    'perception',
    'investigation',
    'persuasion',
    'deception',
    'intimidation',
    'stealth',
    'arcana',
    'athletics',
    'acrobatics',
    'hit points',
    'armor class',
    'saving throw',
    'spell slot',
    'cantrip',
    'advantage',
    'disadvantage',
    'natural twenty',
    'critical hit',
  ];
  words.push(...dndTerms);

  // Deduplicate and filter empties
  return [...new Set(words.filter(Boolean))];
}

// ---------------------------------------------------------------------------
// Streaming (real-time) API
// ---------------------------------------------------------------------------

/**
 * Create a real-time transcriber session with AssemblyAI.
 */
export function createRealtimeTranscriber(
  options: RealtimeTranscriberOptions
): RealtimeTranscriberHandle {
  const client = getClient();

  const rt = client.realtime.transcriber({
    sampleRate: options.sampleRate ?? 16000,
    wordBoost: options.wordBoost,
  });

  rt.on('transcript', (transcript) => {
    if (!options.onTranscript) return;

    const turn: RealtimeTranscriptTurn = {
      text: transcript.text ?? '',
      isFinal: transcript.message_type === 'FinalTranscript',
      words: transcript.words?.map((w) => ({
        text: w.text ?? '',
        start: w.start ?? 0,
        end: w.end ?? 0,
        confidence: w.confidence ?? 0,
      })),
      timestamp: Date.now(),
    };

    options.onTranscript(turn);
  });

  rt.on('error', (error) => {
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
  });

  rt.on('open', () => {
    options.onOpen?.();
  });

  rt.on('close', (code: number, reason: string) => {
    options.onClose?.(code, reason);
  });

  return {
    connect: async () => { await rt.connect(); },
    sendAudio: (chunk: Buffer) => rt.sendAudio(chunk.buffer as ArrayBuffer),
    close: async (waitForCompletion?: boolean) => { await rt.close(waitForCompletion); },
  };
}
