import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Mark all processing/queued jobs as failed
    const result = await prisma.transcriptionJob.updateMany({
      where: {
        OR: [
          { status: 'processing' },
          { status: 'queued' },
        ],
      },
      data: {
        status: 'failed',
        errorMessage: 'Job cleanup - server restarted',
      },
    });

    console.log(`✅ Cleaned up ${result.count} stale job(s)`);
  } catch (error) {
    console.error('❌ Error cleaning up jobs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
