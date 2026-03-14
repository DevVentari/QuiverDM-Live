/**
 * Queue image generation jobs for all homebrew content without images.
 * Provider chain: ComfyUI → fal.ai → Replicate → DALL-E (auto-selected at runtime).
 * Run: DATABASE_URL=<prod> npx tsx scripts/queue-homebrew-images.ts
 */
import { PrismaClient } from '@prisma/client';
import { buildPrompt } from '../src/lib/ai/image-generation';

const prisma = new PrismaClient();

async function main() {
  const homebrew = await prisma.homebrewContent.findMany({
    where: { imageUrl: null },
    select: { id: true, userId: true, type: true, name: true, data: true },
  });

  console.log(`Found ${homebrew.length} homebrew items without images.`);

  if (homebrew.length === 0) {
    console.log('Nothing to queue.');
    return;
  }

  // Check for existing queued/processing jobs to avoid duplicates
  const existingJobs = await prisma.imageGenerationJob.findMany({
    where: {
      homebrewId: { in: homebrew.map((h) => h.id) },
      status: { in: ['queued', 'processing'] },
    },
    select: { homebrewId: true },
  });
  const alreadyQueued = new Set(existingJobs.map((j) => j.homebrewId));

  const toQueue = homebrew.filter((h) => !alreadyQueued.has(h.id));
  console.log(`Queuing ${toQueue.length} jobs (${alreadyQueued.size} already queued).`);

  let count = 0;
  for (const item of toQueue) {
    const data = typeof item.data === 'object' && item.data !== null ? (item.data as Record<string, unknown>) : {};
    const desc = data.description as string | undefined;
    const imagePromptHint = data.imagePromptHint as string | undefined;
    const prompt = buildPrompt(item.type, item.name, desc, imagePromptHint);

    await prisma.imageGenerationJob.create({
      data: {
        homebrewId: item.id,
        userId: item.userId,
        prompt,
        provider: 'auto',
        status: 'queued',
      },
    });
    count++;
    process.stdout.write(`\r  Queued ${count}/${toQueue.length}: ${item.name.slice(0, 40)}`);
  }

  console.log(`\nDone. ${count} jobs queued.`);
  console.log('The image-generation-worker will pick these up when running.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
