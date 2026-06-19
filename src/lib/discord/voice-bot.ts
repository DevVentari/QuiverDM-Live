/**
 * QuiverDM Discord Voice Bot — record mode (Phase 1).
 *
 * Joins a campaign's voice channel and records each speaker to their own audio
 * track. Because the stream is keyed by Discord user id, each track is labelled
 * with the speaker's *character name* (resolveDiscordVoiceToCharacter) — so the
 * downstream multi-track merge produces a diarized transcript with real names,
 * no manual mapping. On stop, tracks are uploaded and the existing
 * `multi-track-processing` job transcribes + merges them.
 *
 * This runs as its own long-lived process (see src/server/discord-voice-bot.ts),
 * decoupled from the web/tRPC process via a Redis control channel — a tRPC
 * mutation publishes {action,...}, the bot acts. The web process never holds a
 * Discord gateway connection.
 *
 * Runtime verification is manual (homelab runbook) — the gateway + voice receive
 * can't run in CI. The unit-tested logic lives in identity.ts.
 */

import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import {
  joinVoiceChannel,
  EndBehaviorType,
  getVoiceConnection,
  type VoiceConnection,
} from '@discordjs/voice';
import prism from 'prism-media';
import { promises as fsp, createWriteStream, type WriteStream } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'node:crypto';
import { WebSocket as WsClient } from 'ws';
import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { addMultiTrackJob } from '@/lib/queue/multi-track-queue';
import { mintLiveSessionToken } from '@/lib/live/ws-token';
import { resampleLinear } from '@/lib/transcription/local-realtime';
import { resolveDiscordVoiceToCharacter } from './identity';

export const VOICE_CONTROL_CHANNEL = 'discord-voice-control';

/** Discord delivers Opus @ 48 kHz stereo; we downmix to mono and store as WAV. */
const DISCORD_SAMPLE_RATE = 48_000;

export interface VoiceControlMessage {
  action: 'start' | 'stop';
  campaignId: string;
  sessionId: string;
  /** Required for `start`. */
  guildId?: string;
  voiceChannelId?: string;
}

interface UserTrack {
  discordUserId: string;
  filePath: string;
  stream: WriteStream;
  /** True while an Opus subscription is actively piping into this track. */
  subscribed: boolean;
}

interface ActiveRecording {
  campaignId: string;
  sessionId: string;
  uploadGroupId: string;
  connection: VoiceConnection;
  tracks: Map<string, UserTrack>;
  /** A3 hybrid: live-caption feed to the WS server (mixed/forwarded), or null. */
  liveWs: WsClient | null;
}

/** Sample rate of the live-caption feed sent to the WS server (STT-native). */
const LIVE_SAMPLE_RATE = 16_000;

const recordings = new Map<string, ActiveRecording>();

// ---------------------------------------------------------------------------
// Discord client (lazy singleton)
// ---------------------------------------------------------------------------

let clientPromise: Promise<Client> | null = null;

function getDiscordClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const token = process.env.DISCORD_BOT_TOKEN ?? process.env.QUIVERDM_DISCORD_BOT_TOKEN;
      if (!token) throw new Error('DISCORD_BOT_TOKEN not set');
      const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      });
      await client.login(token);
      await new Promise<void>((resolve) => {
        if (client.isReady()) resolve();
        else client.once('ready', () => resolve());
      });
      return client;
    })();
  }
  return clientPromise;
}

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

/** Downmix interleaved s16le stereo → mono by averaging L/R. */
function downmixStereoToMono(stereo: Buffer): Buffer {
  const frames = Math.floor(stereo.length / 4); // 2 ch × 2 bytes
  const mono = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const l = stereo.readInt16LE(i * 4);
    const r = stereo.readInt16LE(i * 4 + 2);
    mono.writeInt16LE((l + r) >> 1, i * 2);
  }
  return mono;
}

/** 44-byte PCM WAV header for the given data length (mono s16le). */
function wavHeader(dataLength: number, sampleRate = DISCORD_SAMPLE_RATE): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLength, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE((sampleRate * channels * bitsPerSample) / 8, 28);
  buf.writeUInt16LE((channels * bitsPerSample) / 8, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLength, 40);
  return buf;
}

/** Mono s16le @ 48 kHz → mono s16le @ 16 kHz for the live caption feed. */
function downsampleTo16k(mono48: Buffer): Buffer {
  const n = Math.floor(mono48.length / 2);
  const f32 = new Float32Array(n);
  for (let i = 0; i < n; i++) f32[i] = mono48.readInt16LE(i * 2) / 0x8000;
  const out = resampleLinear(f32, DISCORD_SAMPLE_RATE, LIVE_SAMPLE_RATE);
  const buf = Buffer.alloc(out.length * 2);
  for (let i = 0; i < out.length; i++) {
    const s = Math.max(-1, Math.min(1, out[i]));
    buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, i * 2);
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

async function announce(channelId: string, content: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN ?? process.env.QUIVERDM_DISCORD_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    console.warn('[VoiceBot] consent announce failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

function ensureTrack(rec: ActiveRecording, discordUserId: string): UserTrack {
  let track = rec.tracks.get(discordUserId);
  if (!track) {
    const filePath = path.join(
      os.tmpdir(),
      `qdm-voice-${rec.uploadGroupId}-${discordUserId}.pcm`
    );
    track = {
      discordUserId,
      filePath,
      stream: createWriteStream(filePath),
      subscribed: false,
    };
    rec.tracks.set(discordUserId, track);
  }
  return track;
}

function subscribeToSpeaker(rec: ActiveRecording, discordUserId: string): void {
  const track = ensureTrack(rec, discordUserId);
  if (track.subscribed) return; // already capturing this utterance
  track.subscribed = true;

  const opusStream = rec.connection.receiver.subscribe(discordUserId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 },
  });
  const decoder = new prism.opus.Decoder({ rate: DISCORD_SAMPLE_RATE, channels: 2, frameSize: 960 });

  decoder.on('data', (chunk: Buffer) => {
    const mono = downmixStereoToMono(chunk);
    // Record: full-quality 48 kHz mono to the per-user track (authoritative).
    track.stream.write(mono);
    // Live captions (A3): forward a 16 kHz copy to the WS server. Tracks are
    // forwarded as they arrive — overlapping speech may garble the ephemeral
    // captions, but the saved transcript comes from the per-track merge.
    if (rec.liveWs && rec.liveWs.readyState === WsClient.OPEN) {
      try {
        rec.liveWs.send(downsampleTo16k(mono));
      } catch {
        /* live feed is best-effort */
      }
    }
  });
  const done = () => {
    track.subscribed = false;
  };
  opusStream.on('end', done);
  opusStream.on('error', done);
  opusStream.pipe(decoder as unknown as NodeJS.WritableStream);
}

/**
 * Open the live-caption feed: mint a token for the campaign owner, connect to
 * the WS server as a client, and start a deferred-save live session. Best-effort
 * — if the WS server is unreachable, recording continues without live captions.
 */
async function connectLiveFeed(rec: ActiveRecording): Promise<void> {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: rec.campaignId },
      select: { userId: true },
    });
    if (!campaign?.userId) return;

    const token = await mintLiveSessionToken({
      sessionId: rec.sessionId,
      campaignId: rec.campaignId,
      userId: campaign.userId,
      sampleRate: LIVE_SAMPLE_RATE,
      deferSave: true, // the per-track merge is authoritative
    });

    const url = process.env.WS_INTERNAL_URL ?? process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3004';
    const ws = new WsClient(url);
    ws.binaryType = 'arraybuffer';
    ws.on('open', () => {
      ws.send(
        JSON.stringify({ type: 'join_live_session', sessionId: rec.sessionId, token, sampleRate: LIVE_SAMPLE_RATE })
      );
    });
    ws.on('error', (err: Error) => console.warn('[VoiceBot] live feed error:', err.message));
    rec.liveWs = ws;
  } catch (err) {
    console.warn('[VoiceBot] could not open live caption feed:', err);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function startRecording(msg: VoiceControlMessage): Promise<void> {
  if (!msg.guildId || !msg.voiceChannelId) {
    throw new Error('startRecording requires guildId and voiceChannelId');
  }
  if (recordings.has(msg.sessionId)) {
    console.warn(`[VoiceBot] already recording session ${msg.sessionId}`);
    return;
  }

  const client = await getDiscordClient();
  const guild = await client.guilds.fetch(msg.guildId);
  const channel = await guild.channels.fetch(msg.voiceChannelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new Error(`Channel ${msg.voiceChannelId} is not a voice channel`);
  }

  const connection = joinVoiceChannel({
    channelId: msg.voiceChannelId,
    guildId: msg.guildId,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false, // must hear to receive
    selfMute: true,
  });

  const rec: ActiveRecording = {
    campaignId: msg.campaignId,
    sessionId: msg.sessionId,
    uploadGroupId: randomUUID(),
    connection,
    tracks: new Map(),
    liveWs: null,
  };
  recordings.set(msg.sessionId, rec);

  // A3 hybrid: open the live-caption feed (best-effort) alongside recording.
  await connectLiveFeed(rec);

  connection.receiver.speaking.on('start', (userId: string) => {
    try {
      subscribeToSpeaker(rec, userId);
    } catch (err) {
      console.error('[VoiceBot] subscribe failed:', err);
    }
  });

  await announce(
    msg.voiceChannelId,
    '🎙️ **QuiverDM is now recording this session.** Each voice is captured to its own track for transcription. Leave the channel or ask the DM to stop to end recording.'
  );
  console.log(`[VoiceBot] recording session ${msg.sessionId} in ${msg.voiceChannelId}`);
}

export async function stopRecording(sessionId: string): Promise<void> {
  const rec = recordings.get(sessionId);
  if (!rec) {
    console.warn(`[VoiceBot] no active recording for session ${sessionId}`);
    return;
  }
  recordings.delete(sessionId);

  // Stop the live-caption feed (deferred save → no transcript written here).
  if (rec.liveWs) {
    try {
      if (rec.liveWs.readyState === WsClient.OPEN) {
        rec.liveWs.send(JSON.stringify({ type: 'stop_live', sessionId }));
      }
      rec.liveWs.close();
    } catch {
      /* ignore */
    }
    rec.liveWs = null;
  }

  // Tear down the voice connection first so no more audio arrives.
  try {
    rec.connection.destroy();
  } catch {
    /* ignore */
  }

  // Close all track files and wait for flush.
  await Promise.all(
    [...rec.tracks.values()].map(
      (t) =>
        new Promise<void>((resolve) => {
          t.stream.end(() => resolve());
        })
    )
  );

  const speakerIds = [...rec.tracks.keys()];
  let createdAny = false;

  for (let i = 0; i < speakerIds.length; i++) {
    const track = rec.tracks.get(speakerIds[i])!;
    try {
      const pcm = await fsp.readFile(track.filePath);
      if (pcm.length === 0) continue; // silent track — skip

      const wav = Buffer.concat([wavHeader(pcm.length), pcm]);
      const key = `session-recordings/${rec.campaignId}/${rec.sessionId}/${rec.uploadGroupId}/${track.discordUserId}.wav`;
      await storage.upload(key, wav, 'audio/wav');

      const resolved = await resolveDiscordVoiceToCharacter(rec.campaignId, track.discordUserId, {
        fallbackLabel: `Speaker ${i + 1}`,
      });

      await prisma.sessionRecording.create({
        data: {
          sessionId: rec.sessionId,
          type: 'audio',
          originalUrl: `/api/storage/${key}`,
          fileSize: wav.length,
          isMultiTrack: true,
          uploadGroupId: rec.uploadGroupId,
          speakerTag: resolved.characterName,
          processingStatus: 'queued',
          mergeStatus: 'pending',
        },
      });
      createdAny = true;
    } catch (err) {
      console.error(`[VoiceBot] failed to finalize track ${track.discordUserId}:`, err);
    } finally {
      await fsp.rm(track.filePath, { force: true }).catch(() => {});
    }
  }

  if (createdAny) {
    await addMultiTrackJob({
      uploadGroupId: rec.uploadGroupId,
      sessionId: rec.sessionId,
      campaignId: rec.campaignId,
    });
    console.log(`[VoiceBot] enqueued multi-track job for session ${sessionId}`);
  } else {
    console.warn(`[VoiceBot] no non-silent tracks for session ${sessionId}; nothing enqueued`);
  }
}

/** Route a control-channel message to the right lifecycle action. */
export async function handleControlMessage(raw: string): Promise<void> {
  let msg: VoiceControlMessage;
  try {
    msg = JSON.parse(raw) as VoiceControlMessage;
  } catch {
    console.warn('[VoiceBot] ignoring malformed control message');
    return;
  }
  if (msg.action === 'start') await startRecording(msg);
  else if (msg.action === 'stop') await stopRecording(msg.sessionId);
}

/** Whether a session currently has an active recording (for status checks/tests). */
export function isRecording(sessionId: string): boolean {
  return recordings.has(sessionId);
}

export { getVoiceConnection };
