import { PrismaClient } from '@prisma/client';
import { assert, cleanupUser, createBaseContext, type Assertion } from './workflow-test-utils';

const prisma = new PrismaClient();

async function main() {
  const assertions: Assertion[] = [];
  let ownerId: string | null = null;

  try {
    const { owner, campaign } = await createBaseContext(prisma, 'transcription-wf');
    ownerId = owner.id;

    const session = await prisma.gameSession.create({
      data: {
        campaignId: campaign.id,
        sessionNumber: 1,
        title: 'Transcription Workflow Session',
      },
    });
    assert(assertions, 'Session created', !!session.id);

    const recording = await prisma.sessionRecording.create({
      data: {
        sessionId: session.id,
        type: 'audio',
        originalUrl: '/api/files/recordings/transcription-test.mp3',
        fileSize: 2048,
        durationSeconds: 120,
        processingStatus: 'queued',
      },
    });
    assert(assertions, 'Recording created', !!recording.id);

    const job = await prisma.transcriptionJob.create({
      data: {
        sessionId: session.id,
        recordingId: recording.id,
        filePath: '/tmp/transcription-test.mp3',
        speakerNames: ['DM', 'Player 1'],
        status: 'processing',
        progress: 50,
      },
    });
    assert(assertions, 'Transcription job created', !!job.id);

    const transcript = await prisma.transcript.create({
      data: {
        sessionId: session.id,
        recordingId: recording.id,
        rawText: 'DM: Welcome to the game.\nPlayer 1: Let us begin.',
        correctedText: 'DM: Welcome to the game. Player 1: Let us begin.',
        hasSpeakers: true,
      },
    });
    assert(assertions, 'Transcript created', !!transcript.id);

    await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        transcriptId: transcript.id,
        completedAt: new Date(),
      },
    });

    await prisma.sessionRecording.update({
      where: { id: recording.id },
      data: {
        processingStatus: 'completed',
      },
    });

    const completedJob = await prisma.transcriptionJob.findUnique({ where: { id: job.id } });
    assert(assertions, 'Job completed', completedJob?.status === 'completed');
    assert(assertions, 'Transcript linked to job', completedJob?.transcriptId === transcript.id);

    await prisma.transcript.delete({ where: { id: transcript.id } });
    await prisma.transcriptionJob.delete({ where: { id: job.id } });
    await prisma.sessionRecording.delete({ where: { id: recording.id } });
    await prisma.gameSession.delete({ where: { id: session.id } });

    console.log('Transcription workflow assertions passed:', assertions.length);
  } finally {
    if (ownerId) {
      await cleanupUser(prisma, ownerId).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('Transcription workflow test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});

