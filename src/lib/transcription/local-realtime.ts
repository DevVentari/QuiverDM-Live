/**
 * Local Real-Time Transcription Adapter (WhisperLive)
 *
 * A drop-in alternative to the AssemblyAI realtime transcriber that streams
 * audio to a self-hosted WhisperLive server (faster-whisper backend) over a
 * WebSocket. It satisfies the same RealtimeTranscriberHandle contract, so
 * live-session-manager.ts and the WebSocket server are unaware it exists —
 * selection happens in realtime-provider.ts via STT_REALTIME_PROVIDER.
 *
 * WhisperLive protocol (server: ws://host:9090):
 *   1. On open, send a JSON config: { uid, language, task, model, use_vad }.
 *   2. Stream raw little-endian Float32 PCM @ 16 kHz mono as binary frames.
 *   3. Server replies with JSON: { message: 'SERVER_READY' } then rolling
 *      { uid, segments: [{ start, end, text, completed? }] } updates.
 *
 * The browser sends Int16 PCM at the AudioContext sample rate, so this adapter
 * converts Int16 → Float32 and resamples to 16 kHz when needed.
 */

import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type {
  RealtimeTranscriberOptions,
  RealtimeTranscriberHandle,
  RealtimeTranscriptTurn,
} from './types';

const TARGET_SAMPLE_RATE = 16_000;

// ---------------------------------------------------------------------------
// Pure segment → turn mapping (unit-tested in __tests__/local-realtime.test.ts)
// ---------------------------------------------------------------------------

export interface WhisperLiveSegment {
  start: number | string;
  end: number | string;
  text: string;
  /** WhisperLive marks finalized segments; older builds omit it (last = in-progress). */
  completed?: boolean;
}

/**
 * Translate a WhisperLive `segments` window into realtime turns.
 *
 * WhisperLive re-sends a rolling window of the last N segments on every update,
 * so we dedup finalized segments via `finalizedKeys` (mutated in place) to emit
 * each one as `isFinal: true` exactly once. The trailing in-progress segment is
 * emitted as an interim (`isFinal: false`) turn, which the client reducer folds.
 *
 * A segment counts as final when `completed === true`, or — for servers that
 * omit the field — when it is not the last segment in the window.
 *
 * Returned turns carry `timestamp: 0`; the adapter stamps wall-clock time before
 * dispatch so this stays pure and testable.
 */
export function mapWhisperLiveSegments(
  segments: WhisperLiveSegment[],
  finalizedKeys: Set<string>
): RealtimeTranscriptTurn[] {
  const turns: RealtimeTranscriptTurn[] = [];
  const lastIdx = segments.length - 1;

  segments.forEach((seg, i) => {
    const text = (seg.text ?? '').trim();
    if (!text) return;

    const isLast = i === lastIdx;
    const isFinal = seg.completed === true || (seg.completed === undefined && !isLast);

    if (isFinal) {
      const key = `${seg.start}|${text}`;
      if (finalizedKeys.has(key)) return;
      finalizedKeys.add(key);
      turns.push({ text, isFinal: true, timestamp: 0 });
    } else if (isLast) {
      turns.push({ text, isFinal: false, timestamp: 0 });
    }
  });

  return turns;
}

// ---------------------------------------------------------------------------
// Audio conversion helpers
// ---------------------------------------------------------------------------

/** Int16 LE PCM buffer → normalized Float32 samples in [-1, 1]. */
function int16BufferToFloat32(chunk: Buffer): Float32Array {
  const sampleCount = Math.floor(chunk.length / 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    // readInt16LE is offset-safe regardless of Buffer alignment.
    out[i] = chunk.readInt16LE(i * 2) / 0x8000;
  }
  return out;
}

/**
 * Linear-interpolation resampler. Whisper's input is band-limited to ~8 kHz and
 * speech energy sits well below the Nyquist limit, so naive linear resampling is
 * adequate for STT (an anti-aliased polyphase filter would be overkill here).
 */
export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const lo = Math.floor(srcPos);
    const hi = Math.min(lo + 1, input.length - 1);
    const frac = srcPos - lo;
    out[i] = input[lo] * (1 - frac) + input[hi] * frac;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export function createLocalRealtimeTranscriber(
  options: RealtimeTranscriberOptions
): RealtimeTranscriberHandle {
  const url = process.env.WHISPERLIVE_URL ?? 'ws://192.168.1.21:9090';
  const model = process.env.WHISPERLIVE_MODEL ?? 'large-v3';
  const inputRate = options.sampleRate ?? TARGET_SAMPLE_RATE;
  const uid = `qdm-${randomUUID()}`;

  let ws: WebSocket | null = null;
  let ready = false;
  const finalizedKeys = new Set<string>();
  // Audio that arrives before SERVER_READY is buffered (bounded) and flushed.
  const pending: Buffer[] = [];
  const MAX_PENDING = 64;

  const flushPending = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    for (const frame of pending) ws.send(frame);
    pending.length = 0;
  };

  const encodeFrame = (chunk: Buffer): Buffer => {
    let floats = int16BufferToFloat32(chunk);
    if (inputRate !== TARGET_SAMPLE_RATE) {
      floats = resampleLinear(floats, inputRate, TARGET_SAMPLE_RATE);
    }
    return Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength);
  };

  const handleMessage = (raw: WebSocket.RawData) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // ignore non-JSON frames
    }
    if (msg.uid && msg.uid !== uid) return;

    if (msg.message === 'SERVER_READY') {
      ready = true;
      options.onOpen?.();
      flushPending();
      return;
    }
    if (msg.status === 'WAIT') {
      options.onError?.(
        new Error(`WhisperLive server busy — estimated wait ${msg.message ?? '?'} min`)
      );
      return;
    }
    if (msg.message === 'DISCONNECT') {
      options.onClose?.(1000, 'server requested disconnect');
      return;
    }

    if (Array.isArray(msg.segments)) {
      const turns = mapWhisperLiveSegments(msg.segments as WhisperLiveSegment[], finalizedKeys);
      for (const turn of turns) {
        options.onTranscript?.({ ...turn, timestamp: Date.now() });
      }
    }
  };

  return {
    connect: () =>
      new Promise<void>((resolve, reject) => {
        try {
          ws = new WebSocket(url);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        ws.binaryType = 'arraybuffer';

        ws.on('open', () => {
          ws?.send(
            JSON.stringify({
              uid,
              language: 'en',
              task: 'transcribe',
              model,
              use_vad: true,
              send_last_n_segments: 10,
              // faster-whisper honors initial_prompt for domain priming (NPC/PC
              // names, D&D terms). Unknown keys are ignored by WhisperLive.
              ...(options.wordBoost?.length
                ? { initial_prompt: options.wordBoost.join(', ') }
                : {}),
            })
          );
          // Resolve on open; SERVER_READY flips `ready` and flushes buffered audio.
          resolve();
        });
        ws.on('message', handleMessage);
        ws.on('error', (err: Error) => options.onError?.(err));
        ws.on('close', (code: number, reason: Buffer) =>
          options.onClose?.(code, reason?.toString() ?? '')
        );
      }),

    sendAudio: (chunk: Buffer) => {
      const frame = encodeFrame(chunk);
      if (ready && ws?.readyState === WebSocket.OPEN) {
        ws.send(frame);
      } else if (pending.length < MAX_PENDING) {
        pending.push(frame);
      }
      // else: drop — VAD recovers; better than unbounded memory growth.
    },

    close: async () => {
      ready = false;
      pending.length = 0;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
    },
  };
}
