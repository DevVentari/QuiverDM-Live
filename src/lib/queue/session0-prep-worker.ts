import dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'bullmq';
import { prisma } from '../prisma';
import { chatWithAI } from '../ai/chat';
import { emptyPrepData } from '../prep-types';
import type { Session0PrepJobData, Session0PrepJobResult } from './session0-prep-queue';

function getRedisConnection(): Record<string, unknown> {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const useTls = url.protocol === 'rediss:';
    return {
      host: url.hostname,
      port: parseInt(url.port || (useTls ? '6380' : '6379')),
      password: url.password || undefined,
      username: url.username !== 'default' ? url.username : undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      ...(useTls ? { tls: {} } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

const SYSTEM_PROMPT = `You are a D&D session prep assistant. Given sourcebook entities, generate a Session 0 prep brief.

Respond ONLY with valid JSON in this exact shape:
{
  "strongStart": "<2-3 sentence opening scene/hook the DM reads or adapts>",
  "scenes": [
    { "id": "<uuid>", "title": "<title>", "description": "<2-3 sentences>", "location": "<location name>", "readAloud": "", "order": 0, "linkedNpcIds": [], "linkedSecretIds": [], "linkedMonsterNames": [] }
  ],
  "npcs": [
    { "id": "<uuid>", "name": "<name>", "role": "<role>", "motivation": "<1 sentence>" }
  ],
  "secretsAndClues": [
    { "id": "<uuid>", "text": "<1-2 sentence DM secret the players don't know yet>" }
  ]
}

Rules:
- 1 strongStart
- 2-3 scenes (opening location tour, character introductions, inciting incident)
- 2-3 npcs from the entities list
- 1-2 secrets relevant to Session 0`;

async function generateSession0Prep(
  sourcebookTitle: string,
  campaignName: string,
  entities: Array<{ type: string; name: string; description: string | null }>
): Promise<Partial<ReturnType<typeof emptyPrepData>>> {
  const entitySummary = entities
    .map(e => `[${e.type}] ${e.name}: ${(e.description ?? '').slice(0, 200)}`)
    .join('\n');

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `Campaign: ${campaignName}\nSourcebook: ${sourcebookTitle}\n\nKey entities:\n${entitySummary}\n\nGenerate a Session 0 prep brief.`,
    },
  ];

  const raw = await chatWithAI(messages, { temperature: 0.7 });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in AI response');
  return JSON.parse(jsonMatch[0]);
}

new Worker<Session0PrepJobData, Session0PrepJobResult>(
  'session0-prep',
  async (job) => {
    const { sessionId, sourcebookId, sourcebookTitle, campaignName } = job.data;
    console.log(`[session0-prep] Processing session ${sessionId}`);

    try {
      const entities = await prisma.sourcebookEntity.findMany({
        where: { sourcebookId },
        orderBy: { createdAt: 'asc' },
        take: 15,
        select: { type: true, name: true, description: true },
      });

      let prepPatch: Partial<ReturnType<typeof emptyPrepData>>;

      if (entities.length === 0) {
        const base = emptyPrepData();
        prepPatch = {
          strongStart: `Welcome to ${campaignName}. Add your opening scene here.`,
          scenes: base.scenes,
          npcs: base.npcs,
          secretsAndClues: base.secretsAndClues,
        };
      } else {
        prepPatch = await generateSession0Prep(sourcebookTitle, campaignName, entities);
      }

      const existing = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        select: { prepData: true },
      });
      const base = emptyPrepData();
      const merged = { ...base, ...(existing?.prepData as object ?? {}), ...prepPatch, lastSavedAt: new Date().toISOString() };

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          prepData: merged as any,
          prepStatus: 'complete',
        },
      });

      console.log(`[session0-prep] Done for session ${sessionId}`);
      return { success: true };
    } catch (err) {
      console.error(`[session0-prep] Failed for session ${sessionId}:`, err);
      // Leave prepStatus as 'draft' - DM can fill manually. Don't rethrow so job doesn't retry on AI errors.
      return { success: false, error: String(err) };
    }
  },
  { connection: getRedisConnection() as any, concurrency: 2 }
);

console.log('[session0-prep] Worker started');
