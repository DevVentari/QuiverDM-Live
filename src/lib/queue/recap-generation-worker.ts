/**
 * Recap Generation Worker
 *
 * Generates session recaps in multiple styles using the Anthropic API.
 *
 * Run with: npm run worker:recap-generation
 */
import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../prisma';
import { getRedisConnection } from './queue';
import type { RecapGenerationJobData, RecapGenerationJobResult } from './recap-generation-queue';
import { buildRecapPrompt, SECTION_SHAPES } from '../recap/recap-prompts';
import { broadcastRecapComplete } from '../../server/websocket';
import { RecapStatus } from '@prisma/client';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function processRecapGeneration(
  job: Job<RecapGenerationJobData, RecapGenerationJobResult>
): Promise<RecapGenerationJobResult> {
  const { recapId, transcriptId, campaignId, sessionId, style } = job.data;
  const startTime = Date.now();

  console.log(`[RecapWorker] Processing recap ${recapId} style=${style}`);

  // 1. Idempotency guard
  const recap = await prisma.sessionRecap.findUnique({ where: { id: recapId } });
  if (!recap || recap.status !== RecapStatus.GENERATING) {
    console.log(`[RecapWorker] Recap ${recapId} is not GENERATING — skipping`);
    return { success: true, recapId };
  }

  // 2. Fetch transcript
  const transcript = await prisma.transcript.findUnique({ where: { id: transcriptId } });
  if (!transcript?.correctedText) {
    throw new Error(`No correctedText for transcript ${transcriptId}`);
  }
  const correctedText = transcript.correctedText.slice(0, 12000);
  const speakersJson = JSON.stringify(transcript.speakers ?? []);

  // 3. Fetch last 3 campaign context records
  const contextRecords = await prisma.campaignContext.findMany({
    where: { campaignId, type: 'SESSION_EXTRACT' },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  const campaignContext = contextRecords.map((r) => r.content).join('\n\n');

  // 4. Build prompt
  const styleKey = style as keyof typeof SECTION_SHAPES;
  const { system, user } = buildRecapPrompt({ correctedText, speakersJson, campaignContext, style: styleKey });

  // 5. Call Anthropic
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });

  // 6. Parse response — strip markdown fencing if present
  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '';
  let json = rawText.trim();
  const fenceMatch = json.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (fenceMatch) json = fenceMatch[1].trim();

  let parsed: { sections: Array<{ key: string; title: string; content: string }> };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Failed to parse Anthropic response: ${rawText.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed.sections)) {
    throw new Error('Anthropic response missing sections array');
  }

  // 7. Update SessionRecap
  const rawContent = parsed.sections.map((s) => s.content).join('\n\n');
  const generationTimeMs = Date.now() - startTime;
  const tokensUsed = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);

  await prisma.sessionRecap.update({
    where: { id: recapId },
    data: {
      sections: parsed.sections,
      rawContent,
      status: RecapStatus.AUTO_GENERATED,
      modelUsed: 'claude-sonnet-4-6',
      tokensUsed,
      generationTimeMs,
      clarificationSkipped: true,
    },
  });

  // 8. Broadcast completion
  broadcastRecapComplete(sessionId, recapId);

  console.log(`[RecapWorker] Done — recap ${recapId} (${generationTimeMs}ms, ${tokensUsed} tokens)`);
  return { success: true, recapId, tokensUsed };
}

// ---------------------------------------------------------------------------
// Worker bootstrap
// ---------------------------------------------------------------------------

const worker = new Worker<RecapGenerationJobData, RecapGenerationJobResult>(
  'recap-generation',
  processRecapGeneration,
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[RecapWorker] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[RecapWorker] Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('[RecapWorker] Worker error:', err);
});

console.log('[RecapWorker] Started — listening on recap-generation queue');
