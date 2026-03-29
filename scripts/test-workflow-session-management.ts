import { PrismaClient } from '@prisma/client';
import { assert, cleanupUser, createBaseContext, type Assertion } from './workflow-test-utils';

const prisma = new PrismaClient();

async function main() {
  const assertions: Assertion[] = [];
  let ownerId: string | null = null;

  try {
    const { owner, campaign } = await createBaseContext(prisma, 'session-wf');
    ownerId = owner.id;

    const session = await prisma.gameSession.create({
      data: {
        campaignId: campaign.id,
        sessionNumber: 1,
        title: 'Session Workflow Test',
      },
    });
    assert(assertions, 'Session created', !!session.id);

    const updatedSession = await prisma.gameSession.update({
      where: { id: session.id },
      data: { title: 'Session Workflow Test Updated' },
    });
    assert(assertions, 'Session updated', updatedSession.title?.includes('Updated') ?? false);

    const recording = await prisma.sessionRecording.create({
      data: {
        sessionId: session.id,
        type: 'audio',
        originalUrl: '/api/files/recordings/test.mp3',
        fileSize: 1024,
        durationSeconds: 60,
      },
    });
    assert(assertions, 'Recording created', !!recording.id);

    const recordings = await prisma.sessionRecording.findMany({
      where: { sessionId: session.id },
    });
    assert(assertions, 'Recording retrievable', recordings.length === 1, `count=${recordings.length}`);

    await prisma.sessionRecording.delete({ where: { id: recording.id } });
    await prisma.gameSession.delete({ where: { id: session.id } });

    const sessionAfterDelete = await prisma.gameSession.findUnique({ where: { id: session.id } });
    assert(assertions, 'Session deleted', !sessionAfterDelete);

    console.log('Session workflow assertions passed:', assertions.length);
  } finally {
    if (ownerId) {
      await cleanupUser(prisma, ownerId).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('Session workflow test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});

