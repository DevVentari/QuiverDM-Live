/**
 * Process Eye of Ruin Session 7 — Jan 25 2026 recording
 * 1. Extract audio from MP4 via ffmpeg (copy stream, fast)
 * 2. Upload audio to prod R2
 * 3. Create session 7 + SessionRecording + TranscriptionJob in prod DB
 * 4. Queue BullMQ job to prod Upstash Redis
 *
 * Run: DATABASE_URL="<prod>" REDIS_URL="<prod>" node scripts/process-eor-session7.mjs
 */
import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { readFile, rm } from 'fs/promises';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { URL } from 'url';

const MP4_PATH = 'E:/Projects/QuiverDM/docs/eye of ruin/2026-01-25 18-53-22.mp4';
const AUDIO_PATH = 'E:/Projects/QuiverDM/docs/eye of ruin/session7-audio.m4a';
const FFMPEG = 'C:/tools/ffmpeg/bin/ffmpeg.exe';

const R2_ACCOUNT_ID = 'f035ca1076a8341cfda39b5b9ee797f5';
const R2_ACCESS_KEY_ID = '284008e3bd8463b2d56b43445c6e8392';
const R2_SECRET_ACCESS_KEY = 'f06c630c0b668249511be2347d55a54794b7443be93a49292240d423ca890fff';
const R2_BUCKET = 'quiverdm';

const CAMPAIGN_ID = 'eor-campaign-id';
const USER_ID = 'cmmhnjt720001am5akp79kcx2'; // dev@blakewales.au

const R2_KEY = `session-recordings/${USER_ID}/${CAMPAIGN_ID}/session7-2026-01-25.m4a`;

async function main() {
  console.log('=== Eye of Ruin Session 7 Processing ===\n');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  if (!process.env.REDIS_URL) {
    console.error('REDIS_URL not set');
    process.exit(1);
  }

  // Step 1: Check MP4 exists
  if (!existsSync(MP4_PATH)) {
    console.error('MP4 not found:', MP4_PATH);
    process.exit(1);
  }
  const mp4Size = statSync(MP4_PATH).size;
  console.log(`MP4: ${(mp4Size / 1e9).toFixed(2)} GB`);

  // Step 2: Extract audio from MP4
  console.log('\n--- Step 1: Extract audio ---');
  if (existsSync(AUDIO_PATH)) {
    console.log('Audio already extracted:', AUDIO_PATH);
  } else {
    console.log('Extracting audio stream (no re-encode)...');
    await new Promise((resolve, reject) => {
      const proc = spawn(FFMPEG, [
        '-i', MP4_PATH,
        '-vn',           // no video
        '-acodec', 'copy',  // copy audio stream as-is
        '-y',
        AUDIO_PATH,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); process.stdout.write('.'); });
      proc.on('close', code => {
        console.log('');
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-800)}`));
      });
    });
  }
  const audioSize = statSync(AUDIO_PATH).size;
  console.log(`Audio: ${(audioSize / 1e6).toFixed(1)} MB`);

  // Step 3: Upload audio to R2 via multipart
  console.log('\n--- Step 2: Upload to R2 ---');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  const audioBuffer = await readFile(AUDIO_PATH);
  const PART_SIZE = 100 * 1024 * 1024; // 100MB parts
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET, Key: R2_KEY, ContentType: 'audio/mp4',
  }));

  const parts = [];
  let partNumber = 1;
  let offset = 0;
  while (offset < audioBuffer.length) {
    const chunk = audioBuffer.subarray(offset, offset + PART_SIZE);
    process.stdout.write(`  Part ${partNumber} (${(chunk.length / 1e6).toFixed(0)} MB)...`);
    const { ETag } = await s3.send(new UploadPartCommand({
      Bucket: R2_BUCKET, Key: R2_KEY, UploadId, PartNumber: partNumber, Body: chunk,
    }));
    parts.push({ PartNumber: partNumber, ETag });
    partNumber++;
    offset += PART_SIZE;
    console.log(' done');
  }

  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET, Key: R2_KEY, UploadId,
    MultipartUpload: { Parts: parts },
  }));
  console.log('Uploaded:', R2_KEY);

  // Step 4: Create session + recording + transcription job in DB
  console.log('\n--- Step 3: Create DB records ---');
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

  // Session 7
  let session = await prisma.gameSession.findFirst({
    where: { campaignId: CAMPAIGN_ID, sessionNumber: 7 },
  });
  if (!session) {
    session = await prisma.gameSession.create({
      data: {
        id: 'eor-session-7',
        campaignId: CAMPAIGN_ID,
        sessionNumber: 7,
        title: 'Session 7 — January 25 2026',
        status: 'completed',
        date: new Date('2026-01-25'),
      },
    });
    console.log('Created session 7:', session.id);
  } else {
    console.log('Session 7 exists:', session.id);
  }

  // SessionRecording
  let recording = await prisma.sessionRecording.findFirst({ where: { sessionId: session.id } });
  if (!recording) {
    recording = await prisma.sessionRecording.create({
      data: {
        sessionId: session.id,
        type: 'audio',
        originalUrl: R2_KEY,  // key, not full URL — worker generates signed URL
        fileSize: audioSize,
        processingStatus: 'queued',
      },
    });
    console.log('Created recording:', recording.id);
  } else {
    console.log('Recording exists:', recording.id);
  }

  // TranscriptionJob
  let txJob = await prisma.transcriptionJob.findFirst({ where: { sessionId: session.id } });
  if (!txJob) {
    txJob = await prisma.transcriptionJob.create({
      data: {
        sessionId: session.id,
        recordingId: recording.id,
        filePath: R2_KEY,
        modelSize: 'medium',
        useGPU: false,
        useSpeakers: true,
        status: 'queued',
        progress: 0,
        currentChunk: 0,
        totalChunks: 0,
      },
    });
    console.log('Created transcription job:', txJob.id);
  } else {
    console.log('Transcription job exists:', txJob.id);
  }

  await prisma.$disconnect();

  // Step 5: Queue BullMQ job to prod Upstash
  console.log('\n--- Step 4: Queue BullMQ job ---');
  const redisUrl = new URL(process.env.REDIS_URL);
  const useTls = redisUrl.protocol === 'rediss:';
  const queue = new Queue('transcription-processing', {
    connection: {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port || (useTls ? '6380' : '6379')),
      password: redisUrl.password || undefined,
      username: redisUrl.username !== 'default' ? redisUrl.username : undefined,
      maxRetriesPerRequest: null,
      ...(useTls ? { tls: {} } : {}),
    },
    defaultJobOptions: { attempts: 2 },
  });

  await queue.add('transcribe', {
    jobId: txJob.id,
    sessionId: session.id,
    recordingId: recording.id,
    userId: USER_ID,
    audioUrl: R2_KEY,
    isVideo: false,
    speakerLabels: true,
    deleteOriginalFile: false,
    fileUrl: R2_KEY,
  });
  await queue.close();
  console.log('BullMQ job queued — Hetzner worker will pick it up.');

  console.log('\n=== Done ===');
  console.log('Session:', session.id);
  console.log('Recording:', recording.id);
  console.log('Transcription job:', txJob.id);
  console.log('\nOnce transcription completes:');
  console.log('- Update session title from transcript');
  console.log('- Visit: https://quiverdm.com/campaigns/vecna-eye-of-ruin/sessions/' + session.id);
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
