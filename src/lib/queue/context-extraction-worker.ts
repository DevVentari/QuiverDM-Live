import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { prisma } from '../prisma';
import { getRedisConnection } from './queue';
import type { ContextExtractionJobData, ContextExtractionJobResult } from './context-extraction-queue';
import { chatWithAI } from '../ai/chat';
import { generateEmbedding } from '../ai/embeddings';
import { parseExtractionResponse, buildContentStrings } from '../recap/context-extraction-utils';

const EXTRACTION_PROMPT = `You are a D&D session analyst. Extract structured information from this session transcript.

Return ONLY a JSON object with these exact fields:
- keyEvents: array of strings — significant events that happened (max 10 items, each under 150 chars)
- npcsInvolved: array of strings — NPC names mentioned (max 15 items, each under 80 chars)
- decisions: array of strings — decisions the party made (max 10 items, each under 150 chars)
- lootGained: array of strings — items or rewards obtained (max 10 items, each under 100 chars)

Respond ONLY with the JSON object. No explanation. No markdown.

Transcript:`;

async function processContextExtraction(
  job: Job<ContextExtractionJobData, ContextExtractionJobResult>
): Promise<ContextExtractionJobResult> {
  const { transcriptId, sessionId, campaignId } = job.data;

  console.log(`[ContextExtractionWorker] Processing transcript ${transcriptId}`);

  const transcript = await prisma.transcript.findUnique({
    where: { id: transcriptId },
    select: { correctedText: true },
  });

  if (!transcript?.correctedText?.trim()) {
    console.log(`[ContextExtractionWorker] Transcript ${transcriptId} has no text — skipping`);
    return { success: true, chunksWritten: 0, skipped: true };
  }

  // Truncate to avoid LLM token limits (~8k chars is safe)
  const text = transcript.correctedText.slice(0, 8000);

  let extract;
  try {
    const raw = await chatWithAI([
      { role: 'user', content: `${EXTRACTION_PROMPT}\n\n${text}` },
    ]);
    extract = parseExtractionResponse(raw);
  } catch (err) {
    console.warn(`[ContextExtractionWorker] AI extraction failed for ${transcriptId}:`, err);
    return { success: true, chunksWritten: 0, skipped: true };
  }

  if (!extract) {
    console.warn(`[ContextExtractionWorker] Could not parse AI response for ${transcriptId}`);
    return { success: true, chunksWritten: 0, skipped: true };
  }

  const contentStrings = buildContentStrings(extract);
  let chunksWritten = 0;

  for (const content of contentStrings) {
    let record;
    try {
      record = await prisma.campaignContext.upsert({
        where: {
          campaignId_type_content: {
            campaignId,
            type: 'SESSION_EXTRACT',
            content,
          },
        },
        create: {
          campaignId,
          sessionId,
          type: 'SESSION_EXTRACT',
          content,
          keyEvents: extract.keyEvents,
          npcsInvolved: extract.npcsInvolved,
          decisions: extract.decisions,
          lootGained: extract.lootGained,
        },
        update: {
          sessionId,
          keyEvents: extract.keyEvents,
          npcsInvolved: extract.npcsInvolved,
          decisions: extract.decisions,
          lootGained: extract.lootGained,
        },
      });
    } catch (err) {
      console.warn(`[ContextExtractionWorker] Upsert failed for content "${content.slice(0, 50)}...":`, err);
      continue;
    }

    try {
      const embedding = await generateEmbedding(content);
      const vectorStr = `[${embedding.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "CampaignContext" SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        record.id
      );
    } catch (err) {
      console.warn(`[ContextExtractionWorker] Embedding failed for "${content.slice(0, 50)}...":`, err);
    }

    chunksWritten++;
  }

  console.log(`[ContextExtractionWorker] Done — ${chunksWritten} chunks written for transcript ${transcriptId}`);
  return { success: true, chunksWritten };
}

const worker = new Worker<ContextExtractionJobData, ContextExtractionJobResult>(
  'context-extraction',
  processContextExtraction,
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[ContextExtractionWorker] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[ContextExtractionWorker] Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[ContextExtractionWorker] Worker error:', err);
});

console.log('[ContextExtractionWorker] Started — listening on context-extraction queue');
