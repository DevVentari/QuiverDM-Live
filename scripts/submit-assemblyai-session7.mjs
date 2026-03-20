/**
 * Upload session7 audio directly to AssemblyAI, submit transcript request,
 * then poll until complete and save to DB.
 *
 * Run: node scripts/submit-assemblyai-session7.mjs
 */
import { AssemblyAI } from 'assemblyai';
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';

const AUDIO_PATH = 'E:/Projects/QuiverDM/docs/eye of ruin/session7-audio.m4a';
const ASSEMBLYAI_API_KEY = 'e14fb23d631743b1a9e73053cf929915';
const SESSION_ID = 'eor-session-7';
const RECORDING_ID = 'cmmrwin9b0001kmowxajzdm99';
const TX_JOB_ID = 'cmmrwinb10002kmowc5svdxe4';

async function main() {
  if (!existsSync(AUDIO_PATH)) {
    console.error('Audio not found:', AUDIO_PATH);
    process.exit(1);
  }

  const client = new AssemblyAI({ apiKey: ASSEMBLYAI_API_KEY });
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

  // Step 1: Upload audio to AssemblyAI CDN
  console.log('Uploading audio to AssemblyAI...');
  const uploadUrl = await client.files.upload(AUDIO_PATH);
  console.log('Upload URL:', uploadUrl);

  // Step 2: Submit transcript request
  console.log('\nSubmitting transcript...');
  const transcript = await client.transcripts.submit({
    audio_url: uploadUrl,
    speaker_labels: true,
    speech_model: 'best',
  } as any);
  console.log('Transcript ID:', transcript.id);

  // Step 3: Update DB with assemblyai transcript ID
  await prisma.sessionRecording.update({
    where: { id: RECORDING_ID },
    data: { processingStatus: 'processing' },
  });
  await prisma.transcriptionJob.update({
    where: { id: TX_JOB_ID },
    data: {
      status: 'processing',
      assemblyaiTranscriptId: transcript.id,
      currentStep: 'waiting_for_assemblyai',
      startedAt: new Date(),
    },
  });
  console.log('DB updated. Polling for completion...');

  // Step 4: Poll until complete
  let pollStatus = await client.transcripts.get(transcript.id);
  let attempts = 0;
  while (pollStatus.status !== 'completed' && pollStatus.status !== 'error') {
    await new Promise(r => setTimeout(r, 10000)); // 10s poll
    pollStatus = await client.transcripts.get(transcript.id);
    attempts++;
    process.stdout.write(`[${attempts}] ${pollStatus.status}... `);
    if (attempts % 6 === 0) console.log('');
  }
  console.log('\n\nFinal status:', pollStatus.status);

  if (pollStatus.status === 'error') {
    console.error('Transcription error:', pollStatus.error);
    await prisma.transcriptionJob.update({
      where: { id: TX_JOB_ID },
      data: { status: 'failed', errorMessage: pollStatus.error ?? 'unknown' },
    });
    await prisma.$disconnect();
    process.exit(1);
  }

  // Step 5: Save transcript to DB
  const text = pollStatus.text ?? '';
  const words = (pollStatus.words as any[]) ?? [];
  const utterances = (pollStatus.utterances as any[]) ?? [];

  // Build segments from utterances (speaker diarization)
  const segments = utterances.map((u: any) => ({
    speaker: u.speaker,
    text: u.text,
    startMs: u.start,
    endMs: u.end,
  }));

  // Save transcript
  const savedTranscript = await prisma.transcript.upsert({
    where: { sessionId: SESSION_ID },
    create: {
      sessionId: SESSION_ID,
      recordingId: RECORDING_ID,
      text,
      language: pollStatus.language_code ?? 'en',
      durationSeconds: Math.round((pollStatus.audio_duration ?? 0)),
      segments,
      words,
    },
    update: {
      text,
      language: pollStatus.language_code ?? 'en',
      durationSeconds: Math.round((pollStatus.audio_duration ?? 0)),
      segments,
      words,
    },
  });
  console.log('Transcript saved:', savedTranscript.id, `(${text.length} chars, ${segments.length} utterances)`);

  // Update job status
  await prisma.transcriptionJob.update({
    where: { id: TX_JOB_ID },
    data: { status: 'completed', progress: 100, completedAt: new Date() },
  });
  await prisma.sessionRecording.update({
    where: { id: RECORDING_ID },
    data: { processingStatus: 'completed' },
  });

  // Extract likely session title from first few utterances
  const intro = text.slice(0, 500);
  console.log('\n=== Transcript preview (first 500 chars) ===');
  console.log(intro);

  await prisma.$disconnect();
  console.log('\n=== Done ===');
  console.log('Session 7 transcript is ready.');
  console.log('Visit: https://quiverdm.com/campaigns/vecna-eye-of-ruin/sessions/eor-session-7');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
